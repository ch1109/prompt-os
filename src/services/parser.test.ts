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
});
