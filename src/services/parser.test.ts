import { describe, it, expect } from "vitest";
import { splitPrompts } from "./parser";

describe("splitPrompts", () => {
  it("按空行分割", () => {
    expect(splitPrompts("a\n\nb\n\nc")).toEqual(["a", "b", "c"]);
  });

  it("按 ### 分割", () => {
    expect(splitPrompts("### 1\nfoo\n### 2\nbar")).toEqual(["foo", "bar"]);
  });

  it("过滤空字符串", () => {
    expect(splitPrompts("\n\n  \n\na\n\n")).toEqual(["a"]);
  });

  it("空输入返回空数组", () => {
    expect(splitPrompts("")).toEqual([]);
  });

  it("剥离首部数字编号（含中文顿号/圆圈/项目符号）", () => {
    expect(splitPrompts("1. 生成周报\n\n2、优化标题\n\n①拆解概念\n\n- 分析痛点")).toEqual([
      "生成周报",
      "优化标题",
      "拆解概念",
      "分析痛点",
    ]);
  });

  it("不误剥离小数开头（1.5 保留）", () => {
    expect(splitPrompts("1.5 倍速学习法")).toEqual(["1.5 倍速学习法"]);
  });

  it("折叠条目内多余空行（### 分段下）", () => {
    expect(splitPrompts("### a\n第一行\n\n\n\n第二行")).toEqual(["第一行\n\n第二行"]);
  });
});
