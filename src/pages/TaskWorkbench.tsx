import { useEffect } from "react";
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { WorkbenchSidebar } from "@/components/taskpack/WorkbenchSidebar";
import { TaskPackWorkspace } from "@/components/taskpack/TaskPackWorkspace";
import { PromptRunner } from "@/components/taskpack/PromptRunner";
import { useUI } from "@/store/uiStore";

export default function TaskWorkbench() {
  const { selectedPromptId, setSelectedPrompt } = useUI();

  // 离开本页时清理 selectedPromptId，避免污染 /prompts 页详情面板
  useEffect(() => {
    return () => {
      setSelectedPrompt(null);
    };
  }, [setSelectedPrompt]);

  return (
    <ThreeColumnLayout
      sidebar={<WorkbenchSidebar />}
      main={<TaskPackWorkspace />}
      detail={selectedPromptId ? <PromptRunner /> : undefined}
      detailWidthClass="md:w-[460px] lg:w-[600px]"
    />
  );
}
