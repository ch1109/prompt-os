import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Prompt, Scenario, TaskPack, TaskStage } from "@/types";
import { SCENE_DEFS, PACK_DEFS, type PackDef } from "@/data/promptos-v3-1";

/**
 * 写入 PromptOS v3.1 出厂内容：18 个一级场景 + 87 条任务包/Prompt。
 *
 * 触发场景：① db v7 升级清空 prompts/scenarios/taskPacks 后首次启动；② 全新用户。
 * 幂等保护：函数开头查 prompts 表，若已存在 v31 数据则跳过。
 */
export async function seedPromptOSV31(): Promise<void> {
  const probe = await db.prompts.get("prompt:v31:1.1");
  if (probe) {
    return;
  }

  const now = Date.now();

  const scenarios: Scenario[] = SCENE_DEFS.map((s, i) => ({
    id: s.id,
    title: s.title,
    parentId: null,
    level: 1,
    fullPath: [s.title],
    description: s.description,
    tags: [],
    order: i * 10,
    recommendedPrompts: [],
    recommendedWorkflows: [],
    recommendedContexts: [],
    typicalTasks: [],
  }));

  const prompts: Prompt[] = PACK_DEFS.map((d) => packToPrompt(d, now));
  // 同一 sceneId 内按 PACK_DEFS 出现顺序为子场景赋 order = i*10
  const orderCounter = new Map<string, number>();
  const packs: TaskPack[] = PACK_DEFS.map((d) => {
    const idx = orderCounter.get(d.sceneId) ?? 0;
    orderCounter.set(d.sceneId, idx + 1);
    return packToTaskPack(d, now, idx * 10);
  });

  await db.scenarios.bulkAdd(scenarios);

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
      `[Prompt OS] v3.1 出厂内容已写入：${scenarios.length} 场景 / ${prompts.length} prompts / ${packs.length} 任务包`
    );
  }
}

function packToPrompt(d: PackDef, ts: number): Prompt {
  return {
    id: d.promptId,
    title: d.title,
    body: d.body,
    summary: d.use,
    taskIntent: d.use,
    primaryScenario: [d.sceneTitle],
    secondaryScenarios: [],
    taskType: d.taskType,
    inputRequirements: d.variables.map((v) => `{${v}}`).join(", "),
    outputFormat: "Markdown 文本",
    upstreamPrompts: [],
    downstreamPrompts: [],
    recommendedCombinations: [],
    boundaries: d.boundaries,
    tags: d.tags,
    difficulty: "中级",
    valueLevel: d.valueLevel ?? "高频",
    shareable: true,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
}

function packToTaskPack(d: PackDef, ts: number, order: number): TaskPack {
  const stage: TaskStage = {
    id: nanoid(),
    name: "核心 Prompt",
    description: "",
    promptIds: [d.promptId],
    order: 0,
  };
  return {
    id: d.packId,
    title: d.title,
    goal: d.use,
    description: firstSentence(d.body),
    sceneCategoryId: d.sceneId,
    stages: [stage],
    tags: d.tags,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    order,
    createdAt: ts,
    updatedAt: ts,
  };
}

function firstSentence(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "";
  const m = trimmed.match(/^[^。\n]{1,80}[。\n]/);
  return (m ? m[0] : trimmed.slice(0, 80)).replace(/[。\n]$/, "").trim();
}
