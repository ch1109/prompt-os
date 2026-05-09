import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import { seedPromptOSV31 } from "./v31Seed";
import { SCENE_DEFS, PACK_DEFS } from "@/data/promptos-v3-1";

describe("seedPromptOSV31 端到端", () => {
  beforeEach(async () => {
    await db.scenarios.clear();
    await db.prompts.clear();
    await db.taskPacks.clear();
  });

  it("写入 18 场景 + 87 prompt + 87 任务包", async () => {
    await seedPromptOSV31();

    const [sceneCount, promptCount, packCount] = await Promise.all([
      db.scenarios.count(),
      db.prompts.count(),
      db.taskPacks.count(),
    ]);

    expect(sceneCount).toBe(18);
    expect(promptCount).toBe(87);
    expect(packCount).toBe(87);
    expect(SCENE_DEFS.length).toBe(18);
    expect(PACK_DEFS.length).toBe(87);
  });

  it("幂等：重复调用不重复写", async () => {
    await seedPromptOSV31();
    await seedPromptOSV31();
    expect(await db.prompts.count()).toBe(87);
    expect(await db.taskPacks.count()).toBe(87);
    expect(await db.scenarios.count()).toBe(18);
  });

  it("每个任务包都有「核心 Prompt」单阶段，引用对应 prompt", async () => {
    await seedPromptOSV31();
    const packs = await db.taskPacks.toArray();
    for (const p of packs) {
      expect(p.stages.length).toBe(1);
      expect(p.stages[0]?.name).toBe("核心 Prompt");
      expect(p.stages[0]?.promptIds.length).toBe(1);
      const target = p.stages[0]?.promptIds[0];
      expect(target).toBeTruthy();
      const prompt = await db.prompts.get(target!);
      expect(prompt?.id).toBe(target);
    }
  });

  it("Prompt body 完整保留「绝对不要」段（业务包）+ 变量大括号", async () => {
    await seedPromptOSV31();
    const businessPrompts = (await db.prompts.toArray()).filter((p) =>
      p.id.match(/^prompt:v31:\d+\.\d+$/)
    );
    // 文档里 2.2「用逻辑击穿一个话题」是 v3 风格最高样板，文末用「语言要求」替代「绝对不要」
    const exempt = ["prompt:v31:2.2"];
    const missing = businessPrompts.filter(
      (p) => !exempt.includes(p.id) && !p.body.includes("绝对不要")
    );
    expect(missing.map((p) => p.id)).toEqual([]);

    // 至少 50 个 prompt 含 {} 变量占位
    const withVars = businessPrompts.filter((p) => /\{[^{}]+\}/.test(p.body));
    expect(withVars.length).toBeGreaterThanOrEqual(50);
  });

  it("一级场景指向正确：每个 pack.sceneCategoryId 都能在 scenarios 里找到", async () => {
    await seedPromptOSV31();
    const sceneIds = new Set((await db.scenarios.toArray()).map((s) => s.id));
    const packs = await db.taskPacks.toArray();
    for (const p of packs) {
      expect(sceneIds.has(p.sceneCategoryId)).toBe(true);
    }
  });

  it("「钩子拷打」标题不重复（4.1 vs 11.2）", async () => {
    await seedPromptOSV31();
    const prompts = await db.prompts.toArray();
    const titles = prompts.map((p) => p.title);
    const dupCount = titles.filter((t) => t === "钩子拷打").length;
    expect(dupCount).toBe(1);
    expect(titles).toContain("钩子拷打（标题版）");
  });

  it("元 Prompt 各 10 条，body 简短", async () => {
    await seedPromptOSV31();
    const metas = (await db.prompts.toArray()).filter((p) =>
      p.id.startsWith("prompt:v31:meta.")
    );
    expect(metas.length).toBe(10);
    for (const m of metas) {
      expect(m.body.length).toBeLessThanOrEqual(200);
      expect(m.body.length).toBeGreaterThan(20);
    }
  });

  it("scenarios 都是 level 1，parentId 为 null", async () => {
    await seedPromptOSV31();
    const scenes = await db.scenarios.toArray();
    expect(scenes.length).toBe(18);
    for (const s of scenes) {
      expect(s.level).toBe(1);
      expect(s.parentId).toBeNull();
      expect(s.fullPath).toEqual([s.title]);
      expect(s.description.length).toBeGreaterThan(5);
    }
  });
});
