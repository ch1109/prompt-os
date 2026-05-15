import { useState } from "react";
import { Search, Sparkles, X } from "lucide-react";
import { useUI } from "@/store/uiStore";
import { intentSearch } from "@/services/searcher";

export function SearchBar() {
  const { searchQuery, setSearchQuery, setIntentResultIds, setIntentMatch } = useUI();
  const [aiMode, setAiMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !aiMode || !searchQuery.trim()) return;
    setLoading(true);
    setError("");
    try {
      const match = await intentSearch(searchQuery);
      setIntentMatch(match);
      setIntentResultIds(match.prompts.map((r) => r.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 搜索失败");
      setIntentMatch(null);
      setIntentResultIds(null);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(q: string) {
    setSearchQuery(q);
    if (!aiMode) {
      setIntentResultIds(null);
      setIntentMatch(null);
    }
  }

  function handleClear() {
    setSearchQuery("");
    setIntentResultIds(null);
    setIntentMatch(null);
    setError("");
  }

  function toggleMode() {
    setAiMode((v) => !v);
    handleClear();
  }

  const hasValue = searchQuery.trim().length > 0;

  return (
    <div className="group flex min-h-11 items-center gap-3 rounded-xl border border-line/80 bg-canvas/70 px-3.5 shadow-[inset_0_1px_0_rgb(var(--paper)/0.86),0_10px_30px_-28px_rgb(var(--ink)/0.65)] transition focus-within:border-moss/[0.45] focus-within:bg-paper focus-within:shadow-[0_0_0_3px_rgb(var(--moss)/0.12),0_14px_34px_-30px_rgb(var(--ink)/0.75)]">
      <Search size={15} strokeWidth={1.8} className="shrink-0 text-hint transition group-focus-within:text-moss" />
      <input
        value={searchQuery}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={aiMode ? "描述意图，按 Enter 搜索…" : "搜索 Prompt、场景、工作流…  ( / )"}
        className="flex-1 bg-transparent text-[14.5px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-hint/75"
      />
      {loading && <span className="mono text-xs text-hint">搜索中…</span>}
      {error && <span className="max-w-[200px] truncate text-xs text-amber" title={error}>{error}</span>}
      {hasValue && !loading && (
        <button onClick={handleClear} className="rounded-md p-1.5 text-hint transition hover:bg-soft hover:text-ink">
          <X size={14} strokeWidth={1.8} />
        </button>
      )}
      <button
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
  );
}
