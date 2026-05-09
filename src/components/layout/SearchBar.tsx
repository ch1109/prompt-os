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

  const hasValue = searchQuery.trim();

  return (
    <div className="flex items-center gap-2.5">
      <Search size={14} strokeWidth={1.7} className="shrink-0 text-hint" />
      <input
        value={searchQuery}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={aiMode ? "描述意图，按 Enter 搜索…" : "搜索 Prompt、场景、工作流…  ( / )"}
        className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-hint/80"
      />
      {loading && <span className="text-2xs text-hint">搜索中…</span>}
      {error && <span className="max-w-[200px] truncate text-2xs text-red-500" title={error}>{error}</span>}
      {hasValue && !loading && (
        <button onClick={handleClear} className="rounded p-1 text-hint hover:bg-soft hover:text-ink">
          <X size={13} strokeWidth={1.8} />
        </button>
      )}
      <button
        onClick={toggleMode}
        title={aiMode ? "切换到关键词搜索" : "切换到 AI 意图搜索（需设置 API Key）"}
        className={`mono flex items-center gap-1 rounded px-2 py-[3px] text-2xs uppercase tracking-wider2 transition-colors ${
          aiMode
            ? "bg-moss-soft text-moss font-medium"
            : "text-hint hover:bg-soft hover:text-ink"
        }`}
      >
        <Sparkles size={11} strokeWidth={1.8} />
        AI
      </button>
    </div>
  );
}
