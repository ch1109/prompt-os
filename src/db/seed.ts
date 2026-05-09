import { db } from "./index";
import { nanoid } from "nanoid";
import type { Prompt, Scenario } from "@/types";
import { seedPlaceholderPrompts } from "./migrations/v3";
import { seedDefaultTaskPacks } from "./migrations/v6Seed";
import { repairBadTitles } from "./repairTitles";
import { seedPromptOSV31 } from "./migrations/v31Seed";

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
export async function seedAll() {
  await seedPromptOSV31();
}

// 旧 seed 函数仍然 export，避免外部模块（如测试、备份脚本）引用断裂；
// 但不再被 seedAll() 调用。
void seedPromptsFromFile;
void seedPlaceholderPrompts;
void repairBadTitles;
void seedDefaultScenarios;
void seedDefaultTaskPacks;
