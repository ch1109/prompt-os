import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import type { Prompt, Scenario, TaskPack } from "@/types";

// 默认的 supabase mock：测试里覆盖 mockRpc 行为
const mockRpc = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
  isSupabaseConfigured: () => true,
}));

// 指纹固定，避免 canvas/crypto 在 jsdom 里的兼容问题
vi.mock("@/lib/fingerprint", () => ({
  getFingerprint: vi.fn().mockResolvedValue("test-fp"),
}));

// 必须在 mock 之后 import
import {
  previewCode,
  redeemCode,
  normalizeCode,
  RedeemError,
} from "./redeem";

function makePrompt(id: string, title = "测试 Prompt"): Prompt {
  return {
    id,
    title,
    body: "body",
    summary: "summary",
    primaryScenario: ["测试场景"],
    secondaryScenarios: [],
    taskType: "生成",
    inputRequirements: "",
    outputFormat: "",
    upstreamPrompts: [],
    downstreamPrompts: [],
    recommendedCombinations: [],
    boundaries: "",
    tags: [],
    difficulty: "初级",
    valueLevel: "高频",
    shareable: true,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeScenario(id: string, parentId: string | null = null): Scenario {
  return {
    id,
    title: "场景",
    parentId,
    level: 1,
    fullPath: ["场景"],
    description: "",
    tags: [],
    order: 0,
  };
}

function makeTaskPack(id: string, sceneCategoryId: string): TaskPack {
  return {
    id,
    title: "任务包",
    goal: "",
    description: "",
    sceneCategoryId,
    stages: [],
    tags: [],
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    order: 0,
  };
}

function emptyPayload() {
  return { prompts: [], scenarios: [], taskPacks: [] };
}

describe("normalizeCode", () => {
  it("去空白并大写", () => {
    expect(normalizeCode(" abcd-efgh ")).toBe("ABCD-EFGH");
  });
  it("保留分隔符", () => {
    expect(normalizeCode("abcd-efgh-ijkl-mnop")).toBe("ABCD-EFGH-IJKL-MNOP");
  });
});

describe("previewCode", () => {
  beforeEach(async () => {
    mockRpc.mockReset();
    await db.prompts.clear();
    await db.scenarios.clear();
    await db.taskPacks.clear();
  });

  it("成功路径：返回 stats 与零冲突", async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        prompts: [makePrompt("tpl_x_p1")],
        scenarios: [makeScenario("tpl_x_s1")],
        taskPacks: [makeTaskPack("tpl_x_t1", "tpl_x_s1")],
      },
      error: null,
    });

    const r = await previewCode("ABCD-EFGH-IJKL-MNOP");
    expect(r.stats).toEqual({ prompts: 1, scenarios: 1, taskPacks: 1 });
    expect(r.conflicts.total).toBe(0);
    expect(mockRpc).toHaveBeenCalledWith("preview_invite_code", {
      p_code: "ABCD-EFGH-IJKL-MNOP",
    });
  });

  it("检测到本地已存在同 id 时报告冲突", async () => {
    await db.prompts.add(makePrompt("tpl_x_p1", "已存在的"));
    mockRpc.mockResolvedValueOnce({
      data: {
        prompts: [makePrompt("tpl_x_p1", "模板里的")],
        scenarios: [],
        taskPacks: [],
      },
      error: null,
    });

    const r = await previewCode("ABCD-EFGH-IJKL-MNOP");
    expect(r.conflicts.total).toBe(1);
    expect(r.conflicts.promptConflicts).toEqual(["tpl_x_p1"]);
  });

  it("INVALID_CODE 抛出 RedeemError", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "INVALID_CODE" },
    });
    await expect(previewCode("XXXX")).rejects.toMatchObject({
      code: "INVALID_CODE",
    });
  });

  it("CODE_ALREADY_USED 抛出 RedeemError", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "ERROR: CODE_ALREADY_USED ..." },
    });
    await expect(previewCode("XXXX")).rejects.toMatchObject({
      code: "CODE_ALREADY_USED",
    });
  });

  it("CODE_EXPIRED 抛出 RedeemError", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "ERROR: CODE_EXPIRED ..." },
    });
    await expect(previewCode("XXXX")).rejects.toMatchObject({
      code: "CODE_EXPIRED",
    });
  });
});

describe("redeemCode", () => {
  beforeEach(async () => {
    mockRpc.mockReset();
    await db.prompts.clear();
    await db.scenarios.clear();
    await db.taskPacks.clear();
  });

  it("成功路径：preview 无冲突 → redeem → 内容落本地", async () => {
    const payload = {
      prompts: [makePrompt("tpl_x_p1")],
      scenarios: [makeScenario("tpl_x_s1")],
      taskPacks: [makeTaskPack("tpl_x_t1", "tpl_x_s1")],
    };
    // 第一次调用是 preview
    mockRpc.mockResolvedValueOnce({ data: payload, error: null });
    // 第二次调用是 redeem
    mockRpc.mockResolvedValueOnce({ data: payload, error: null });

    const r = await redeemCode("ABCD-EFGH-IJKL-MNOP");
    expect(r.stats).toEqual({ prompts: 1, scenarios: 1, taskPacks: 1 });

    // 验证写入本地 db
    expect(await db.prompts.get("tpl_x_p1")).toBeTruthy();
    expect(await db.scenarios.get("tpl_x_s1")).toBeTruthy();
    expect(await db.taskPacks.get("tpl_x_t1")).toBeTruthy();

    // 验证 redeem 调用带了指纹和 UA
    const secondCall = mockRpc.mock.calls[1];
    expect(secondCall[0]).toBe("redeem_invite_code");
    expect(secondCall[1]).toMatchObject({
      p_code: "ABCD-EFGH-IJKL-MNOP",
      p_fingerprint: "test-fp",
    });
  });

  it("冲突预检失败时 abort，不调 redeem RPC", async () => {
    await db.prompts.add(makePrompt("tpl_x_p1"));
    mockRpc.mockResolvedValueOnce({
      data: {
        prompts: [makePrompt("tpl_x_p1", "模板里的同 id")],
        scenarios: [],
        taskPacks: [],
      },
      error: null,
    });

    try {
      await redeemCode("ABCD-EFGH-IJKL-MNOP");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RedeemError);
      expect((e as RedeemError).code).toBe("CONFLICT");
      expect((e as RedeemError).conflicts?.total).toBe(1);
    }

    // 关键：只调了 preview，没调 redeem
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc.mock.calls[0][0]).toBe("preview_invite_code");
  });

  it("已使用码：preview 阶段就报错，不写本地", async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: "CODE_ALREADY_USED" },
    });

    await expect(redeemCode("ABCD")).rejects.toMatchObject({
      code: "CODE_ALREADY_USED",
    });
    // 本地空
    expect(await db.prompts.count()).toBe(0);
  });

  it("空 payload 也能成功（极端但允许）", async () => {
    mockRpc.mockResolvedValueOnce({ data: emptyPayload(), error: null });
    mockRpc.mockResolvedValueOnce({ data: emptyPayload(), error: null });

    const r = await redeemCode("ABCD");
    expect(r.stats).toEqual({ prompts: 0, scenarios: 0, taskPacks: 0 });
  });
});
