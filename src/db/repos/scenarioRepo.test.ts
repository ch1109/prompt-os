import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import {
  createScenario,
  renameScenario,
  reorderSiblings,
} from "./scenarioRepo";
import { createPrompt } from "./promptRepo";

describe("scenarioRepo", () => {
  beforeEach(async () => {
    await db.scenarios.clear();
    await db.prompts.clear();
  });

  it("createScenario 默认追加在同层末尾，order 间隔 10", async () => {
    const a = await createScenario({ title: "A" });
    const b = await createScenario({ title: "B" });
    const c = await createScenario({ title: "C" });
    expect(a.order).toBe(0);
    expect(b.order).toBe(10);
    expect(c.order).toBe(20);
  });

  it("reorderSiblings 重写同层 order，跨层调用返回 0", async () => {
    const a = await createScenario({ title: "A" });
    const b = await createScenario({ title: "B" });
    const c = await createScenario({ title: "C" });
    const child = await createScenario({ title: "child", parentId: a.id, level: 2 });

    const n = await reorderSiblings([c.id, a.id, b.id]);
    expect(n).toBe(3);
    const all = await db.scenarios.toArray();
    const byId = new Map(all.map((s) => [s.id, s.order]));
    expect(byId.get(c.id)).toBe(0);
    expect(byId.get(a.id)).toBe(10);
    expect(byId.get(b.id)).toBe(20);

    // 跨层混调拒绝
    const bad = await reorderSiblings([a.id, child.id]);
    expect(bad).toBe(0);
  });

  it("renameScenario 同步更新自身 + 后代 fullPath + prompts 路径", async () => {
    const root = await createScenario({
      title: "工作场景",
      level: 1,
      fullPath: ["工作场景"],
    });
    const sub = await createScenario({
      title: "汇报",
      parentId: root.id,
      level: 2,
      fullPath: ["工作场景", "汇报"],
    });
    await createPrompt({
      title: "周报模板",
      body: "...",
      primaryScenario: ["工作场景", "汇报"],
      secondaryScenarios: [["工作场景"]],
    });
    await createPrompt({
      title: "无关 prompt",
      body: "...",
      primaryScenario: ["读书场景"],
      secondaryScenarios: [],
    });

    const { touchedPrompts } = await renameScenario(root.id, "工作");
    expect(touchedPrompts).toBe(1);

    const updatedRoot = await db.scenarios.get(root.id);
    const updatedSub = await db.scenarios.get(sub.id);
    expect(updatedRoot?.title).toBe("工作");
    expect(updatedRoot?.fullPath).toEqual(["工作"]);
    expect(updatedSub?.fullPath).toEqual(["工作", "汇报"]);

    const prompts = await db.prompts.toArray();
    const touched = prompts.find((p) => p.title === "周报模板");
    const untouched = prompts.find((p) => p.title === "无关 prompt");
    expect(touched?.primaryScenario).toEqual(["工作", "汇报"]);
    expect(touched?.secondaryScenarios).toEqual([["工作"]]);
    expect(untouched?.primaryScenario).toEqual(["读书场景"]);
  });

  it("renameScenario 空字符串抛错", async () => {
    const s = await createScenario({ title: "A" });
    await expect(renameScenario(s.id, "   ")).rejects.toThrow();
  });
});
