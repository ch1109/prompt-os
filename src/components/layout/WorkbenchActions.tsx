import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { updateTaskPack } from "@/db/repos/taskPackRepo";
import { useUI } from "@/store/uiStore";
import { toast } from "@/store/toastStore";
import { nanoid } from "nanoid";

/**
 * 顶栏右上的 3 个全局动作按钮：
 *   + 新增子场景：始终可点 → 进入 draft 待提交态
 *   + 新增阶段：需选中子场景 → 追加空阶段
 *   + 新增 Prompt：需选中子场景 → 在选中阶段（或末阶段）下打开 popover
 */
export function WorkbenchActions() {
  const navigate = useNavigate();
  const {
    selectedTaskPackId,
    selectedStageId,
    setSelectedStage,
    beginCreateTaskPack,
  } = useUI();

  const canStageOrPrompt = !!selectedTaskPackId;

  function ensureWorkbench() {
    if (window.location.pathname !== "/") navigate("/");
  }

  function handleNewPack() {
    ensureWorkbench();
    beginCreateTaskPack();
  }

  async function handleNewStage() {
    if (!selectedTaskPackId) return;
    ensureWorkbench();
    const pack = await db.taskPacks.get(selectedTaskPackId);
    if (!pack) return;
    const stage = {
      id: nanoid(),
      name: "",
      description: "",
      promptIds: [],
      order: pack.stages.length,
    };
    await updateTaskPack(pack.id, { stages: [...pack.stages, stage] });
    setSelectedStage(stage.id);
    // 滚动到底，让用户看到新阶段
    setTimeout(() => {
      const main = document.querySelector('section[class*="overflow-y-auto"]');
      main?.scrollTo({ top: main.scrollHeight, behavior: "smooth" });
    }, 50);
  }

  async function handleNewPrompt() {
    if (!selectedTaskPackId) return;
    ensureWorkbench();
    const pack = await db.taskPacks.get(selectedTaskPackId);
    if (!pack) return;
    if (pack.stages.length === 0) {
      toast.error("请先添加一个阶段");
      return;
    }
    const targetStage =
      pack.stages.find((s) => s.id === selectedStageId) ??
      pack.stages[pack.stages.length - 1];
    setSelectedStage(targetStage.id);
    // 通过 dataset 标记触发该阶段的 popover 自动打开（由 TaskPackWorkspace 监听）
    window.dispatchEvent(
      new CustomEvent("workbench:open-add-prompt", {
        detail: { stageId: targetStage.id },
      })
    );
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <button
        onClick={handleNewPack}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-sub transition hover:bg-soft hover:text-ink"
      >
        <Plus size={14} strokeWidth={1.8} /> 新增子场景
      </button>
      <button
        onClick={handleNewStage}
        disabled={!canStageOrPrompt}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper px-3 py-1.5 text-[13px] font-medium text-sub transition hover:bg-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-sub"
      >
        <Plus size={14} strokeWidth={1.8} /> 新增阶段
      </button>
      <button
        onClick={handleNewPrompt}
        disabled={!canStageOrPrompt}
        className="inline-flex items-center gap-1.5 rounded-lg bg-moss px-3.5 py-1.5 text-[13px] font-semibold text-paper shadow-[0_10px_22px_-16px_rgb(var(--moss)/0.85)] transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-moss"
      >
        <Plus size={14} strokeWidth={1.8} /> 新增 Prompt
      </button>
    </div>
  );
}
