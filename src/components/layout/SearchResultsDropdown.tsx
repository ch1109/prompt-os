import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FileText, Layers, Database, Sparkles } from "lucide-react";
import { useUI } from "@/store/uiStore";
import {
  scoreContext,
  scorePrompt,
  scoreTaskPack,
  snippetAroundMatch,
  topKeywordHits,
} from "@/services/keywordMatch";
import type { Prompt, TaskPack, Context } from "@/types";

type AssetKind = "prompt" | "taskPack" | "context";

function Subline({
  item,
  kind,
  query,
  reason,
}: {
  item: Prompt | TaskPack | Context;
  kind: AssetKind;
  query: string;
  reason?: string;
}) {
  const base = "mt-0.5 block text-[12.5px] text-hint";

  if (reason) {
    return <span className={`${base} truncate`}>{reason}</span>;
  }

  const q = query.trim();
  const titleHit = q && item.title.toLowerCase().includes(q.toLowerCase());

  if (q && !titleHit) {
    const longText =
      kind === "prompt"
        ? (item as Prompt).body
        : kind === "taskPack"
          ? (item as TaskPack).description
          : (item as Context).content;
    const snippet = snippetAroundMatch(longText ?? "", q);
    if (snippet) {
      return (
        <span className={`${base} line-clamp-2`}>
          {snippet.before}
          <mark className="dropdown-highlight">{snippet.match}</mark>
          {snippet.after}
        </span>
      );
    }
  }

  // title 命中 / tags-only / goal-only / 无 query：fallback 到原有 summary / taskIntent / goal
  let fallback = "";
  if (kind === "prompt") {
    const p = item as Prompt;
    fallback = p.summary || p.taskIntent || "";
  } else if (kind === "taskPack") {
    fallback = (item as TaskPack).goal || "";
  }
  if (!fallback) return null;
  return <span className={`${base} truncate`}>{fallback}</span>;
}

interface Props {
  query: string;
  aiMode: boolean;
  loading: boolean;
  error: string;
  allPrompts: Prompt[];
  allTaskPacks: TaskPack[];
  allContexts: Context[];
  onSelect: () => void;
}

type Hit<T> = { item: T; reason?: string };

const MAX_PER_GROUP = 8;

