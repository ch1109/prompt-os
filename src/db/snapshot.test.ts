import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import {
  takeSnapshot,
  listSnapshots,
  restoreSnapshot,
  deleteSnapshot,
  pruneSnapshots,
  writeMigrationArchive,
  __testing,
} from "./snapshot";
import type { Prompt, Scenario, TaskPack } from "@/types";

const now = () => Date.now();

function makePrompt(id: string, title = id): Prompt {
  return {
    id,
    title,
    body: `body of ${id}`,
    summary: "",
    taskIntent: "",
    primaryScenario: ["测试"],
    secondaryScenarios: [],
    taskType: "生成",
    inputRequirements: "",
    outputFormat: "Markdown 文本",
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
  };
}

function makeScenario(id: string, title = id): Scenario {
  return {
    id,
    title,
    parentId: null,
    level: 1,
    fullPath: [title],
    description: "",
    tags: [],
    recommendedPrompts: [],
    recommendedWorkflows: [],
    recommendedContexts: [],
    typicalTasks: [],
  };
}

function makeTaskPack(id: string, sceneCategoryId: string): TaskPack {
  return {
    id,
    title: id,
    goal: "",
    description: "",
    sceneCategoryId,
    stages: [{ id: `${id}-s1`, name: "核心 Prompt", promptIds: [], order: 0 }],
    tags: [],
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
}

async function seedSome() {
  await db.prompts.bulkAdd([makePrompt("p1"), makePrompt("p2")]);
  await db.scenarios.bulkAdd([makeScenario("s1")]);
  await db.taskPacks.bulkAdd([makeTaskPack("t1", "s1")]);
}

function clearLs() {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(__testing.KEY_PREFIX)) localStorage.removeItem(k);
  }
}

describe("snapshot", () => {
  beforeEach(async () => {
    await db.prompts.clear();
    await db.scenarios.clear();
    await db.taskPacks.clear();
    clearLs();
  });

  it("空库 takeSnapshot 返回 null，不写 localStorage", async () => {
    const entry = await takeSnapshot("startup");
    expect(entry).toBeNull();
    expect(listSnapshots()).toEqual([]);
  });

  it("takeSnapshot 写入并能由 listSnapshots 读回", async () => {
    await seedSome();
    const entry = await takeSnapshot("manual");
    expect(entry).not.toBeNull();
    expect(entry?.counts).toEqual({ prompts: 2, scenarios: 1, taskPacks: 1 });

    const list = listSnapshots();
    expect(list).toHaveLength(1);
    expect(list[0]?.reason).toBe("manual");
  });

  it("restoreSnapshot 清表并恢复到快照状态", async () => {
    await seedSome();
    const entry = await takeSnapshot("manual");
    expect(entry).not.toBeNull();

    // 修改当前 DB：删一条 prompt、加一条新的、删任务包
    await db.prompts.delete("p1");
    await db.prompts.add(makePrompt("p3"));
    await db.taskPacks.clear();

    await restoreSnapshot(entry!.key);

    const prompts = await db.prompts.toArray();
    expect(prompts.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(await db.taskPacks.count()).toBe(1);
  });

  it("deleteSnapshot 删除指定快照", async () => {
    await seedSome();
    const a = await takeSnapshot("manual");
    expect(a).not.toBeNull();
    deleteSnapshot(a!.key);
    expect(listSnapshots()).toEqual([]);
  });

  it("pruneSnapshots 保留最近 N 份，多余的按时间从旧到新删除", async () => {
    await seedSome();

    // 手工塞 5 份不同时间戳的快照
    for (let i = 0; i < 5; i++) {
      const at = 1_700_000_000_000 + i * 1000;
      localStorage.setItem(
        `${__testing.KEY_PREFIX}${at}`,
        JSON.stringify({
          at,
          reason: "manual",
          counts: { prompts: 1, scenarios: 1, taskPacks: 1 },
          prompts: [makePrompt(`p${i}`)],
          scenarios: [makeScenario(`s${i}`)],
          taskPacks: [makeTaskPack(`t${i}`, `s${i}`)],
        })
      );
    }
    expect(listSnapshots()).toHaveLength(5);

    const dropped = pruneSnapshots(3);
    expect(dropped).toBe(2);
    const remaining = listSnapshots();
    expect(remaining).toHaveLength(3);
    // 升序 at: 1700000000000, +1000, +2000, +3000, +4000 → 删 0 和 1，留 2/3/4
    expect(remaining.map((s) => s.at).sort()).toEqual([
      1_700_000_002_000, 1_700_000_003_000, 1_700_000_004_000,
    ]);
  });

  it("pruneSnapshots 顺手清掉 JSON 损坏的条目", async () => {
    localStorage.setItem(`${__testing.KEY_PREFIX}9999`, "{not json");
    const dropped = pruneSnapshots(3);
    expect(dropped).toBe(1);
    expect(listSnapshots()).toEqual([]);
  });

  it("writeMigrationArchive 与 takeSnapshot 同 schema，可互相 restore", async () => {
    const entry = writeMigrationArchive({
      prompts: [makePrompt("mp")],
      scenarios: [makeScenario("ms")],
      taskPacks: [makeTaskPack("mt", "ms")],
    });
    expect(entry).not.toBeNull();
    expect(entry?.reason).toBe("migration");

    await restoreSnapshot(entry!.key);
    expect(await db.prompts.count()).toBe(1);
    expect(await db.taskPacks.count()).toBe(1);
  });

  it("takeSnapshot 写入会触发 prune，保留份数不超过 MAX_KEEP", async () => {
    await seedSome();

    for (let i = 0; i < __testing.MAX_KEEP + 2; i++) {
      const e = await takeSnapshot("startup");
      expect(e).not.toBeNull();
      // 制造时间差，否则同毫秒 key 会重叠
      await new Promise((r) => setTimeout(r, 2));
    }

    expect(listSnapshots().length).toBeLessThanOrEqual(__testing.MAX_KEEP);
  });
});
