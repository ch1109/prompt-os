import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Prompt, TaskPack, TaskStage, TaskType } from "@/types";
import { Z2O_PACKS, Z2O_PROMPTS } from "@/data/aicoding-zero-to-one";

/**
 * 写入「AI 编程·从 0 到 1 完整开发流程」提示词库：
 * - 15 个 TaskPack（00 想法成型 … 14 复盘沉淀），全部挂在 scene:v31:ai-coding
 * - 84 条 Prompt（primaryScenario = ["AI 编程场景"]）
 *
 * 触发场景：① 全新用户；② v3.1 已写入但本批次未写过的老用户下次启动自动补齐。
 * 幂等保护：probe prompt:z2o:00-01，已存在则整段 skip，不会重复写入。
 */
const SCENE_ID_AI_CODING = "scene:v31:ai-coding";
const SCENE_TITLE_AI_CODING = "AI 编程场景";
const PROBE_ID = "prompt:z2o:00-01";
const PACK_ORDER_BASE = 100; // 避开 v3.1 出厂 1.1/1.2/1.3（order = 0/10/20）

export async function seedAiCodingZeroToOne(): Promise<void> {
  const probe = await db.prompts.get(PROBE_ID);
  if (probe) return;

  // 一级场景必须存在（v3.1 出厂内容应已写入）。
  // 若缺失（极少见的脏库），主动跳过本批次，避免写入孤儿 TaskPack。
  const scene = await db.scenarios.get(SCENE_ID_AI_CODING);
  if (!scene) {
    console.warn(
      "[Prompt OS] 「AI 编程场景」缺失，跳过从 0 到 1 提示词写入（请检查 v3.1 seed 是否成功）"
    );
    return;
  }

  const now = Date.now();

  const prompts: Prompt[] = Z2O_PROMPTS.map((p) => {
    const summary = derivePromptSummary(p.body);
    const variables = extractVariables(p.body);
    const stageTitle = Z2O_PACKS.find((pk) => pk.packId === p.packId)?.title ?? "";
    return {
      id: p.id,
      title: p.title,
      body: p.body,
      summary,
      taskIntent: summary,
      primaryScenario: [SCENE_TITLE_AI_CODING],
      secondaryScenarios: [],
      taskType: inferTaskType(p.title),
      inputRequirements: variables.map((v) => `{{${v}}}`).join("、"),
      outputFormat: "Markdown 文本",
      upstreamPrompts: [],
      downstreamPrompts: [],
      recommendedCombinations: [],
      boundaries: "",
      tags: ["AI 编程", "从 0 到 1", stageTitle],
      difficulty: "中级",
      valueLevel: "高频",
      shareable: true,
      isFavorited: false,
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
    };
  });

  const packs: TaskPack[] = Z2O_PACKS.map((pack, i) => {
    const promptIds = Z2O_PROMPTS
      .filter((p) => p.packId === pack.packId)
      .map((p) => p.id);
    const stage: TaskStage = {
      id: nanoid(),
      name: "完整阶段流程",
      description: "按顺序使用该阶段下的全部 Prompt",
      promptIds,
      order: 0,
    };
    return {
      id: pack.packId,
      title: pack.title,
      goal: pack.goal,
      description: pack.description,
      sceneCategoryId: SCENE_ID_AI_CODING,
      stages: [stage],
      tags: ["AI 编程", "从 0 到 1", pack.title],
      isFavorited: false,
      useCount: 0,
      lastUsedAt: null,
      createdAt: now,
      updatedAt: now,
      order: PACK_ORDER_BASE + i * 10,
    };
  });

  const PROMPT_CHUNK = 30;
  for (let i = 0; i < prompts.length; i += PROMPT_CHUNK) {
    await db.prompts.bulkAdd(prompts.slice(i, i + PROMPT_CHUNK));
  }

  const PACK_CHUNK = 30;
  for (let i = 0; i < packs.length; i += PACK_CHUNK) {
    await db.taskPacks.bulkAdd(packs.slice(i, i + PACK_CHUNK));
  }

  if (import.meta.env.DEV) {
    console.log(
      `[Prompt OS] 「从 0 到 1」已写入：${packs.length} 任务包 / ${prompts.length} prompts`
    );
  }
}

/** body 第一行去掉「你现在扮演一名/你现在扮演」前缀，截 80 字内 */
function derivePromptSummary(body: string): string {
  const first = body.trim().split("\n", 1)[0] ?? "";
  const cleaned = first
    .replace(/^你现在扮演一名/, "")
    .replace(/^你现在扮演/, "")
    .replace(/[。.]$/, "")
    .trim();
  return cleaned.length > 80 ? cleaned.slice(0, 80) : cleaned;
}

/** 提取 body 中所有 {{xxx}} 占位符（保序、去重） */
function extractVariables(body: string): string[] {
  const matches = body.matchAll(/\{\{([^}]+)\}\}/g);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    const v = m[1].trim();
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/** 根据标题关键词推断 taskType；未命中→"生成" */
function inferTaskType(title: string): TaskType {
  if (/(审查|检查|识别|扫描|分析|定位|对齐|补漏|风险|稳定性验收)/.test(title)) {
    return "分析";
  }
  if (/(拆解|拆分|规划|架构|设计|清单|流程|路径|顺序|预案)/.test(title)) {
    return "规划";
  }
  if (/(复盘|沉淀|提取|总结|模式)/.test(title)) {
    return "复盘";
  }
  if (/(判断|取舍)/.test(title)) {
    return "决策";
  }
  if (/(改造|重构|清理|美化|密度优化)/.test(title)) {
    return "改写";
  }
  return "生成";
}
