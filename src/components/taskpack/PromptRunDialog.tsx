import { useEffect } from "react";
import { useUI } from "@/store/uiStore";
import { PromptRunner } from "./PromptRunner";

/**
 * 弹窗形态的 PromptRunner，由 useUI().runningPromptId 驱动。
 * 内部直接复用 PromptRunner，仅提供 Overlay 包装。
 *
 * 工作台首页用 PromptRunner 内嵌到右栏；该弹窗版保留供其他场景调用。
 */
export function PromptRunDialog() {
  const { runningPromptId, runningTaskPackId, closeRunner } = useUI();

  useEffect(() => {
    if (!runningPromptId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeRunner();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [runningPromptId, closeRunner]);

  if (!runningPromptId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 md:items-start md:p-4 md:pt-12"
      onClick={closeRunner}
    >
      <div
        className="flex w-full max-w-2xl flex-col bg-paper shadow-xl md:max-h-[85vh] md:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <PromptRunner
          promptId={runningPromptId}
          taskPackId={runningTaskPackId}
          onClose={closeRunner}
          mode="dialog"
        />
      </div>
    </div>
  );
}
