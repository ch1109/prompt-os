import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, Sparkles, X } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { intentSearch } from "@/services/searcher";
import { SearchResultsDropdown } from "./SearchResultsDropdown";

export function SearchBar() {
  const searchQuery = useUI((s) => s.searchQuery);
  const setSearchQuery = useUI((s) => s.setSearchQuery);
  const setIntentResultIds = useUI((s) => s.setIntentResultIds);
  const setIntentMatch = useUI((s) => s.setIntentMatch);

  const [aiMode, setAiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);
  const requestId = useRef(0);

  // 持续订阅三张表，避免 dropdown 反复 mount/unmount 时重订阅
  const allPrompts = useLiveQuery(() => db.prompts.toArray(), []);
  const allTaskPacks = useLiveQuery(() => db.taskPacks.toArray(), []);
  const allContexts = useLiveQuery(() => db.contexts.toArray(), []);

  useEffect(
    () => () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    },
    []
  );

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setDropdownOpen(false);
      e.currentTarget.blur();
      return;
    }
    if (e.key !== "Enter" || !aiMode || !searchQuery.trim()) return;
    const myId = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const match = await intentSearch(searchQuery);
      if (myId !== requestId.current) return; // 旧请求作废
      setIntentMatch(match);
      setIntentResultIds(match.prompts.map((r) => r.id));
    } catch (err) {
      if (myId !== requestId.current) return;
      setError(err instanceof Error ? err.message : "AI 搜索失败");
      setIntentMatch(null);
      setIntentResultIds(null);
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
  }

  function handleChange(q: string) {
    setSearchQuery(q);
    setDropdownOpen(true);
    setError("");
    if (!aiMode) {
      setIntentResultIds(null);
      setIntentMatch(null);
    }
  }

  function handleClear() {
    requestId.current++; // 作废任何进行中的 intentSearch
    setSearchQuery("");
    setIntentResultIds(null);
    setIntentMatch(null);
    setError("");
    setLoading(false);
  }

  function toggleMode() {
    setAiMode((v) => !v);
    handleClear();
  }

  function handleFocus() {
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setDropdownOpen(true);
  }

  function handleBlur() {
    blurTimer.current = window.setTimeout(() => {
      setDropdownOpen(false);
      blurTimer.current = null;
    }, 150);
  }

  const hasValue = searchQuery.trim().length > 0;

  return (
    <div className="relative">
      <div className="group flex min-h-11 items-center gap-3 rounded-xl border border-line/80 bg-canvas/70 px-3.5 shadow-[inset_0_1px_0_rgb(var(--paper)/0.86),0_10px_30px_-28px_rgb(var(--ink)/0.65)] transition focus-within:border-moss/[0.45] focus-within:bg-paper focus-within:shadow-[0_0_0_3px_rgb(var(--moss)/0.12),0_14px_34px_-30px_rgb(var(--ink)/0.75)]">
        <Search size={15} strokeWidth={1.8} className="shrink-0 text-hint transition group-focus-within:text-moss" />
        <input
          value={searchQuery}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={aiMode ? "描述意图，按 Enter 搜索…" : "搜索 Prompt、任务包、上下文…  ( / )"}
          className="flex-1 bg-transparent text-[14.5px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-hint/75"
        />
        {loading && <span className="mono text-xs text-hint">搜索中…</span>}
        {error && <span className="max-w-[200px] truncate text-xs text-amber" title={error}>{error}</span>}
        {hasValue && !loading && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
            className="rounded-md p-1.5 text-hint transition hover:bg-soft hover:text-ink"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={toggleMode}
          title={aiMode ? "切换到关键词搜索" : "切换到 AI 意图搜索（需设置 API Key）"}
          className={`mono flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-xs uppercase tracking-wider2 transition ${
            aiMode
              ? "border-moss/20 bg-moss text-paper shadow-[0_8px_18px_-14px_rgb(var(--moss)/0.9)]"
              : "border-line/70 bg-paper/70 text-hint hover:border-line hover:bg-soft hover:text-ink"
          }`}
        >
          <Sparkles size={12} strokeWidth={1.8} />
          AI
        </button>
      </div>

      {dropdownOpen && (
        <SearchResultsDropdown
          query={searchQuery}
          aiMode={aiMode}
          loading={loading}
          error={error}
          allPrompts={allPrompts ?? []}
          allTaskPacks={allTaskPacks ?? []}
          allContexts={allContexts ?? []}
          onSelect={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}
