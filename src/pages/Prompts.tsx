import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Plus, Upload, Inbox } from "lucide-react";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { PromptList } from "@/components/prompt/PromptList";
import { PromptDetail } from "@/components/prompt/PromptDetail";
import { PromptEditor } from "@/components/prompt/PromptEditor";
import { Filters } from "@/components/prompt/Filters";
import { IntentResultPanel } from "@/components/prompt/IntentResultPanel";
import { useUI } from "@/store/uiStore";
import { db } from "@/db";

export default function Prompts() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { selectedPromptId } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const pendingCount =
    useLiveQuery(() => db.prompts.filter((p) => !!p.pendingReview).count()) ?? 0;

  function openNew() {
    setEditId(null);
    setEditorOpen(true);
  }

  // 支持 Command Palette 通过 #new hash 跳转打开新建编辑器
  useEffect(() => {
    if (location.hash === "#new") {
      openNew();
      navigate("/prompts", { replace: true });
    }
  }, [location.hash, navigate]);

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
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 md:px-4">
              <span className="text-sm font-medium text-sub">Prompt 库</span>
              <div className="flex items-center gap-1.5">
                <Link
                  to="/import"
                  title="批量导入"
                  className="inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-sub hover:bg-soft hover:text-ink"
                >
                  <Upload size={12} /> <span className="hidden sm:inline">批量导入</span>
                </Link>
                <Link
                  to="/pending"
                  title="待确认"
                  className="relative inline-flex items-center gap-1 rounded border border-line px-2 py-1 text-xs text-sub hover:bg-soft hover:text-ink"
                >
                  <Inbox size={12} /> <span className="hidden sm:inline">待确认</span>
                  {pendingCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-moss-soft px-1.5 text-[10px] font-medium tabular-nums text-moss">
                      {pendingCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={openNew}
                  className="inline-flex items-center gap-1 rounded bg-moss px-2.5 py-1 text-xs font-medium text-paper hover:bg-moss/90"
                >
                  <Plus size={13} /> 新建
                </button>
              </div>
            </div>
            <IntentResultPanel />
            <Filters />
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
