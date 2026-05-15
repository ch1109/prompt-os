import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { AddPromptPopover } from "./AddPromptPopover";

describe("AddPromptPopover", () => {
  beforeEach(async () => {
    await db.prompts.clear();
  });

  it("粘贴创建 Prompt 时可以填写摘要", async () => {
    const onPick = vi.fn();
    render(
      <AddPromptPopover
        existingPromptIds={[]}
        onPick={onPick}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("粘贴一段 Prompt 内容创建"));
    fireEvent.change(screen.getByPlaceholderText(/把从外面复制来的 Prompt 内容粘进来/), {
      target: { value: "请生成一份产品压力测试报告" },
    });
    fireEvent.change(screen.getByPlaceholderText("一句话描述用途"), {
      target: { value: "用于生成产品压力测试报告" },
    });
    fireEvent.click(screen.getByText("创建并加入阶段"));

    await waitFor(() => expect(onPick).toHaveBeenCalledTimes(1));
    const prompts = await db.prompts.toArray();
    expect(prompts[0]?.summary).toBe("用于生成产品压力测试报告");
  });
});
