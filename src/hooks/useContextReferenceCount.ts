import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";

export interface ContextReferenceCount {
  promptCount: number;
  scenarioCount: number;
  total: number;
}

const ZERO: ContextReferenceCount = { promptCount: 0, scenarioCount: 0, total: 0 };

/**
 * 实时统计某个上下文被引用的次数。适用于单卡片场景（编辑弹窗右栏等）。
 * - Prompt 引用：boundContextIds 中包含 contextId 的数量
 * - 场景引用：Scenario.recommendedContexts 中包含 contextId 的数量
 */
export function useContextReferenceCount(
  contextId: string | null | undefined
): ContextReferenceCount {
  const result = useLiveQuery(
    async () => {
      if (!contextId) return ZERO;
      const [prompts, scenarios] = await Promise.all([
        db.prompts.toArray(),
        db.scenarios.toArray(),
      ]);
      const promptCount = prompts.filter((p) =>
        p.boundContextIds?.includes(contextId)
      ).length;
      const scenarioCount = scenarios.filter((s) =>
        s.recommendedContexts?.includes(contextId)
      ).length;
      return {
        promptCount,
        scenarioCount,
        total: promptCount + scenarioCount,
      };
    },
    [contextId],
    ZERO
  );
  return result;
}

/**
 * 批量场景：在上下文库列表等 N 卡片场景中，一次性聚合所有上下文的引用次数。
 * 返回 Map<contextId, ContextReferenceCount>，缺失即视为零。
 */
export function useAllContextReferenceCounts(): Map<string, ContextReferenceCount> {
  const map = useLiveQuery(async () => {
    const [prompts, scenarios] = await Promise.all([
      db.prompts.toArray(),
      db.scenarios.toArray(),
    ]);
    const m = new Map<string, ContextReferenceCount>();
    function bump(id: string, key: "promptCount" | "scenarioCount") {
      const cur = m.get(id) ?? { promptCount: 0, scenarioCount: 0, total: 0 };
      cur[key] += 1;
      cur.total = cur.promptCount + cur.scenarioCount;
      m.set(id, cur);
    }
    for (const p of prompts)
      for (const id of p.boundContextIds ?? []) bump(id, "promptCount");
    for (const s of scenarios)
      for (const id of s.recommendedContexts ?? []) bump(id, "scenarioCount");
    return m;
  });
  return map ?? new Map<string, ContextReferenceCount>();
}
