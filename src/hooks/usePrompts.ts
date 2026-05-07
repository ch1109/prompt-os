import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";

export function usePrompts() {
  const { selectedScenarioId, searchQuery, filterTaskTypes, filterDifficulties, intentResultIds } =
    useUI();

  return (
    useLiveQuery(async () => {
      let all = await db.prompts.orderBy("updatedAt").reverse().toArray();

      // 快捷入口过滤
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
      }

      // AI 意图搜索结果优先
      if (intentResultIds) {
        const order = new Map(intentResultIds.map((id, i) => [id, i]));
        all = all
          .filter((p) => order.has(p.id))
          .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
      } else if (searchQuery.trim()) {
        // 关键词搜索
        const q = searchQuery.toLowerCase();
        all = all.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.body.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      // 筛选 chips
      if (filterTaskTypes.length > 0) {
        all = all.filter((p) => filterTaskTypes.includes(p.taskType));
      }
      if (filterDifficulties.length > 0) {
        all = all.filter((p) => filterDifficulties.includes(p.difficulty));
      }

      return all;
    }, [selectedScenarioId, searchQuery, filterTaskTypes, filterDifficulties, intentResultIds]) ?? []
  );
}
