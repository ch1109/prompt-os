import { describe, it, expect } from "vitest";
import {
  extractVariables,
  renderTemplate,
  isLongValue,
} from "./templateVariables";

describe("extractVariables", () => {
  it("识别基础 {{name}}", () => {
    expect(extractVariables("hello {{name}}")).toEqual(["name"]);
  });

  it("容忍内部空格 {{ name }}", () => {
    expect(extractVariables("{{ name }}")).toEqual(["name"]);
  });

  it("重复变量去重保序", () => {
    expect(extractVariables("{{name}} {{name}} {{age}}")).toEqual([
      "name",
      "age",
    ]);
  });

  it("空变量 {{}} 与 {{ }} 忽略", () => {
    expect(extractVariables("{{}} {{ }}")).toEqual([]);
  });

  it("单括号 {a}} 与 {{a} 不匹配", () => {
    expect(extractVariables("{a}} {{a} {a}")).toEqual([]);
  });

  it("中文变量名支持", () => {
    expect(extractVariables("请分析《{{书名}}》目标 {{读者类型}}")).toEqual([
      "书名",
      "读者类型",
    ]);
  });

  it("嵌套 {{a{{b}}c}} 取内层 b", () => {
    expect(extractVariables("{{a{{b}}c}}")).toEqual(["b"]);
  });

  it("空字符串返回空数组", () => {
    expect(extractVariables("")).toEqual([]);
  });
});

describe("renderTemplate", () => {
  it("替换已填变量", () => {
    expect(renderTemplate("hi {{name}}", { name: "Alice" })).toBe("hi Alice");
  });

  it("未填变量保留原 token", () => {
    expect(renderTemplate("hi {{name}} {{age}}", { name: "Alice" })).toBe(
      "hi Alice {{age}}"
    );
  });

  it("空字符串值视为未填", () => {
    expect(renderTemplate("hi {{name}}", { name: "" })).toBe("hi {{name}}");
  });

  it("中文变量替换", () => {
    expect(
      renderTemplate("分析《{{书名}}》", { 书名: "当下的力量" })
    ).toBe("分析《当下的力量》");
  });

  it("重复变量全部替换", () => {
    expect(renderTemplate("{{x}}+{{x}}", { x: "1" })).toBe("1+1");
  });

  it("空 body 返回空字符串", () => {
    expect(renderTemplate("", { x: "1" })).toBe("");
  });
});

describe("isLongValue", () => {
  it("超过 80 字符算长文本", () => {
    expect(isLongValue("a".repeat(81))).toBe(true);
    expect(isLongValue("a".repeat(80))).toBe(false);
  });

  it("含换行算长文本", () => {
    expect(isLongValue("a\nb")).toBe(true);
  });

  it("空字符串不算长文本", () => {
    expect(isLongValue("")).toBe(false);
  });
});
