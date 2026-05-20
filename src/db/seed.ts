import { db } from "./index";
import { nanoid } from "nanoid";
import type { Prompt, Scenario } from "@/types";
import { seedPlaceholderPrompts } from "./migrations/v3";
import { seedDefaultTaskPacks } from "./migrations/v6Seed";
import { repairBadTitles } from "./repairTitles";
import { seedPromptOSV31 } from "./migrations/v31Seed";
import { seedAiCodingZeroToOne } from "./migrations/zeroToOneSeed";
import { SCENE_DEFS } from "@/data/promptos-v3-1";
import { takeSnapshot } from "./snapshot";

const DEFAULT_FIRST_LEVEL = [
  "工作场景",
  "自媒体场景",
  "学习场景",
  "读书场景",
  "写作场景",
  "商业场景",
  "个人成长场景",
  "生活管理场景",
  "AI工具场景",
  "知识管理场景",
];

// 控制字符  作为路径分隔符（中文场景名不会包含），保证 join/split 双向无歧义
const SEP = "";
const pathKey = (segs: string[]) => segs.join(SEP);

/**
 * 必须在 prompts 已就绪后调用：扫描所有 prompts 的 primaryScenario / secondaryScenarios
 * 路径，按 (level1 > level2 > level3) 三层去重生成 scenarios 节点。
 * DEFAULT_FIRST_LEVEL 全部建为一级节点兜底，保证侧栏不空。
 */
export async function seedDefaultScenarios() {
  const count = await db.scenarios.count();
  if (count > 0) return;

  const prompts = await db.prompts.toArray();

  const paths = new Set<string>();
  function visit(path: string[] | undefined) {
    if (!path?.length) return;
    for (let i = 1; i <= Math.min(path.length, 3); i++) {
      paths.add(pathKey(path.slice(0, i)));
    }
  }
  for (const p of prompts) {
    visit(p.primaryScenario);
    for (const sp of p.secondaryScenarios ?? []) visit(sp);
  }
  for (const t of DEFAULT_FIRST_LEVEL) paths.add(t);

  // 按层级升序入库，保证父节点先创建
  const idByPath = new Map<string, string>();
  const sorted = [...paths].sort(
    (a, b) => a.split(SEP).length - b.split(SEP).length
  );

  // 给每条 scenario 推荐前 6 条 prompt：按 valueLevel 优先级 + useCount 排序
  const valueRank: Record<string, number> = { 高价值: 0, 战略型: 1, 高频: 2, 辅助型: 3 };
  function isPathPrefix(prefix: string[], path: string[] | undefined) {
    if (!path || path.length < prefix.length) return false;
    for (let i = 0; i < prefix.length; i++) if (path[i] !== prefix[i]) return false;
    return true;
  }
  function pickRecommendations(prefix: string[]): string[] {
    const matched = prompts.filter(
      (p) =>
        isPathPrefix(prefix, p.primaryScenario) ||
        (p.secondaryScenarios ?? []).some((sp) => isPathPrefix(prefix, sp))
    );
    matched.sort((a, b) => {
      const av = valueRank[a.valueLevel] ?? 9;
      const bv = valueRank[b.valueLevel] ?? 9;
      if (av !== bv) return av - bv;
      return (b.useCount ?? 0) - (a.useCount ?? 0);
    });
    return matched.slice(0, 6).map((p) => p.id);
  }

  const scenarios: Scenario[] = sorted.map((key) => {
    const segs = key.split(SEP);
    const id = nanoid();
    idByPath.set(key, id);
    const parentKey = segs.length > 1 ? pathKey(segs.slice(0, -1)) : null;
    return {
      id,
      title: segs[segs.length - 1],
      parentId: parentKey ? (idByPath.get(parentKey) ?? null) : null,
      level: segs.length,
      fullPath: segs,
      description: "",
      tags: [],
      recommendedPrompts: pickRecommendations(segs),
      recommendedWorkflows: [],
      recommendedContexts: [],
      typicalTasks: [],
    };
  });

  if (!scenarios.length) return;
  const CHUNK = 80;
  for (let i = 0; i < scenarios.length; i += CHUNK) {
    await db.scenarios.bulkAdd(scenarios.slice(i, i + CHUNK));
  }
  if (import.meta.env.DEV) console.log(`[Prompt OS] 已生成 ${scenarios.length} 个场景节点（三级目录）`);
}

