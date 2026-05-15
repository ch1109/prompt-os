import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PromptEditor } from "./PromptEditor";

describe("PromptEditor", () => {
  it("只展示用户需要手动维护的核心字段", () => {
    render(<PromptEditor open editId={null} onClose={vi.fn()} />);

    expect(screen.getByText("标题 *")).toBeInTheDocument();
    expect(screen.getByText("正文 *（复制时只复制此内容）")).toBeInTheDocument();
    expect(screen.getByText("摘要")).toBeInTheDocument();

    expect(screen.queryByText("任务意图")).not.toBeInTheDocument();
    expect(screen.queryByText("任务类型")).not.toBeInTheDocument();
    expect(screen.queryByText("难度")).not.toBeInTheDocument();
    expect(screen.queryByText("价值等级")).not.toBeInTheDocument();
    expect(screen.queryByText(/主场景路径/)).not.toBeInTheDocument();
    expect(screen.queryByText(/标签/)).not.toBeInTheDocument();
    expect(screen.queryByText("输入要求")).not.toBeInTheDocument();
    expect(screen.queryByText("输出格式")).not.toBeInTheDocument();
    expect(screen.queryByText("适用边界")).not.toBeInTheDocument();
  });
});