export function SearchResultsDropdown({
  query,
  aiMode,
  loading,
  error,
  allPrompts,
  allTaskPacks,
  allContexts,
  onSelect,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const intentMatch = useUI((s) => s.intentMatch);
  const setSelectedPrompt = useUI((s) => s.setSelectedPrompt);
  const setSelectedTaskPack = useUI((s) => s.setSelectedTaskPack);
  const openContextEditor = useUI((s) => s.openContextEditor);

  const q = query.trim().toLowerCase();

  const { promptHits, packHits, contextHits } = useMemo(() => {
    let pHits: Hit<Prompt>[] = [];
    let tHits: Hit<TaskPack>[] = [];
    let cHits: Hit<Context>[] = [];

    if (aiMode && intentMatch) {
      const pmap = new Map(allPrompts.map((p) => [p.id, p]));
      const tmap = new Map(allTaskPacks.map((t) => [t.id, t]));
      const cmap = new Map(allContexts.map((c) => [c.id, c]));
      pHits = intentMatch.prompts.flatMap((h) => {
        const item = pmap.get(h.id);
        return item ? [{ item, reason: h.reason }] : [];
      });
      tHits = (intentMatch.taskPacks ?? []).flatMap((h) => {
        const item = tmap.get(h.id);
        return item ? [{ item, reason: h.reason }] : [];
      });
      cHits = intentMatch.contexts.flatMap((h) => {
        const item = cmap.get(h.id);
        return item ? [{ item, reason: h.reason }] : [];
      });
    } else if (q) {
      // 关键词命中按字段权重打分：title=4 / summary|goal=2 / tags=2 / body|description|content=1。
      // 排序 score desc → updatedAt desc，让标题命中始终排在正文命中之前。
      pHits = topKeywordHits(allPrompts, scorePrompt, query, MAX_PER_GROUP).map((item) => ({ item }));
      tHits = topKeywordHits(allTaskPacks, scoreTaskPack, query, MAX_PER_GROUP).map((item) => ({ item }));
      cHits = topKeywordHits(allContexts, scoreContext, query, MAX_PER_GROUP).map((item) => ({ item }));
    }

    return { promptHits: pHits, packHits: tHits, contextHits: cHits };
  }, [aiMode, intentMatch, q, allPrompts, allTaskPacks, allContexts]);

  const total = promptHits.length + packHits.length + contextHits.length;
  const noQueryYet = q.length === 0 && (!aiMode || !intentMatch);
  const showEmpty = !loading && !noQueryYet && total === 0;

  function handlePromptClick(id: string) {
    setSelectedPrompt(id);
    const path = location.pathname;
    if (path !== "/" && path !== "/prompts") navigate("/prompts");
    onSelect();
  }

  function handlePackClick(id: string) {
    setSelectedTaskPack(id);
    setSelectedPrompt(null); // 避免回工作台时 PromptRunner 盖在 TaskPackWorkspace 上
    if (location.pathname !== "/") navigate("/");
    onSelect();
  }

  function handleContextClick(id: string) {
    // 工作台和 /contexts 都挂着 ContextEditor，其它路由才需要跳页
    const path = location.pathname;
    if (path !== "/" && path !== "/contexts") navigate("/contexts");
    openContextEditor(id);
    onSelect();
  }

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[calc(100vh-160px)] overflow-y-auto rounded-xl border border-line bg-paper shadow-[0_24px_60px_-18px_rgb(var(--ink)/0.55),0_0_0_1px_rgb(var(--line)/0.35)]">
      {loading && (
        <div className="flex items-center gap-2 px-4 py-3.5 text-[13px] text-hint">
          <Sparkles size={13} strokeWidth={1.8} className="animate-pulse text-moss" />
          AI 正在理解你的意图…
        </div>
      )}

      {!loading && error && <div className="px-4 py-3 text-[13px] text-amber">{error}</div>}

      {!loading && !error && noQueryYet && (
        <div className="px-4 py-3 text-[13px] italic text-hint">
          {aiMode ? "输入意图后按 Enter，让 AI 帮你找" : "输入关键词以搜索 Prompt、任务包或上下文"}
        </div>
      )}

      {showEmpty && (
        <div className="px-4 py-5 text-center text-[13px] italic text-hint">
          没有命中「{query.trim()}」相关的资产
        </div>
      )}

      {promptHits.length > 0 && (
        <SearchGroup label="Prompt" count={promptHits.length} icon={<FileText size={11} strokeWidth={2} />}>
          {promptHits.map(({ item, reason }) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePromptClick(item.id)}
              className="group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-soft"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-moss/50 group-hover:bg-moss" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{item.title}</span>
                <Subline item={item} kind="prompt" query={query} reason={reason} />
              </span>
            </button>
          ))}
        </SearchGroup>
      )}

      {packHits.length > 0 && (
        <SearchGroup label="任务包" count={packHits.length} icon={<Layers size={11} strokeWidth={2} />}>
          {packHits.map(({ item, reason }) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePackClick(item.id)}
              className="group flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-soft"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber/60 group-hover:bg-amber" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">
                  {item.title || <span className="italic text-hint">未命名任务包</span>}
                </span>
                <Subline item={item} kind="taskPack" query={query} reason={reason} />
              </span>
            </button>
          ))}
        </SearchGroup>
      )}

      {contextHits.length > 0 && (
        <SearchGroup label="上下文" count={contextHits.length} icon={<Database size={11} strokeWidth={2} />}>
          {contextHits.map(({ item, reason }) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleContextClick(item.id)}
              className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-soft"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/30 group-hover:bg-ink/60" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-ink">{item.title}</span>
                <Subline item={item} kind="context" query={query} reason={reason} />
              </span>
              <span className="shrink-0 rounded border border-line/70 bg-canvas/60 px-1.5 py-0.5 text-[10.5px] text-hint">
                {item.type}
              </span>
            </button>
          ))}
        </SearchGroup>
      )}

      {aiMode && intentMatch?.nextStep && (
        <div className="border-t border-line/60 bg-moss-soft/50 px-4 py-2.5 text-[12.5px] text-sub">
          <span className="mono uppercase tracking-wider2 text-moss">下一步</span>
          <span className="ml-2">{intentMatch.nextStep}</span>
        </div>
      )}
    </div>
  );
}

function SearchGroup({
  label,
  count,
  icon,
  children,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line/40 px-2 py-2 last:border-b-0">
      <div className="mono mb-1 flex items-center gap-1.5 px-2 text-[10.5px] uppercase tracking-wider2 text-hint">
        {icon}
        <span>{label}</span>
        <span className="text-hint/60">·</span>
        <span className="tabular-nums">{count}</span>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
