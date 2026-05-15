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

const HEADER_LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-line/75 bg-paper/70 px-3 py-1.5 text-[13px] font-medium text-sub transition hover:border-line hover:bg-soft hover:text-ink";
const HEADER_PRIMARY_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-full bg-moss px-3.5 py-1.5 text-[13px] font-semibold text-paper shadow-[0_10px_22px_-16px_rgb(var(--moss)/0.85)] transition hover:bg-moss/90";

export default function Prompts() {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const { selectedPromptId, setSelectedPrompt } = useUI();
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
      const timer = window.setTimeout(() => {
        openNew();
        navigate("/prompts", { replace: true });
      }, 0);
      return () => window.clearTimeout(timer);
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
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line/75 bg-canvas/[0.55] px-3.5 py-3 backdrop-blur md:px-5">
              <span className="mono text-xs font-semibold uppercase tracking-wider2 text-sub">
                Prompt 库
              </span>
              <div className="flex items-center gap-1.5">
                <Link
                  to="/import"
                  title="批量导入"
                  className={HEADER_LINK_CLASS}
                >
                  <Upload size={14} /> <span className="hidden sm:inline">批量导入</span>
                </Link>
                <Link
                  to="/pending"
                  title="待确认"
                  className={`relative ${HEADER_LINK_CLASS}`}
                >
                  <Inbox size={14} /> <span className="hidden sm:inline">待确认</span>
                  {pendingCount > 0 && (
                    <span className="ml-0.5 rounded-full bg-moss-soft px-1.5 text-[11px] font-medium tabular-nums text-moss">
                      {pendingCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={openNew}
                  className={HEADER_PRIMARY_BUTTON_CLASS}
                >
                  <Plus size={15} /> 新建
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
        detailWidthClass="md:w-[380px] lg:w-[460px] xl:w-[520px]"
        onDetailClose={() => setSelectedPrompt(null)}
      />
      <PromptEditor
        open={editorOpen}
        editId={editId}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
}
