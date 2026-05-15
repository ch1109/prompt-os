import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, Clipboard, Plus, Search, Sparkles } from "lucide-react";
import { db } from "@/db";
import { createPrompt } from "@/db/repos/promptRepo";
import { toast } from "@/store/toastStore";
import type { Prompt } from "@/types";

interface Props {
  existingPromptIds: string[];
  preferredSceneTitle?: string;
  onPick: (promptId: string) => void;
  onClose: () => void;
}

const MAX_SUGGESTIONS = 6;

export function AddPromptPopover({
  existingPromptIds,
  preferredSceneTitle,
  onPick,
  onClose,
}: Props) {
  const [pasteMode, setPasteMode] = useState(false);

  // 搜索/起名态
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 粘贴态
  const [pastedBody, setPastedBody] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedSummary, setPastedSummary] = useState("");
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const allPromptsRaw = useLiveQuery(() => db.prompts.toArray());
  const allPrompts = useMemo(() => allPromptsRaw ?? [], [allPromptsRaw]);

  useEffect(() => {
    if (pasteMode) pasteRef.current?.focus();
    else inputRef.current?.focus();
  }, [pasteMode]);

  // 外部点击关闭
  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    window.addEventListener("pointerdown", onPointer);
    return () => window.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  const matches = useMemo<Prompt[]>(() => {
    const existing = new Set(existingPromptIds);
    const q = query.trim().toLowerCase();
    let pool = allPrompts.filter((p) => !existing.has(p.id));
    if (q) {
      pool = pool.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    pool.sort((a, b) => {
      const aHit = a.primaryScenario?.[0] === preferredSceneTitle ? 0 : 1;
      const bHit = b.primaryScenario?.[0] === preferredSceneTitle ? 0 : 1;
      if (aHit !== bHit) return aHit - bHit;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
    return pool.slice(0, MAX_SUGGESTIONS);
  }, [allPrompts, existingPromptIds, query, preferredSceneTitle]);

  const showCreateRow = query.trim().length > 0;
  const totalRows = matches.length + (showCreateRow ? 1 : 0);

  useEffect(() => {
    queueMicrotask(() => setActiveIdx(0));
  }, [query]);

  async function handleCreateByTitle() {
    const title = query.trim();
    if (!title) return;
    const p = await createPrompt({ title, body: "" });
    toast.success("已新建 Prompt，请在右侧补充内容");
    onPick(p.id);
  }

  async function handlePasteCreate() {
    const body = pastedBody.trim();
    if (!body) {
      toast.error("请先粘贴 Prompt 内容");
      return;
    }
    const fallbackTitle =
      body.slice(0, 30).split("\n")[0].trim() || "未命名 Prompt";
    const title = pastedTitle.trim() || fallbackTitle;
    const p = await createPrompt({ title, body, summary: pastedSummary.trim() });
    toast.success(`已创建 Prompt「${title}」`);
    onPick(p.id);
  }

  function enterPasteMode() {
    setPasteMode(true);
    setQuery("");
    setActiveIdx(0);
  }

  function exitPasteMode() {
    setPasteMode(false);
    setPastedBody("");
    setPastedTitle("");
    setPastedSummary("");
  }

  function onSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(totalRows - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx < matches.length) {
        const target = matches[activeIdx];
        if (target) onPick(target.id);
      } else if (showCreateRow) {
        handleCreateByTitle();
      }
    }
  }

  function onPasteKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      exitPasteMode();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void handlePasteCreate();
    }
  }

  return (
    <div
      ref={containerRef}
      className="absolute left-0 right-0 top-full z-30 mt-1 max-w-lg rounded-xl border border-line bg-paper shadow-[0_8px_32px_-8px_rgba(20,20,18,0.18)]"
      onClick={(e) => e.stopPropagation()}
    >
      {pasteMode ? (
        <PasteView
          pastedBody={pastedBody}
          pastedTitle={pastedTitle}
          pastedSummary={pastedSummary}
          onBodyChange={setPastedBody}
          onTitleChange={setPastedTitle}
          onSummaryChange={setPastedSummary}
          onSubmit={handlePasteCreate}
          onBack={exitPasteMode}
          onKeyDown={onPasteKeyDown}
          textareaRef={pasteRef}
        />
      ) : (
        <SearchView
          query={query}
          activeIdx={activeIdx}
          matches={matches}
          showCreateRow={showCreateRow}
          preferredSceneTitle={preferredSceneTitle}
          onQueryChange={setQuery}
          onActiveIdxChange={setActiveIdx}
          onPick={onPick}
          onCreateByTitle={handleCreateByTitle}
          onEnterPasteMode={enterPasteMode}
          onKeyDown={onSearchKeyDown}
          inputRef={inputRef}
        />
      )}
    </div>
  );
}

