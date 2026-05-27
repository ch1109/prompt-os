import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { ContextEditor } from "@/components/context/ContextEditor";
import { deleteContext, getTriggerStrategy } from "@/db/repos/contextRepo";
import { confirm } from "@/store/confirmStore";
import { CONTEXT_TYPE_OPTIONS } from "@/components/context/contextTypes";
import {
  useAllContextReferenceCounts,
  type ContextReferenceCount,
} from "@/hooks/useContextReferenceCount";
import type { ContextScope, ContextTriggerStrategy, ContextType } from "@/types";

const HEADER_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-full bg-moss px-3.5 py-1.5 text-[13px] font-semibold text-paper shadow-[0_10px_22px_-16px_rgb(var(--moss)/0.85)] transition hover:bg-moss/90";

const STRATEGY_LABEL: Record<ContextTriggerStrategy, string> = {
  always: "始终",
  manual: "手动",
  conditional: "条件",
};

const SCOPE_LABEL: Record<ContextScope, string> = {
  global: "全局",
  scene_category: "场景大类",
  sub_scene: "子场景",
};

const EMPTY_CONTEXTS: import("@/types").Context[] = [];

export default function Contexts() {
  const contextsRaw = useLiveQuery(() =>
    db.contexts.orderBy("updatedAt").reverse().toArray()
  );
  const contexts = contextsRaw ?? EMPTY_CONTEXTS;
  const editor = useUI((s) => s.contextEditor);
  const openEditor = useUI((s) => s.openContextEditor);
  const closeEditor = useUI((s) => s.closeContextEditor);
  const refCounts = useAllContextReferenceCounts();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContextType | "ALL">("ALL");
  const [strategyFilter, setStrategyFilter] = useState<ContextTriggerStrategy | "ALL">(
    "ALL"
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contexts.filter((c) => {
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      const strategy = getTriggerStrategy(c);
      if (strategyFilter !== "ALL" && strategy !== strategyFilter) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.content.toLowerCase().includes(q) ||
        (c.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [contexts, query, typeFilter, strategyFilter]);

  async function handleDelete(id: string, title: string) {
    const ok = await confirm({
      title: "确认删除该上下文？",
      message: `「${title}」删除后无法恢复。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await deleteContext(id);
  }

  return (
    <>
      <div className="page-enter mx-auto flex h-full max-w-6xl flex-col px-4 py-6 md:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mono text-xs font-semibold uppercase tracking-wider2 text-sub">
              Context Library
            </div>
            <h1 className="mt-1 font-serif text-2xl text-ink">上下文库</h1>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-hint">
              可复用的提示片段。配置类型、触发策略与作用域后，Prompt 调用时会按规则自动附加。
            </p>
          </div>
          <button onClick={() => openEditor(null)} className={HEADER_PRIMARY}>
            <Plus size={15} /> 新建上下文
          </button>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-hint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索标题、正文、标签"
              className="w-full rounded-md border border-line bg-paper py-1.5 pl-8 pr-2.5 text-sm text-ink placeholder:text-hint focus:border-moss focus:outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ContextType | "ALL")}
            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="ALL">全部类型</option>
            {CONTEXT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={strategyFilter}
            onChange={(e) =>
              setStrategyFilter(e.target.value as ContextTriggerStrategy | "ALL")
            }
            className="rounded-md border border-line bg-paper px-2 py-1.5 text-sm text-ink"
          >
            <option value="ALL">全部策略</option>
            <option value="always">始终启用</option>
            <option value="manual">手动选择</option>
            <option value="conditional">条件触发</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-soft/40 py-12 text-center">
            <p className="text-sm text-hint">
              {contexts.length === 0
                ? "暂无上下文，点击右上角「新建上下文」开始"
                : "没有匹配的上下文"}
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <ContextCard
                key={c.id}
                context={c}
                refCount={refCounts.get(c.id) ?? ZERO_REF}
                onEdit={() => openEditor(c.id)}
                onDelete={() => handleDelete(c.id, c.title)}
              />
            ))}
          </ul>
        )}
      </div>
      <ContextEditor
        open={editor.open}
        editId={editor.editId}
        onClose={closeEditor}
      />
    </>
  );
}

const ZERO_REF: ContextReferenceCount = {
  promptCount: 0,
  scenarioCount: 0,
  total: 0,
};

function ContextCard({
  context: c,
  refCount,
  onEdit,
  onDelete,
}: {
  context: import("@/types").Context;
  refCount: ContextReferenceCount;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const strategy = getTriggerStrategy(c);
  return (
    <li className="group flex flex-col gap-2 rounded-lg border border-line bg-paper p-3 transition hover:border-moss/40 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
          title={c.description || c.title}
        >
          <div className="truncate text-sm font-medium text-ink">{c.title}</div>
          {c.description && (
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-hint">
              {c.description}
            </div>
          )}
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
          <button
            onClick={onEdit}
            title="编辑"
            className="rounded-md p-1 text-hint hover:bg-soft hover:text-moss"
          >
            <Pencil size={12} strokeWidth={1.8} />
          </button>
          <button
            onClick={onDelete}
            title="删除"
            className="rounded-md p-1 text-hint hover:bg-soft hover:text-amber"
          >
            <Trash2 size={12} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <p className="line-clamp-3 text-[12px] leading-snug text-sub">
        {c.content}
      </p>

      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="rounded bg-soft px-1.5 py-0.5 text-sub">{c.type}</span>
        <span
          className={`rounded px-1.5 py-0.5 ${
            strategy === "always"
              ? "bg-moss-soft text-moss"
              : strategy === "conditional"
              ? "bg-amber-soft text-amber"
              : "bg-soft text-hint"
          }`}
        >
          {STRATEGY_LABEL[strategy]}
        </span>
        <span className="rounded bg-soft px-1.5 py-0.5 text-sub">
          {SCOPE_LABEL[c.scope ?? "global"]}
        </span>
        {refCount.total > 0 && (
          <span
            title={`${refCount.promptCount} Prompt · ${refCount.scenarioCount} 场景`}
            className="ml-auto rounded bg-soft px-1.5 py-0.5 tabular-nums text-hint"
          >
            引用 {refCount.total}
          </span>
        )}
      </div>
    </li>
  );
}
