import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { createPrompt } from "@/db/repos/promptRepo";
import { useUI } from "@/store/uiStore";
import { PromptRunner } from "./PromptRunner";

describe("PromptRunner", () => {
  const writeText = vi.fn();

  beforeEach(async () => {
    await db.prompts.clear();
    await db.taskPacks.clear();
    useUI.setState({ selectedPromptId: null, selectedTaskPackId: null });
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("允许部分填写变量后复制完整 Prompt", async () => {
    const prompt = await createPrompt({
      title: "测试 Prompt",
      body: "请分析[在这里填入你的原始描述，哪怕是极其碎片化的想法]，面向{目标用户}，输出【格式】",
    });

    render(<PromptRunner promptId={prompt.id} />);

    await screen.findByText("变量填空区");
    expect(screen.queryByText("生成后的完整 Prompt")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("填写 目标用户")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("填写 格式")).toBeInTheDocument();
    fireEvent.change(
      screen.getByPlaceholderText("填写 在这里填入你的原始描述，哪怕是极其碎片化的想法"),
      {
        target: { value: "增长复盘" },
      }
    );
    fireEvent.change(screen.getByPlaceholderText("填写 目标用户"), {
      target: { value: "产品经理" },
    });
    fireEvent.click(screen.getByText("复制完整 Prompt"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("请分析增长复盘，面向产品经理，输出【格式】")
    );
  });
});
