import { useUI } from "@/store/uiStore";

const TASK_TYPES = ["分析", "生成", "改写", "总结", "规划", "决策", "复盘"];
const DIFFICULTIES = ["初级", "中级", "高级"];

export function Filters() {
  const { filterTaskTypes, filterDifficulties, setFilterTaskTypes, setFilterDifficulties } = useUI();

  function toggleTaskType(t: string) {
    setFilterTaskTypes(
      filterTaskTypes.includes(t) ? filterTaskTypes.filter((x) => x !== t) : [...filterTaskTypes, t]
    );
  }

  function toggleDifficulty(d: string) {
    setFilterDifficulties(
      filterDifficulties.includes(d)
        ? filterDifficulties.filter((x) => x !== d)
        : [...filterDifficulties, d]
    );
  }

  const hasFilter = filterTaskTypes.length > 0 || filterDifficulties.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2 md:px-4">
      {TASK_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => toggleTaskType(t)}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            filterTaskTypes.includes(t)
              ? "bg-moss text-paper"
              : "bg-soft text-sub hover:text-ink"
          }`}
        >
          {t}
        </button>
      ))}
      <span className="text-hint/50">|</span>
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => toggleDifficulty(d)}
          className={`rounded px-2 py-0.5 text-xs transition-colors ${
            filterDifficulties.includes(d)
              ? "bg-moss text-paper"
              : "bg-soft text-sub hover:text-ink"
          }`}
        >
          {d}
        </button>
      ))}
      {hasFilter && (
        <button
          onClick={() => { setFilterTaskTypes([]); setFilterDifficulties([]); }}
          className="ml-1 text-xs text-hint hover:text-ink"
        >
          清除
        </button>
      )}
    </div>
  );
}
