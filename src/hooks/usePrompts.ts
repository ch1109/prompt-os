import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useRef } from "react";
import { db } from "@/db";
import { useScenarios } from "@/hooks/useScenarios";
import { scorePrompt } from "@/services/keywordMatch";
import { useUI } from "@/store/uiStore";
import type { Prompt } from "@/types";

/** 判断 path 是否以 prefix 为前缀（按段比较） */
function isPathPrefix(prefix: string[], path: string[] | undefined) {
  if (!path || path.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (path[i] !== prefix[i]) return false;
  }
  return true;
}

export function usePrompts() {
  // 仅订阅 db 写入：deps 留空，切场景/搜索/筛选不会触发异步重查
  const allPromptsRaw = useLiveQuery(() =>
    db.prompts.orderBy("updatedAt").reverse().toArray()
  );
  const allScenarios = useScenarios();
  const { selectedScenarioId, searchQuery, filterTaskTypes, filterDifficulties, intentResultIds } =
    useUI();

  // 按 id+updatedAt 缓存对象引用：未变化的 prompt 复用旧引用，
  // 让 PromptCard 的 React.memo 在 db 不变期间命中所有条目
  const cacheRef = useRef<Map<string, Prompt>>(new Map());
  const allPrompts = useMemo(() => {
    if (!allPromptsRaw) return [] as Prompt[];
    const next = new Map<string, Prompt>();
    const stable = allPromptsRaw.map((p) => {
      const cached = cacheRef.current.get(p.id);
      const reused = cached && cached.updatedAt === p.updatedAt ? cached : p;
      next.set(p.id, reused);
      return reused;
    });
    cacheRef.current = next;
    return stable;
  }, [allPromptsRaw]);

  return useMemo(() => {
    let all = allPrompts;

    // 快捷入口 / 智能集合（前缀 qs: / smart:）
    if (selectedScenarioId === "qs:fav") {
      all = all.filter((p) => p.isFavorited);
    } else if (selectedScenarioId === "qs:recent") {
      all = all
        .filter((p) => p.lastUsedAt != null)
        .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
    } else if (selectedScenarioId === "qs:pending") {
      all = all.filter((p) => p.pendingReview);
    } else if (selectedScenarioId === "smart:high-value") {
      all = all.filter((p) => p.valueLevel === "高价值");
    } else if (selectedScenarioId === "smart:strategic") {
      all = all.filter((p) => p.valueLevel === "战略型");
    } else if (selectedScenarioId === "smart:high-freq") {
      all = all.filter((p) => p.valueLevel === "高频");
    } else if (
      selectedScenarioId &&
      selectedScenarioId !== "qs:all" &&
      !selectedScenarioId.startsWith("qs:") &&
      !selectedScenarioId.startsWith("smart:")
    ) {
      // 场景树节点：用 allScenarios 同步查找替代 db.scenarios.get(id)
      const scenario = allScenarios.find((s) => s.id === selectedScenarioId);
      if (scenario?.fullPath?.length) {
        const prefix = scenario.fullPath;
        all = all.filter(
          (p) =>
            isPathPrefix(prefix, p.primaryScenario) ||
            (p.secondaryScenarios ?? []).some((sp) => isPathPrefix(prefix, sp))
        );
      }
    }

    // AI 意图搜索结果优先
    if (intentResultIds) {
      const order = new Map(intentResultIds.map((id, i) => [id, i]));
      all = all
        .filter((p) => order.has(p.id))
        .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    } else if (searchQuery.trim()) {
      // 按字段权重打分（title=4 / summary|tags=2 / body=1），按 score desc → updatedAt desc 排序，
      // 强匹配始终在前；列表页不截断（保留全部命中供后续 chip 筛选）。
      all = all
        .map((p) => ({ p, score: scorePrompt(p, searchQuery) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score || b.p.updatedAt - a.p.updatedAt)
        .map((s) => s.p);
    }

    if (filterTaskTypes.length > 0) {
      all = all.filter((p) => filterTaskTypes.includes(p.taskType));
    }
    if (filterDifficulties.length > 0) {
      all = all.filter((p) => filterDifficulties.includes(p.difficulty));
    }

    return all;
  }, [
    allPrompts,
    allScenarios,
    selectedScenarioId,
    searchQuery,
    filterTaskTypes,
    filterDifficulties,
    intentResultIds,
  ]);
}
