import { callJSON } from "./anthropicClient";
import { db } from "@/db";

export interface IntentHit {
  id: string;
  reason: string;
}

export interface IntentMatch {
  prompts: IntentHit[];
  scenarios: IntentHit[];
  workflows: IntentHit[];
  taskPacks: IntentHit[];
  contexts: IntentHit[];
  nextStep: string;
}

const SYSTEM = `你是 Prompt OS 的智能助手。根据用户的自然语言任务/意图，从给定候选清单中挑选最匹配的资产。

输入：用户意图，以及四类候选清单（prompts、scenarios、taskPacks、contexts）。
输出：严格的 JSON：
{
  "prompts":   [{"id":"...","reason":"为什么匹配（一句话）"}],
  "scenarios": [{"id":"...","reason":"..."}],
  "taskPacks": [{"id":"...","reason":"..."}],
  "contexts":  [{"id":"...","reason":"..."}],
  "workflows": [],
  "nextStep":  "推荐用户接下来的具体动作（一句话）"
}

规则：
1. prompts 最多 8 条，按相关度排序；taskPacks 最多 5 条；其余每类最多 3 条。
2. id 必须来自候选清单，禁止虚构。
3. 若某类无合适匹配，返回空数组。
4. nextStep 必须给出可执行建议（如"先用 X Prompt 生成大纲，再用 Y Prompt 优化表达"）。
5. workflows 字段必须返回空数组（兼容字段，概念已废弃，无候选可选）。
6. 仅输出 JSON，不要解释。`;

export async function intentSearch(query: string): Promise<IntentMatch> {
  const [allPrompts, allScenarios, allTaskPacks, allContexts] = await Promise.all([
    db.prompts.toArray(),
    db.scenarios.toArray(),
    db.taskPacks.toArray(),
    db.contexts.toArray(),
  ]);

  const candidates = {
    prompts: allPrompts.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      taskIntent: p.taskIntent,
      tags: p.tags,
    })),
    scenarios: allScenarios
      .filter((s) => s.level >= 2) // 一级场景太宽泛，跳过
      .map((s) => ({ id: s.id, path: s.fullPath })),
    taskPacks: allTaskPacks.map((tp) => ({
      id: tp.id,
      title: tp.title,
      goal: tp.goal,
      tags: tp.tags,
    })),
    contexts: allContexts.map((c) => ({
      id: c.id,
      title: c.title,
      type: c.type,
    })),
  };

  const result = await callJSON<IntentMatch>(
    SYSTEM,
    `用户意图：${query}\n候选清单：${JSON.stringify(candidates)}`,
    2048
  );
  // 强制丢弃 AI 返回的任何 workflow 推荐；taskPacks/contexts 等保留
  return {
    ...result,
    workflows: [],
    taskPacks: result.taskPacks ?? [],
  };
}
