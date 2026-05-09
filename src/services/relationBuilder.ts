import { callJSON } from "./anthropicClient";
import { db } from "@/db";
import type { Prompt } from "@/types";

export interface RelationEdge {
  id: string;
  upstream: string[];
  downstream: string[];
}

const SYSTEM = `你是任务流程编排专家。给定一组同一场景下的 Prompt（含 id/title/summary/taskIntent），分析它们在真实任务流程中的先后关系。

输出 JSON 数组，每个元素：
{"id":"...","upstream":["...上游 Prompt id"],"downstream":["...下游 Prompt id"]}

规则：
1. upstream 是"在使用当前 Prompt 之前应该先调用"的 Prompt id；downstream 反之。
2. 每条最多 3 个 upstream / 3 个 downstream。
3. 必须使用输入清单中的 id，禁止虚构。
4. 若某 Prompt 是流程起点或终点，对应数组返回空。
5. 仅输出 JSON 数组，不要解释。`;

/**
 * 按一级场景分组建立上下游关系图。每组单独调用 AI 控制 token 量。
 * onProgress(done, total) 报告组级进度。
 */
export async function buildRelationGraph(
  onProgress?: (done: number, total: number) => void
): Promise<{ updated: number; groups: number }> {
  const all = await db.prompts.toArray();

  // 按一级场景分组
  const groups = new Map<string, Prompt[]>();
  for (const p of all) {
    const lvl1 = p.primaryScenario?.[0] ?? "(未分类)";
    if (!groups.has(lvl1)) groups.set(lvl1, []);
    groups.get(lvl1)!.push(p);
  }

  // 仅处理有 ≥ 2 条 prompt 的组（< 2 无法形成关系）
  const tasks = [...groups.entries()].filter(([, list]) => list.length >= 2);
  let done = 0;
  let totalUpdated = 0;
  onProgress?.(0, tasks.length);

  for (const [, list] of tasks) {
    const candidates = list.map((p) => ({
      id: p.id,
      title: p.title,
      summary: p.summary,
      taskIntent: p.taskIntent,
      taskType: p.taskType,
    }));

    try {
      const edges = await callJSON<RelationEdge[]>(
        SYSTEM,
        `场景候选：${JSON.stringify(candidates)}`,
        4096
      );
      const validIds = new Set(list.map((p) => p.id));
      // 写回，过滤掉无效 id
      for (const e of edges) {
        if (!validIds.has(e.id)) continue;
        const upstream = (e.upstream ?? []).filter((id) => validIds.has(id)).slice(0, 3);
        const downstream = (e.downstream ?? []).filter((id) => validIds.has(id)).slice(0, 3);
        await db.prompts.update(e.id, {
          upstreamPrompts: upstream,
          downstreamPrompts: downstream,
          updatedAt: Date.now(),
        });
        totalUpdated++;
      }
    } catch (err) {
      console.warn(`[Prompt OS] 组关系构建失败:`, err);
    }
    done++;
    onProgress?.(done, tasks.length);
  }

  return { updated: totalUpdated, groups: tasks.length };
}
