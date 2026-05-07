import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import { createPrompt, incrementUseCount, toggleFavorite } from "./promptRepo";

describe("promptRepo", () => {
  beforeEach(async () => {
    await db.prompts.clear();
  });

  it("createPrompt 自动生成 id/createdAt/updatedAt", async () => {
    const p = await createPrompt({ title: "测试", body: "你好" });
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBeGreaterThan(0);
    expect(p.useCount).toBe(0);
    expect(p.isFavorited).toBe(false);
  });

  it("incrementUseCount 累加 useCount 并更新 lastUsedAt", async () => {
    const p = await createPrompt({ title: "t", body: "b" });
    await incrementUseCount(p.id);
    const updated = await db.prompts.get(p.id);
    expect(updated?.useCount).toBe(1);
    expect(updated?.lastUsedAt).toBeGreaterThan(0);
  });

  it("toggleFavorite 切换收藏状态", async () => {
    const p = await createPrompt({ title: "t", body: "b" });
    await toggleFavorite(p.id);
    const fav = await db.prompts.get(p.id);
    expect(fav?.isFavorited).toBe(true);
    await toggleFavorite(p.id);
    const unfav = await db.prompts.get(p.id);
    expect(unfav?.isFavorited).toBe(false);
  });
});
