import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import {
  createTaskPack,
  incrementUseCount,
  toggleFavorite,
  updateTaskPack,
  listByScene,
  listFavorites,
  listRecent,
} from "./taskPackRepo";

describe("taskPackRepo", () => {
  beforeEach(async () => {
    await db.taskPacks.clear();
  });

  it("createTaskPack 自动生成 id 与时间戳，stages 顺序按数组下标", async () => {
    const pack = await createTaskPack({
      title: "深度读书",
      sceneCategoryId: "scn-reading",
      stages: [
        { id: "s1", name: "选书", promptIds: ["p1"], order: 99 },
        { id: "s2", name: "阅读", promptIds: [], order: 0 },
      ],
    });
    expect(pack.id).toBeTruthy();
    expect(pack.createdAt).toBeGreaterThan(0);
    expect(pack.useCount).toBe(0);
    expect(pack.isFavorited).toBe(false);
    expect(pack.stages[0].order).toBe(0);
    expect(pack.stages[1].order).toBe(1);
  });

  it("updateTaskPack 重写 updatedAt 并标准化 stages 顺序", async () => {
    const pack = await createTaskPack({
      title: "t",
      sceneCategoryId: "scn-x",
    });
    await new Promise((r) => setTimeout(r, 5));
    await updateTaskPack(pack.id, {
      stages: [
        { id: "a", name: "A", promptIds: [], order: 5 },
        { id: "b", name: "B", promptIds: [], order: 99 },
      ],
    });
    const next = await db.taskPacks.get(pack.id);
    expect(next!.updatedAt).toBeGreaterThan(pack.updatedAt);
    expect(next!.stages[0].order).toBe(0);
    expect(next!.stages[1].order).toBe(1);
  });

  it("incrementUseCount 累加 useCount + 更新 lastUsedAt 但不改 updatedAt", async () => {
    const pack = await createTaskPack({
      title: "t",
      sceneCategoryId: "scn-x",
    });
    await incrementUseCount(pack.id);
    const next = await db.taskPacks.get(pack.id);
    expect(next!.useCount).toBe(1);
    expect(next!.lastUsedAt).toBeGreaterThan(0);
    expect(next!.updatedAt).toBe(pack.updatedAt);
  });

  it("toggleFavorite 切换收藏状态", async () => {
    const pack = await createTaskPack({
      title: "t",
      sceneCategoryId: "scn-x",
    });
    await toggleFavorite(pack.id);
    expect((await db.taskPacks.get(pack.id))!.isFavorited).toBe(true);
    await toggleFavorite(pack.id);
    expect((await db.taskPacks.get(pack.id))!.isFavorited).toBe(false);
  });

  it("listByScene 仅返回指定一级场景 id 下的子场景", async () => {
    await createTaskPack({ title: "A", sceneCategoryId: "scn-1" });
    await createTaskPack({ title: "B", sceneCategoryId: "scn-2" });
    await createTaskPack({ title: "C", sceneCategoryId: "scn-1" });
    const list = await listByScene("scn-1");
    expect(list.map((p) => p.title).sort()).toEqual(["A", "C"]);
  });

  it("listFavorites 仅返回收藏的子场景", async () => {
    const a = await createTaskPack({ title: "A", sceneCategoryId: "x" });
    await createTaskPack({ title: "B", sceneCategoryId: "x" });
    await toggleFavorite(a.id);
    const favs = await listFavorites();
    expect(favs.length).toBe(1);
    expect(favs[0].title).toBe("A");
  });

  it("listRecent 按 lastUsedAt desc 排序，未使用过的不返回", async () => {
    const a = await createTaskPack({ title: "A", sceneCategoryId: "x" });
    const b = await createTaskPack({ title: "B", sceneCategoryId: "x" });
    await createTaskPack({ title: "C", sceneCategoryId: "x" });
    await incrementUseCount(a.id);
    await new Promise((r) => setTimeout(r, 5));
    await incrementUseCount(b.id);
    const recent = await listRecent();
    expect(recent.map((p) => p.title)).toEqual(["B", "A"]);
  });
});
