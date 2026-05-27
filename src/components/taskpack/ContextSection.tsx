import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { updateContext, deleteContext } from "@/db/repos/contextRepo";
import { confirm } from "@/store/confirmStore";
import { ContextEditor } from "@/components/context/ContextEditor";
import type { Context, ContextType } from "@/types";

const CONTEXT_TYPE_ORDER: readonly ContextType[] = [
  "角色人格",
  "用户背景",
  "项目背景",
  "领域知识",
  "输出规范",
  "风格指南",
  "参考样例",
  "约束规则",
  "自定义",
];

const EMPTY_CONTEXTS: Context[] = [];

export function ContextSection() {
  const expanded = useUI((s) => s.contextSectionExpanded);
  const toggleExpanded = useUI((s) => s.toggleContextSection);
  const editor = useUI((s) => s.contextEditor);
  const openEditor = useUI((s) => s.openContextEditor);
  const closeEditor = useUI((s) => s.closeContextEditor);

  const contexts =
    useLiveQuery(() => db.contexts.orderBy("updatedAt").reverse().toArray()) ??
    EMPTY_CONTEXTS;

  const grouped = useMemo(() => {
    const buckets = new Map<ContextType, Context[]>();
    for (const c of contexts) {
      const arr = buckets.get(c.type) ?? [];
      arr.push(c);
      buckets.set(c.type, arr);
    }
    for (const arr of buckets.values()) {
      arr.sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      });
    }
    return CONTEXT_TYPE_ORDER.map(
      (t) => [t, buckets.get(t) ?? []] as const,
    ).filter(([, arr]) => arr.length > 0);
  }, [contexts]);

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

  async function toggleDefault(id: string, current: boolean) {
    await updateContext(id, { isDefault: !current });
  }

  return (
    <>
      <div className="px-3 pb-3 pt-1">
        <div className="overflow-hidden rounded-xl border border-line bg-soft/40">
          <div className="flex items-center gap-2.5 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-moss-soft/70 text-moss">
              <BookOpen size={14} strokeWidth={2} />
            </span>

            <button
              onClick={toggleExpanded}
              className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              aria-expanded={expanded}
              title="点击展开 / 收起常用上下文列表"
            >
              <span className="text-[13.5px] font-medium text-ink">
                上下文库
              </span>
              <ChevronDown
                size={12}
                strokeWidth={2}
                className={`text-hint transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>

            <div className="flex shrink-0 items-center gap-0.5">
              <Link
                to="/contexts"
                title="打开上下文库"
                aria-label="打开上下文库"
                className="rounded-md p-1.5 text-hint/70 transition hover:bg-paper hover:text-ink"
              >
                <ExternalLink size={12} strokeWidth={1.8} />
              </Link>
              <button
                onClick={() => openEditor(null)}
                title="新建上下文"
                aria-label="新建上下文"
                className="rounded-md p-1.5 text-hint/70 transition hover:bg-paper hover:text-moss"
              >
                <Plus size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {expanded && (
            <div className="max-h-[40vh] overflow-y-auto border-t border-line/60 bg-paper/40 px-2 py-2">
              {contexts.length === 0 ? (
                <button
                  onClick={() => openEditor(null)}
                  className="w-full rounded-md px-2.5 py-2 text-left text-[12.5px] italic text-hint transition hover:bg-soft hover:text-moss"
                >
                  暂无上下文，点击新建第一条
                </button>
              ) : (
                grouped.map(([type, items]) => (
                  <div key={type} className="mb-1.5 last:mb-0">
                    <div className="flex items-baseline gap-1.5 px-2 pb-0.5 pt-1.5 text-[11px] text-sub">
                      <span className="font-medium">{type}</span>
                      <span className="text-hint/70">· {items.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      {items.map((c) => (
                        <ContextRow
                          key={c.id}
                          ctx={c}
                          onToggleDefault={() =>
                            toggleDefault(c.id, c.isDefault)
                          }
                          onEdit={() => openEditor(c.id)}
                          onDelete={() => handleDelete(c.id, c.title)}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ContextEditor
        open={editor.open}
        editId={editor.editId}
        onClose={closeEditor}
      />
    </>
  );
}

function ContextRow({
  ctx,
  onToggleDefault,
  onEdit,
  onDelete,
}: {
  ctx: Context;
  onToggleDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group/row flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-soft/70">
      <button
        onClick={onToggleDefault}
        title={ctx.isDefault ? "取消固定" : "固定为常用"}
        aria-label={ctx.isDefault ? "取消固定" : "固定为常用"}
        aria-pressed={ctx.isDefault}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition ${
          ctx.isDefault
            ? "bg-moss-soft text-moss"
            : "text-hint/40 hover:bg-soft hover:text-moss/60"
        }`}
      >
        <Pin
          size={11}
          strokeWidth={2}
          className={ctx.isDefault ? "fill-moss" : ""}
        />
      </button>
      <button
        onClick={onEdit}
        className="min-w-0 flex-1 truncate text-left text-[13px] text-sub transition-colors group-hover/row:text-ink"
        title={`${ctx.type}：${ctx.content.slice(0, 80)}`}
      >
        {ctx.title}
      </button>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/row:opacity-100">
        <button
          onClick={onEdit}
          title="编辑"
          aria-label="编辑上下文"
          className="rounded-md p-1 text-hint/70 hover:bg-paper hover:text-moss"
        >
          <Pencil size={12} strokeWidth={1.8} />
        </button>
        <button
          onClick={onDelete}
          title="删除"
          aria-label="删除上下文"
          className="rounded-md p-1 text-hint/70 hover:bg-paper hover:text-amber"
        >
          <Trash2 size={12} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
