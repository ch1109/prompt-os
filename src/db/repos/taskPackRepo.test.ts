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
  reorderTaskPacks,
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

  it("createTaskPack 默认 order 按同 scene 内单调递增，新建追加到末尾", async () => {
    const a = await createTaskPack({ title: "A", sceneCategoryId: "scn-1" });
    const b = await createTaskPack({ title: "B", sceneCategoryId: "scn-1" });
    const c = await createTaskPack({ title: "C", sceneCategoryId: "scn-1" });
    // 不同 scene 之间不共享序列
    const x = await createTaskPack({ title: "X", sceneCategoryId: "scn-2" });
    expect(a.order).toBe(0);
    expect(b.order).toBe(10);
    expect(c.order).toBe(20);
    expect(x.order).toBe(0);
  });

  it("reorderTaskPacks 按传入顺序写 order 且不刷新 updatedAt", async () => {
    const a = await createTaskPack({ title: "A", sceneCategoryId: "scn-r" });
    const b = await createTaskPack({ title: "B", sceneCategoryId: "scn-r" });
    const c = await createTaskPack({ title: "C", sceneCategoryId: "scn-r" });
    await new Promise((r) => setTimeout(r, 5));
    const n = await reorderTaskPacks([c.id, a.id, b.id]);
    expect(n).toBe(3);
    const [na, nb, nc] = await Promise.all([
      db.taskPacks.get(a.id),
      db.taskPacks.get(b.id),
      db.taskPacks.get(c.id),
    ]);
    expect(nc!.order).toBe(0);
    expect(na!.order).toBe(10);
    expect(nb!.order).toBe(20);
    expect(na!.updatedAt).toBe(a.updatedAt);
    expect(nb!.updatedAt).toBe(b.updatedAt);
    expect(nc!.updatedAt).toBe(c.updatedAt);
  });

  it("reorderTaskPacks 跨 sceneCategoryId 时拒绝写入并返回 0", async () => {
    const a = await createTaskPack({ title: "A", sceneCategoryId: "scn-1" });
    const x = await createTaskPack({ title: "X", sceneCategoryId: "scn-2" });
    const n = await reorderTaskPacks([a.id, x.id]);
    expect(n).toBe(0);
    expect((await db.taskPacks.get(a.id))!.order).toBe(a.order);
    expect((await db.taskPacks.get(x.id))!.order).toBe(x.order);
  });
});
