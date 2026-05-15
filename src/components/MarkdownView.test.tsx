import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownView } from "./MarkdownView";

describe("MarkdownView", () => {
  it("保留被空行分开的有序列表起始序号", () => {
    render(
      <MarkdownView
        text={"1. 第一项\n\n补充说明\n\n2. 第二项\n\n补充说明\n\n3. 第三项"}
      />
    );

    const orderedLists = screen.getAllByRole("list");
    expect(orderedLists).toHaveLength(3);
    expect(orderedLists[0]).not.toHaveAttribute("start");
    expect(orderedLists[1]).toHaveAttribute("start", "2");
    expect(orderedLists[2]).toHaveAttribute("start", "3");
  });
});
