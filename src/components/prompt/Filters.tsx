import { useUI } from "@/store/uiStore";

const TASK_TYPES = ["分析", "生成", "改写", "总结", "规划", "决策", "复盘"];
const DIFFICULTIES = ["初级", "中级", "高级"];
const FILTER_BUTTON_BASE = "rounded-full border px-3 py-1.5 text-[13px] font-medium transition";
const FILTER_BUTTON_ACTIVE =
  "border-moss/25 bg-moss text-paper shadow-[0_8px_18px_-16px_rgb(var(--moss)/0.8)]";
const FILTER_BUTTON_IDLE =
  "border-line/[0.65] bg-paper/60 text-sub hover:border-line hover:bg-soft hover:text-ink";

function getFilterButtonClass(isActive: boolean): string {
  return `${FILTER_BUTTON_BASE} ${isActive ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_IDLE}`;
}

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

  function clearFilters() {
    setFilterTaskTypes([]);
    setFilterDifficulties([]);
  }

  const hasFilter = filterTaskTypes.length > 0 || filterDifficulties.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line/70 bg-canvas/[0.45] px-3.5 py-2.5 md:px-5">
      <span className="mono mr-0.5 text-xs font-semibold uppercase tracking-wider2 text-hint">
        筛选
      </span>
      {TASK_TYPES.map((t) => (
        <button
          key={t}
          onClick={() => toggleTaskType(t)}
          className={getFilterButtonClass(filterTaskTypes.includes(t))}
        >
          {t}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-line" />
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => toggleDifficulty(d)}
          className={getFilterButtonClass(filterDifficulties.includes(d))}
        >
          {d}
        </button>
      ))}
      {hasFilter && (
        <button
          onClick={clearFilters}
          className="ml-1 rounded-full px-3 py-1.5 text-[13px] font-medium text-hint transition hover:bg-soft hover:text-ink"
        >
          清除
        </button>
      )}
    </div>
  );
}