export async function seedPromptsFromFile() {
  const count = await db.prompts.count();
  if (count > 0) return;

  try {
    const res = await fetch("/seed-prompts.json");
    if (!res.ok) return;
    const data = (await res.json()) as { prompts: Prompt[] };
    if (!data.prompts?.length) return;

    const CHUNK = 40;
    for (let i = 0; i < data.prompts.length; i += CHUNK) {
      await db.prompts.bulkAdd(data.prompts.slice(i, i + CHUNK));
    }

    if (import.meta.env.DEV) console.log(`[Prompt OS] 已从种子文件导入 ${data.prompts.length} 条提示词`);
  } catch (e) {
    console.warn("[Prompt OS] 种子数据加载失败", e);
  }
}

/**
 * 启动期数据装填：v3.1 出厂内容（18 场景 + 87 任务包/Prompt）。
 *
 * 老的 seedPromptsFromFile / seedPlaceholderPrompts / repairBadTitles /
 * seedDefaultScenarios / seedDefaultTaskPacks 已被 v3.1 出厂内容取代——
 * db 版本号升到 v7 后会清空 prompts/scenarios/taskPacks 三表，
 * 再由 seedPromptOSV31() 按文档结构重建。函数本身保留，便于代码考古。
 */
/**
 * 老用户的 scenarios 表没有 order 字段，按以下策略幂等补全：
 * - v3.1 出厂场景按 SCENE_DEFS 数组顺序赋 order = i*10
 * - 其余自定义场景按 parentId 分组，追加在末尾，每组内保持当前 toArray() 顺序
 * - 已经有 order 的记录不动，直接跳过
 */
export async function backfillScenarioOrder() {
  const all = await db.scenarios.toArray();
  const missing = all.filter((s) => typeof s.order !== "number");
  if (!missing.length) return;

  const sceneDefIndex = new Map(SCENE_DEFS.map((s, i) => [s.id, i] as const));
  const patches: Scenario[] = [];

  // 1) v3.1 出厂场景按定义顺序
  for (const s of missing) {
    const idx = sceneDefIndex.get(s.id);
    if (idx !== undefined) patches.push({ ...s, order: idx * 10 });
  }

  // 2) 自定义场景按 parentId 分组，追加在该组现有 order 末尾
  const customs = missing.filter((s) => !sceneDefIndex.has(s.id));
  const byParent = new Map<string | null, Scenario[]>();
  for (const s of customs) {
    const arr = byParent.get(s.parentId) ?? [];
    arr.push(s);
    byParent.set(s.parentId, arr);
  }
  for (const [parentId, group] of byParent) {
    const existingOrders = all
      .filter((s) => s.parentId === parentId && typeof s.order === "number")
      .map((s) => s.order)
      .concat(patches.filter((s) => s.parentId === parentId).map((s) => s.order));
    const baseMax = existingOrders.length ? Math.max(...existingOrders) : -10;
    group.forEach((s, i) => patches.push({ ...s, order: baseMax + (i + 1) * 10 }));
  }

  if (patches.length) {
    await db.scenarios.bulkPut(patches);
    if (import.meta.env.DEV) console.log(`[Prompt OS] 补全 ${patches.length} 个场景的 order 字段`);
  }
}

export async function seedAll() {
  // 启动期自动快照：稳态下保留前一次启动时的全量备份；
  // 升级当天三表已被 hook 清空 → takeSnapshot 返回 null，不动旧快照；
  // 写入失败也只 warn，绝不阻塞 seedPromptOSV31。
  try {
    await takeSnapshot("startup");
  } catch (e) {
    console.warn("[Prompt OS] 启动快照失败（不影响后续 seed）", e);
  }
  await seedPromptOSV31();
  await seedAiCodingZeroToOne();
  await backfillScenarioOrder();
}

// 旧 seed 函数仍然 export，避免外部模块（如测试、备份脚本）引用断裂；
// 但不再被 seedAll() 调用。
void seedPromptsFromFile;
void seedPlaceholderPrompts;
void repairBadTitles;
void seedDefaultScenarios;
void seedDefaultTaskPacks;
