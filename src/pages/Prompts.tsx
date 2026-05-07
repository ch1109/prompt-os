import { useState } from "react";
import { Plus } from "lucide-react";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PromptList } from "@/components/prompt/PromptList";
import { PromptDetail } from "@/components/prompt/PromptDetail";
import { PromptEditor } from "@/components/prompt/PromptEditor";
import { useUI } from "@/store/uiStore";

export default function Prompts() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { selectedPromptId } = useUI();

  function openNew() {
    setEditId(null);
    setEditorOpen(true);
  }

  function openEdit(id: string) {
    setEditId(id);
    setEditorOpen(true);
  }

  return (
    <>
      <ThreeColumnLayout
        sidebar={<Sidebar />}
        main={
          <div className="page-enter">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-sm font-medium text-foreground/70">Prompt 库</span>
              <button
                onClick={openNew}
                className="inline-flex items-center gap-1 rounded bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/90"
              >
                <Plus size={13} /> 新建
              </button>
            </div>
            <PromptList onNew={openNew} />
          </div>
        }
        detail={
          selectedPromptId ? (
            <div className="detail-enter">
              <PromptDetail onEdit={openEdit} />
            </div>
          ) : undefined
        }
      />
      <PromptEditor
        open={editorOpen}
        editId={editId}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
}
