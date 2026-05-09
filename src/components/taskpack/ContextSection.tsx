import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, Plus, Pencil, Trash2, Check } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { updateContext, deleteContext } from "@/db/repos/contextRepo";
import { confirm } from "@/store/confirmStore";
import { ContextEditor } from "@/components/context/ContextEditor";

export function ContextSection() {
  const expanded = useUI((s) => s.contextSectionExpanded);
  const toggleExpanded = useUI((s) => s.toggleContextSection);
  const editor = useUI((s) => s.contextEditor);
  const openEditor = useUI((s) => s.openContextEditor);
  const closeEditor = useUI((s) => s.closeContextEditor);

  const contexts =
    useLiveQuery(() => db.contexts.orderBy("updatedAt").reverse().toArray()) ??
    [];
  const total = contexts.length;
  const defaultCount = contexts.filter((c) => c.isDefault).length;

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
      <div className="border-t border-line">
        <div className="group flex items-center text-[13px] text-sub hover:bg-soft/60 hover:text-ink">
          <button
            onClick={toggleExpanded}
            className="flex flex-1 items-center gap-1 px-3 py-[8px] text-left"
            aria-expanded={expanded}
          >
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={`shrink-0 text-hint transition-transform ${
                expanded ? "rotate-90" : ""
              }`}
            />
            <span className="flex-1 truncate text-[13px] font-semibold tracking-tight">
              上下文
            </span>
            {total > 0 && (
              <span className="mr-1 text-[11px] tabular-nums text-hint">
                {defaultCount > 0 ? (
                  <span className="text-moss">{defaultCount}</span>
                ) : null}
                {defaultCount > 0 && <span className="text-hint/60">/</span>}
                {total}
              </span>
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditor(null);
            }}
            title="新建上下文"
            aria-label="新建上下文"
            className="mr-2 rounded p-1 text-hint/70 transition hover:bg-paper hover:text-moss"
          >
            <Plus size={12} strokeWidth={1.8} />
          </button>
        </div>

        {expanded && (
          <ul className="max-h-[40vh] space-y-px overflow-y-auto px-1.5 pb-2 pl-7 pr-1">
            {contexts.length === 0 ? (
              <li>
                <button
                  onClick={() => openEditor(null)}
                  className="w-full rounded px-2 py-1 text-left text-[12px] italic text-hint transition hover:bg-soft hover:text-moss"
                >
                  暂无上下文，点击新建
                </button>
              </li>
            ) : (
              contexts.map((c) => (
                <li key={c.id}>
                  <div className="group/row flex items-center gap-1.5 rounded px-2 py-[5px] text-[13px] text-sub transition-colors hover:bg-soft/60 hover:text-ink">
                    <button
                      onClick={() => toggleDefault(c.id, c.isDefault)}
                      title={c.isDefault ? "取消默认" : "设为默认"}
                      aria-label={c.isDefault ? "取消默认" : "设为默认"}
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition ${
                        c.isDefault
                          ? "border-moss bg-moss text-paper"
                          : "border-line text-transparent hover:border-moss/60 hover:text-moss/40"
                      }`}
                    >
                      <Check size={9} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => openEditor(c.id)}
                      className="flex-1 truncate text-left"
                      title={`${c.type}：${c.content.slice(0, 80)}`}
                    >
                      {c.title}
                    </button>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover/row:opacity-100">
                      <button
                        onClick={() => openEditor(c.id)}
                        title="编辑"
                        aria-label="编辑上下文"
                        className="rounded p-1 text-hint/70 hover:bg-paper hover:text-moss"
                      >
                        <Pencil size={11} strokeWidth={1.8} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.title)}
                        title="删除"
                        aria-label="删除上下文"
                        className="rounded p-1 text-hint/70 hover:bg-paper hover:text-amber"
                      >
                        <Trash2 size={11} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                </li>
              ))
            )}
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
