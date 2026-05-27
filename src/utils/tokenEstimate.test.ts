import { describe, it, expect } from "vitest";
import { estimateTokens } from "./tokenEstimate";

describe("estimateTokens", () => {
  it("空字符串 → 0", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("纯英文 100 字符 → 25 tokens", () => {
    expect(estimateTokens("a".repeat(100))).toBe(25);
  });

  it("纯中文 50 字 → 50 tokens", () => {
    expect(estimateTokens("中".repeat(50))).toBe(50);
  });

  it("中英混合：10 中文 + 20 英文 → 15 tokens", () => {
    // 中文 10 (=10) + 英文 20 (=ceil(20/4)=5) = 15
    expect(estimateTokens("中".repeat(10) + "a".repeat(20))).toBe(15);
  });

  it("非整除时向上取整", () => {
    // 3 英文 → ceil(3/4) = 1
    expect(estimateTokens("abc")).toBe(1);
  });

  it("常见中英混合句子保守估算", () => {
    const text = "请帮我分析用户反馈 about Q4 onboarding";
    // 中文部分：请帮我分析用户反馈 = 9 字 → 9
    // 其它（含空格、字母）：" about Q4 onboarding" = 20 字符 → ceil(20/4) = 5
    expect(estimateTokens(text)).toBe(14);
  });
});