function SearchView({
  query,
  activeIdx,
  matches,
  showCreateRow,
  preferredSceneTitle,
  onQueryChange,
  onActiveIdxChange,
  onPick,
  onCreateByTitle,
  onEnterPasteMode,
  onKeyDown,
  inputRef,
}: {
  query: string;
  activeIdx: number;
  matches: Prompt[];
  showCreateRow: boolean;
  preferredSceneTitle?: string;
  onQueryChange: (q: string) => void;
  onActiveIdxChange: (i: number) => void;
  onPick: (id: string) => void;
  onCreateByTitle: () => void;
  onEnterPasteMode: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <Search size={15} strokeWidth={1.7} className="shrink-0 text-hint" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="搜索已有 Prompt 或新建一条…"
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-hint"
        />
      </div>

      <ul className="max-h-80 overflow-y-auto p-1.5">
        {matches.length === 0 && !showCreateRow && (
          <li className="px-3 py-5 text-center text-[13.5px] text-hint">
            没有匹配的 Prompt，输入名称即可新建
          </li>
        )}
        {matches.map((p, i) => {
          const active = activeIdx === i;
          const sceneHit =
            !!preferredSceneTitle &&
            p.primaryScenario?.[0] === preferredSceneTitle;
          return (
            <li key={p.id}>
              <button
                onClick={() => onPick(p.id)}
                onMouseEnter={() => onActiveIdxChange(i)}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                  active ? "bg-moss-soft text-ink" : "text-sub hover:bg-soft"
                }`}
              >
                <span className="mt-0.5 text-hint">·</span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="min-w-0 truncate text-[14px] font-medium text-ink">
                      {p.title}
                    </span>
                    {sceneHit && (
                      <span className="chip-mono shrink-0 rounded bg-moss-soft px-1.5 py-0.5 text-[10px] uppercase text-moss">
                        本场景
                      </span>
                    )}
                  </span>
                  {p.summary && (
                    <span className="mt-1 block truncate text-[13px] text-hint">
                      {p.summary}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {showCreateRow && (
          <li>
            <button
              onClick={onCreateByTitle}
              onMouseEnter={() => onActiveIdxChange(matches.length)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                activeIdx === matches.length
                  ? "bg-moss-soft text-moss"
                  : "text-moss hover:bg-soft"
              }`}
            >
              <Plus size={15} strokeWidth={2} />
              <span className="min-w-0 flex-1 truncate text-[13.5px]">
                新建 Prompt：「
                <span className="font-medium">{query.trim()}</span>」
              </span>
              <Sparkles size={12} strokeWidth={1.6} className="shrink-0 text-moss/60" />
            </button>
          </li>
        )}
      </ul>

      {/* 粘贴入口（独立按钮） */}
      <button
        onClick={onEnterPasteMode}
        className="flex w-full items-center gap-2.5 border-t border-line px-3.5 py-2.5 text-left text-[13.5px] text-sub transition hover:bg-soft hover:text-ink"
      >
        <Clipboard size={14} strokeWidth={1.7} className="shrink-0 text-hint" />
        <span className="flex-1">粘贴一段 Prompt 内容创建</span>
        <span className="text-xs text-hint">直接贴过来</span>
      </button>

      <div className="flex items-center justify-between border-t border-line px-3.5 py-2 text-xs text-hint">
        <span>
          <kbd className="mono rounded border border-line bg-canvas px-1">↑↓</kbd> 选择 ·
          <kbd className="mono ml-1 rounded border border-line bg-canvas px-1">↵</kbd> 确认
        </span>
        <span>
          <kbd className="mono rounded border border-line bg-canvas px-1">esc</kbd> 关闭
        </span>
      </div>
    </>
  );
}

function PasteView({
  pastedBody,
  pastedTitle,
  pastedSummary,
  onBodyChange,
  onTitleChange,
  onSummaryChange,
  onSubmit,
  onBack,
  onKeyDown,
  textareaRef,
}: {
  pastedBody: string;
  pastedTitle: string;
  pastedSummary: string;
  onBodyChange: (v: string) => void;
  onTitleChange: (v: string) => void;
  onSummaryChange: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const fallbackPreview =
    pastedBody.slice(0, 30).split("\n")[0].trim() || "未命名 Prompt";
  const titleToUse = pastedTitle.trim() || fallbackPreview;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <button
          onClick={onBack}
          title="返回搜索"
          className="rounded-md p-1.5 text-hint hover:bg-soft hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={1.7} />
        </button>
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
          粘贴 Prompt 内容
        </span>
        <span className="text-xs text-hint">⌘↵ 提交</span>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <textarea
          ref={textareaRef}
          value={pastedBody}
          onChange={(e) => onBodyChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={8}
          placeholder="把从外面复制来的 Prompt 内容粘进来…&#10;支持 Markdown、{{变量}} 占位符"
          className="input w-full resize-y text-[14px] leading-relaxed"
        />
        <div>
          <label className="mb-1.5 block text-xs text-sub">
            标题
            <span className="ml-1 text-hint">（选填，留空用内容前 30 字）</span>
          </label>
          <input
            value={pastedTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={pastedBody ? `留空将用「${fallbackPreview}」` : "Prompt 标题"}
            className="input text-[14px]"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs text-sub">摘要</label>
          <input
            value={pastedSummary}
            onChange={(e) => onSummaryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="一句话描述用途"
            className="input text-[14px]"
          />
        </div>
        {pastedBody.trim() && (
          <p className="text-xs text-hint">
            将创建 Prompt：
            <span className="font-medium text-sub">「{titleToUse}」</span>
            {pastedTitle.trim() ? null : (
              <span className="text-hint"> · 标题来自正文前 30 字</span>
            )}
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-line px-3.5 py-2.5">
        <button
          onClick={onSubmit}
          disabled={!pastedBody.trim()}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-moss px-3 py-2 text-[13.5px] font-semibold text-paper transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} strokeWidth={2} />
          创建并加入阶段
        </button>
        <button
          onClick={onBack}
          className="rounded-lg border border-line bg-canvas px-3.5 py-2 text-[13.5px] text-sub hover:bg-soft hover:text-ink"
        >
          返回搜索
        </button>
      </div>
    </>
  );
}
