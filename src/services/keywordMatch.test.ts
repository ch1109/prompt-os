import { describe, it, expect } from "vitest";
import {
  scoreContext,
  scorePrompt,
  scoreTaskPack,
  snippetAroundMatch,
  topKeywordHits,
} from "./keywordMatch";
import type { Prompt, TaskPack, Context } from "@/types";

function mkPrompt(over: Partial<Prompt>): Prompt {
  return {
    id: "p",
    title: "",
    body: "",
    summary: "",
    primaryScenario: [],
    secondaryScenarios: [],
    taskType: "生成",
    inputRequirements: "",
    outputFormat: "",
    upstreamPrompts: [],
    downstreamPrompts: [],
    recommendedCombinations: [],
    boundaries: "",
    tags: [],
    difficulty: "中",
    valueLevel: "高",
    shareable: false,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  } as Prompt;
}

function mkTaskPack(over: Partial<TaskPack>): TaskPack {
  return {
    id: "t",
    title: "",
    goal: "",
    description: "",
    sceneCategoryId: "scene",
    stages: [],
    tags: [],
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
    order: 0,
    ...over,
  };
}

function mkContext(over: Partial<Context>): Context {
  return {
    id: "c",
    title: "",
    type: "用户角色",
    content: "",
    tags: [],
    isDefault: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

describe("scorePrompt — 单字段权重", () => {
  it("title 命中得 4 分", () => {
    expect(scorePrompt(mkPrompt({ title: "简历优化" }), "简历")).toBe(4);
  });

  it("summary 命中得 2 分", () => {
    expect(scorePrompt(mkPrompt({ summary: "面向简历的助手" }), "简历")).toBe(2);
  });

  it("tags 命中得 2 分", () => {
    expect(scorePrompt(mkPrompt({ tags: ["简历", "求职"] }), "简历")).toBe(2);
  });

  it("body 命中得 1 分", () => {
    expect(scorePrompt(mkPrompt({ body: "我的简历/经历：{粘贴}" }), "简历")).toBe(1);
  });

  it("无命中得 0 分", () => {
    expect(scorePrompt(mkPrompt({ title: "完全无关" }), "简历")).toBe(0);
  });

  it("空 q 一律得 0 分", () => {
    expect(scorePrompt(mkPrompt({ title: "简历优化" }), "")).toBe(0);
    expect(scorePrompt(mkPrompt({ title: "简历优化" }), "   ")).toBe(0);
  });
});

describe("scorePrompt — 多字段累加", () => {
  it("title + body 同时命中得 5 分", () => {
    const p = mkPrompt({ title: "简历优化", body: "请粘贴你的简历" });
    expect(scorePrompt(p, "简历")).toBe(5);
  });

  it("title + summary + tags + body 全中得 9 分", () => {
    const p = mkPrompt({
      title: "简历",
      summary: "简历",
      tags: ["简历"],
      body: "简历",
    });
    expect(scorePrompt(p, "简历")).toBe(4 + 2 + 2 + 1);
  });
});

describe("scorePrompt — tag 评分契约", () => {
  it("多个 tag 命中只计一次（per-record，不是 per-tag-element）", () => {
    const p = mkPrompt({ tags: ["简历", "简历优化", "简历模板"] });
    expect(scorePrompt(p, "简历")).toBe(2);
  });
});

describe("scorePrompt — 归一化", () => {
  it("大小写不敏感", () => {
    expect(scorePrompt(mkPrompt({ title: "RESUME guide" }), "resume")).toBe(4);
  });

  it("q 自带前后空格也能命中", () => {
    expect(scorePrompt(mkPrompt({ title: "简历优化" }), "  简历  ")).toBe(4);
  });
});

describe("scoreTaskPack / scoreContext — 字段映射", () => {
  it("TaskPack: title=4, goal=2, tags=2, description=1", () => {
    expect(scoreTaskPack(mkTaskPack({ title: "x" }), "x")).toBe(4);
    expect(scoreTaskPack(mkTaskPack({ goal: "x" }), "x")).toBe(2);
    expect(scoreTaskPack(mkTaskPack({ tags: ["x"] }), "x")).toBe(2);
    expect(scoreTaskPack(mkTaskPack({ description: "...x..." }), "x")).toBe(1);
  });

  it("Context: title=4, tags=2, content=1", () => {
    expect(scoreContext(mkContext({ title: "x" }), "x")).toBe(4);
    expect(scoreContext(mkContext({ tags: ["x"] }), "x")).toBe(2);
    expect(scoreContext(mkContext({ content: "...x..." }), "x")).toBe(1);
  });
});

describe("snippetAroundMatch — 命中片段", () => {
  it("命中位于中间：三段都非空，前后用 … 收尾", () => {
    const text = "前缀文本".repeat(5) + "目标简历段落" + "后缀文本".repeat(5);
    const s = snippetAroundMatch(text, "简历", 5);
    expect(s).not.toBeNull();
    expect(s!.match).toBe("简历");
    expect(s!.before.startsWith("…")).toBe(true);
    expect(s!.after.endsWith("…")).toBe(true);
  });

  it("命中位于文本开头：before 不前缀 …", () => {
    const s = snippetAroundMatch("简历开头其他内容", "简历", 30);
    expect(s!.before).toBe("");
    expect(s!.match).toBe("简历");
  });

  it("命中位于文本结尾：after 不后缀 …", () => {
    const s = snippetAroundMatch("一些内容然后是简历", "简历", 30);
    expect(s!.after).toBe("");
    expect(s!.match).toBe("简历");
  });

  it("空 q 或不命中返回 null", () => {
    expect(snippetAroundMatch("有内容", "")).toBeNull();
    expect(snippetAroundMatch("", "x")).toBeNull();
    expect(snippetAroundMatch("无关内容", "简历")).toBeNull();
  });

  it("大小写不敏感，保留原文大小写", () => {
    const s = snippetAroundMatch("Hello RESUME World", "resume", 5);
    expect(s!.match).toBe("RESUME"); // 保留原文大小写
  });

  it("空白折叠：换行 / 多空格 → 单空格", () => {
    const text = "前面\n\n  简历\t\t后面";
    const s = snippetAroundMatch(text, "简历", 30);
    expect(s!.before).not.toMatch(/\n/);
    expect(s!.after).not.toMatch(/\t/);
    expect(s!.before).not.toMatch(/ {2,}/);
  });

  it("中文 radius 字符数生效", () => {
    const text = "一二三四五六七八九十简历甲乙丙丁戊己庚辛壬癸";
    const s = snippetAroundMatch(text, "简历", 3);
    // before 应该有 3 个中文 + 可能的 "…"
    expect(s!.before).toBe("…八九十");
    expect(s!.after).toBe("甲乙丙…");
  });
});

describe("topKeywordHits — 排序契约", () => {
  it("强匹配（title）始终排在弱匹配（body）之前——即便 body 命中更多", () => {
    const list: Prompt[] = [
      mkPrompt({ id: "body1", body: "简历", updatedAt: 100 }),
      mkPrompt({ id: "body2", body: "简历", updatedAt: 99 }),
      mkPrompt({ id: "body3", body: "简历", updatedAt: 98 }),
      mkPrompt({ id: "body4", body: "简历", updatedAt: 97 }),
      mkPrompt({ id: "body5", body: "简历", updatedAt: 96 }),
      mkPrompt({ id: "title1", title: "简历主线", updatedAt: 1 }),
      mkPrompt({ id: "title2", title: "简历重点", updatedAt: 2 }),
    ];

    const result = topKeywordHits(list, scorePrompt, "简历");
    expect(result.map((p) => p.id).slice(0, 2)).toEqual(["title2", "title1"]);
  });

  it("score 相同时按 updatedAt desc 排序", () => {
    const list: Prompt[] = [
      mkPrompt({ id: "old", title: "x", updatedAt: 1 }),
      mkPrompt({ id: "new", title: "x", updatedAt: 100 }),
    ];

    expect(topKeywordHits(list, scorePrompt, "x").map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("过滤掉 score=0 的项", () => {
    const list: Prompt[] = [
      mkPrompt({ id: "hit", title: "yes" }),
      mkPrompt({ id: "miss", title: "no" }),
    ];

    expect(topKeywordHits(list, scorePrompt, "yes").map((p) => p.id)).toEqual(["hit"]);
  });

  it("空 q 返回空数组", () => {
    const list: Prompt[] = [mkPrompt({ title: "x" })];
    expect(topKeywordHits(list, scorePrompt, "")).toEqual([]);
  });

  it("max 截断生效", () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      mkPrompt({ id: `p${i}`, title: "yes", updatedAt: i }),
    );
    expect(topKeywordHits(list, scorePrompt, "yes", 5)).toHaveLength(5);
  });
});
