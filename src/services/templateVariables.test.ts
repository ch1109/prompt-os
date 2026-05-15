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

  it("识别单大括号 {name}", () => {
    expect(extractVariables("我的主题：{一句话}")).toEqual(["一句话"]);
  });

  it("识别全角方括号【name】", () => {
    expect(extractVariables("我的初始想法是：【填入你的想法】")).toEqual([
      "填入你的想法",
    ]);
  });

  it("识别半角方括号 [name]", () => {
    expect(
      extractVariables("初步描述如下：[在这里填入你的原始描述，哪怕是极其碎片化的想法]")
    ).toEqual(["在这里填入你的原始描述，哪怕是极其碎片化的想法"]);
  });

  it("容忍内部空格 {{ name }}", () => {
    expect(extractVariables("{{ name }}")).toEqual(["name"]);
  });

  it("容忍单大括号内部空格 { name }", () => {
    expect(extractVariables("{ 书名 + 作者 }")).toEqual(["书名 + 作者"]);
  });

  it("重复变量去重保序", () => {
    expect(extractVariables("{{name}} {name} {{age}}")).toEqual([
      "name",
      "age",
    ]);
  });

  it("混合多种插槽语法时按首次出现保序", () => {
    expect(
      extractVariables("背景：[产品想法]\n用户：{目标用户}\n格式：{{输出格式}}\n限制：【限制条件】")
    ).toEqual(["产品想法", "目标用户", "输出格式", "限制条件"]);
  });

  it("空变量 {{}} 与 {{ }} 忽略", () => {
    expect(extractVariables("{{}} {{ }}")).toEqual([]);
  });

  it("不完整括号不匹配", () => {
    expect(extractVariables("{a}} {{a}")).toEqual([]);
  });

  it("中文变量名支持", () => {
    expect(extractVariables("请分析《{{书名}}》目标 {读者类型} 和【输出风格】")).toEqual([
      "书名",
      "读者类型",
      "输出风格",
    ]);
  });

  it("忽略明显不是插槽的对象片段", () => {
    expect(extractVariables('JSON 示例：{"name":"Alice"}')).toEqual([]);
  });

  it("忽略 Markdown 链接文本", () => {
    expect(extractVariables("参考 [产品文档](https://example.com) 后总结")).toEqual([]);
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

  it("替换单大括号变量", () => {
    expect(renderTemplate("主题：{一句话}", { 一句话: "增长复盘" })).toBe(
      "主题：增长复盘"
    );
  });

  it("替换全角方括号变量", () => {
    expect(
      renderTemplate("想法：【填入你的想法】", {
        填入你的想法: "先做用户访谈",
      })
    ).toBe("想法：先做用户访谈");
  });

  it("替换半角方括号变量", () => {
    expect(
      renderTemplate("想法：[在这里填入你的原始描述，哪怕是极其碎片化的想法]", {
        "在这里填入你的原始描述，哪怕是极其碎片化的想法": "先做用户访谈",
      })
    ).toBe("想法：先做用户访谈");
  });

  it("混合语法按同名变量替换", () => {
    expect(renderTemplate("{name}/{{ name }}", { name: "Alice" })).toBe(
      "Alice/Alice"
    );
  });

  it("未填变量保留原 token", () => {
    expect(renderTemplate("hi {{name}} {age}", { name: "Alice" })).toBe(
      "hi Alice {age}"
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
