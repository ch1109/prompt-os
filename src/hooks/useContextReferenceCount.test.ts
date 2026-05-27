import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { db } from "@/db";
import {
  useAllContextReferenceCounts,
  useContextReferenceCount,
} from "./useContextReferenceCount";
import type { Prompt, Scenario } from "@/types";

const now = () => Date.now();

function makePrompt(id: string, boundContextIds: string[]): Prompt {
  return {
    id,
    title: id,
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
    difficulty: "中级",
    valueLevel: "高频",
    shareable: true,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now(),
    updatedAt: now(),
    boundContextIds,
  };
}

function makeScenario(id: string, recommendedContexts: string[]): Scenario {
  return {
    id,
    title: id,
    parentId: null,
    level: 1,
    fullPath: [id],
    description: "",
    tags: [],
    order: 0,
    recommendedContexts,
  };
}

describe("useAllContextReferenceCounts", () => {
  beforeEach(async () => {
    await db.prompts.clear();
    await db.scenarios.clear();
  });

  it("聚合 prompts.boundContextIds 与 scenarios.recommendedContexts", async () => {
    await db.prompts.bulkAdd([
      makePrompt("p1", ["A"]),
      makePrompt("p2", ["A", "B"]),
    ]);
    await db.scenarios.bulkAdd([makeScenario("s1", ["A"])]);

    const { result } = renderHook(() => useAllContextReferenceCounts());

    await waitFor(
      () => {
        expect(result.current.get("A")?.total).toBe(3);
      },
      { timeout: 2000 }
    );
    expect(result.current.get("A")).toEqual({
      promptCount: 2,
      scenarioCount: 1,
      total: 3,
    });
    expect(result.current.get("B")).toEqual({
      promptCount: 1,
      scenarioCount: 0,
      total: 1,
    });
    expect(result.current.get("C")).toBeUndefined();
  });

  it("无任何引用时返回空 Map", async () => {
    await db.prompts.bulkAdd([makePrompt("p", [])]);

    const { result } = renderHook(() => useAllContextReferenceCounts());

    await waitFor(() => {
      // useLiveQuery 至少返回一次（空 Map 或 undefined 被 hook 替换成空 Map）
      expect(result.current.size).toBe(0);
    });
  });
});

describe("useContextReferenceCount", () => {
  beforeEach(async () => {
    await db.prompts.clear();
    await db.scenarios.clear();
  });

  it("contextId 为 null 时返回零", async () => {
    const { result } = renderHook(() => useContextReferenceCount(null));
    expect(result.current).toEqual({
      promptCount: 0,
      scenarioCount: 0,
      total: 0,
    });
  });

  it("单 id 查询：累加 prompt 与 scenario", async () => {
    await db.prompts.bulkAdd([
      makePrompt("p1", ["target"]),
      makePrompt("p2", ["other"]),
    ]);
    await db.scenarios.bulkAdd([
      makeScenario("s1", ["target", "x"]),
      makeScenario("s2", ["other"]),
    ]);

    const { result } = renderHook(() => useContextReferenceCount("target"));

    await waitFor(
      () => {
        expect(result.current.total).toBe(2);
      },
      { timeout: 2000 }
    );
    expect(result.current).toEqual({
      promptCount: 1,
      scenarioCount: 1,
      total: 2,
    });
  });
});
