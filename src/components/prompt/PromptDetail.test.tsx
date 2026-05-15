import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { createPrompt } from "@/db/repos/promptRepo";
import { useUI } from "@/store/uiStore";
import { PromptDetail } from "./PromptDetail";

describe("PromptDetail", () => {
  const writeText = vi.fn();

  beforeEach(async () => {
    await db.prompts.clear();
    useUI.setState({ selectedPromptId: null });
    writeText.mockReset();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  it("带插槽的 Prompt 可以部分填写后复制填好版本", async () => {
    const prompt = await createPrompt({
      title: "测试 Prompt",
      body: "请分析 {主题}，输出 {{格式}}",
    });
    useUI.getState().setSelectedPrompt(prompt.id);

    render(<PromptDetail onEdit={vi.fn()} />);

    fireEvent.click(await screen.findByText("填写插槽"));
    fireEvent.change(screen.getByPlaceholderText("填写 主题"), {
      target: { value: "增长复盘" },
    });
    fireEvent.click(screen.getByText("复制填好版本"));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("请分析 增长复盘，输出 {{格式}}")
    );
    const updated = await db.prompts.get(prompt.id);
    expect(updated?.useCount).toBe(1);
  });

  it("复制正文仍然复制原始 Prompt", async () => {
    const prompt = await createPrompt({
      title: "测试 Prompt",
      body: "请分析 {主题}",
    });
    useUI.getState().setSelectedPrompt(prompt.id);

    render(<PromptDetail onEdit={vi.fn()} />);

    fireEvent.click(await screen.findByText("复制正文"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("请分析 {主题}"));
  });
});
