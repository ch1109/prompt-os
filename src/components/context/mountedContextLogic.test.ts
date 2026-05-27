import { describe, it, expect } from "vitest";
import { computeMounted } from "./MountedContextChips";
import { pickSceneContexts } from "./SceneDefaultContextPanel";
import type { Context, ContextType, Prompt } from "@/types";

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "p",
    title: "示例 Prompt",
    body: "请生成一份产品说明",
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
    difficulty: "中级",
    valueLevel: "高频",
    shareable: true,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeCtx(id: string, overrides: Partial<Context> = {}): Context {
  return {
    id,
    title: id,
    type: "自定义" as ContextType,
    content: "",
    tags: [],
    isDefault: false,
    createdAt: 0,
    updatedAt: 0,
    enabled: true,
    scope: "global",
    triggerStrategy: "manual",
    ...overrides,
  };
}

describe("computeMounted", () => {
  it("bound：boundContextIds 中的 context 永远在最前面", () => {
    const prompt = makePrompt({ boundContextIds: ["a"] });
    const ctxs = [makeCtx("a"), makeCtx("b", { triggerStrategy: "always" })];
    const result = computeMounted(prompt, ctxs, new Set());
    expect(result[0]?.context.id).toBe("a");
    expect(result[0]?.tone).toBe("bound");
  });

  it("always + global：strategy=always 且 scope=global → tone=always", () => {
    const prompt = makePrompt();
    const ctxs = [makeCtx("g", { triggerStrategy: "always", scope: "global" })];
    const result = computeMounted(prompt, ctxs, new Set());
    expect(result).toHaveLength(1);
    expect(result[0]?.tone).toBe("always");
  });

  it("scope=scene_category 命中 prompt.primaryScenario 且 strategy=always → tone=scene", () => {
    const prompt = makePrompt({ primaryScenario: ["scene-A"] });
    const ctxs = [
      makeCtx("s", {
        triggerStrategy: "always",
        scope: "scene_category",
        scopeRefs: { scenarioIds: ["scene-A"] },
      }),
    ];
    const result = computeMounted(prompt, ctxs, new Set());
    expect(result[0]?.tone).toBe("scene");
  });

  it("scope=scene_category 命中但 strategy=manual → 不附加", () => {
    const prompt = makePrompt({ primaryScenario: ["scene-A"] });
    const ctxs = [
      makeCtx("s", {
        triggerStrategy: "manual",
        scope: "scene_category",
        scopeRefs: { scenarioIds: ["scene-A"] },
      }),
    ];
    expect(computeMounted(prompt, ctxs, new Set())).toEqual([]);
  });

  it("conditional + Prompt 标签命中 → tone=conditional", () => {
    const prompt = makePrompt({ tags: ["react"] });
    const ctxs = [
      makeCtx("c", {
        triggerStrategy: "conditional",
        triggerConditions: { promptTags: ["react"] },
      }),
    ];
    expect(computeMounted(prompt, ctxs, new Set())[0]?.tone).toBe("conditional");
  });

  it("conditional + 关键词命中 prompt body（大小写不敏感）", () => {
    const prompt = makePrompt({ body: "需要遵守 GDPR 合规" });
    const ctxs = [
      makeCtx("c", {
        triggerStrategy: "conditional",
        triggerConditions: { keywords: ["gdpr"] },
      }),
    ];
    expect(computeMounted(prompt, ctxs, new Set())[0]?.tone).toBe("conditional");
  });

  it("conditional 全部条件都不命中 → 不附加", () => {
    const prompt = makePrompt({ tags: ["nuxt"] });
    const ctxs = [
      makeCtx("c", {
        triggerStrategy: "conditional",
        triggerConditions: { promptTags: ["react"], keywords: ["aws"] },
      }),
    ];
    expect(computeMounted(prompt, ctxs, new Set())).toEqual([]);
  });

  it("manual extraSelectedIds 标 tone=manual", () => {
    const prompt = makePrompt();
    const ctxs = [makeCtx("m")];
    const result = computeMounted(prompt, ctxs, new Set(["m"]));
    expect(result).toHaveLength(1);
    expect(result[0]?.tone).toBe("manual");
  });

  it("enabled=false 的 context 被跳过", () => {
    const prompt = makePrompt();
    const ctxs = [
      makeCtx("d", { triggerStrategy: "always", scope: "global", enabled: false }),
    ];
    expect(computeMounted(prompt, ctxs, new Set())).toEqual([]);
  });

  it("bound 优先级最高：bound + manual 同时存在不重复", () => {
    const prompt = makePrompt({ boundContextIds: ["x"] });
    const ctxs = [makeCtx("x")];
    const result = computeMounted(prompt, ctxs, new Set(["x"]));
    expect(result).toHaveLength(1);
    expect(result[0]?.tone).toBe("bound");
  });
});

describe("pickSceneContexts", () => {
  it("global + always → 命中", () => {
    const ctxs = [makeCtx("g", { triggerStrategy: "always", scope: "global" })];
    expect(pickSceneContexts(ctxs, undefined, "scene-A", undefined)).toHaveLength(1);
  });

  it("global + manual → 不命中（不属于本场景默认）", () => {
    const ctxs = [makeCtx("g", { triggerStrategy: "manual", scope: "global" })];
    expect(pickSceneContexts(ctxs, undefined, "scene-A", undefined)).toEqual([]);
  });

  it("scene_category 命中 sceneCategoryId 且 always", () => {
    const ctxs = [
      makeCtx("s", {
        triggerStrategy: "always",
        scope: "scene_category",
        scopeRefs: { scenarioIds: ["scene-A"] },
      }),
    ];
    expect(pickSceneContexts(ctxs, undefined, "scene-A", undefined)).toHaveLength(1);
    expect(pickSceneContexts(ctxs, undefined, "scene-B", undefined)).toEqual([]);
  });

  it("sub_scene 命中 scenarioId 且 always", () => {
    const ctxs = [
      makeCtx("sb", {
        triggerStrategy: "always",
        scope: "sub_scene",
        scopeRefs: { subScenarioIds: ["sub-1"] },
      }),
    ];
    expect(pickSceneContexts(ctxs, undefined, "scene-A", "sub-1")).toHaveLength(1);
    expect(pickSceneContexts(ctxs, undefined, "scene-A", "sub-2")).toEqual([]);
    expect(pickSceneContexts(ctxs, undefined, "scene-A", undefined)).toEqual([]);
  });

  it("recommendedContexts 显式列出的命中无视 strategy 与 enabled", () => {
    const ctxs = [
      makeCtx("r", { triggerStrategy: "manual", scope: "global", enabled: false }),
    ];
    expect(pickSceneContexts(ctxs, ["r"], "scene-A", undefined)).toHaveLength(1);
  });

  it("enabled=false 排除（除非 recommendedContexts 显式列出）", () => {
    const ctxs = [
      makeCtx("e", { triggerStrategy: "always", scope: "global", enabled: false }),
    ];
    expect(pickSceneContexts(ctxs, undefined, "scene-A", undefined)).toEqual([]);
  });
});
