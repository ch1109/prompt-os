import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/db";
import type { Prompt, TaskPack } from "@/types";
import { exportAllData, importBackupFromFile, restoreBackupFromFile } from "./backup";

// 最小记录：backup 只关心 id 主键与表内容的进出，其余字段不影响读写
const prompt = (id: string, extra: Partial<Prompt> = {}): Prompt =>
  ({ id, ...extra }) as unknown as Prompt;
const pack = (id: string, extra: Partial<TaskPack> = {}): TaskPack =>
  ({ id, ...extra }) as unknown as TaskPack;

function backupFile(data: {
  prompts?: Prompt[];
  contexts?: unknown[];
  scenarios?: unknown[];
  taskPacks?: TaskPack[];
  workflows?: unknown[];
}): File {
  const payload = {
    format: "prompt-os-backup",
    version: 1,
    exportedAt: Date.now(),
    counts: {},
    data: {
      prompts: data.prompts ?? [],
      contexts: data.contexts ?? [],
      scenarios: data.scenarios ?? [],
      taskPacks: data.taskPacks ?? [],
      workflows: data.workflows ?? [],
    },
  };
  return new File([JSON.stringify(payload)], "backup.json", { type: "application/json" });
}

describe("backup", () => {
  beforeEach(async () => {
    await Promise.all([
      db.prompts.clear(),
      db.contexts.clear(),
      db.scenarios.clear(),
      db.taskPacks.clear(),
      db.workflows.clear(),
    ]);
    localStorage.clear();
  });

  it("exportAllData 含 taskPacks（修复前漏导出）", async () => {
    await db.prompts.add(prompt("p1"));
    await db.taskPacks.add(pack("pack1"));

    // happy-dom 无 createObjectURL，mock 捕获导出的 blob
    const captured: Blob[] = [];
    const spy = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((b: Blob | MediaSource) => {
        captured.push(b as Blob);
        return "blob:mock";
      });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const counts = await exportAllData();
    expect(counts.taskPacks).toBe(1);

    const parsed = JSON.parse(await captured[0].text());
    expect(parsed.data.taskPacks).toHaveLength(1);
    expect(parsed.data.taskPacks[0].id).toBe("pack1");

    spy.mockRestore();
  });

  it("restoreBackupFromFile 覆盖式替换，撞 id 不产生重复", async () => {
    // 本机现有数据：a 会被同 id 覆盖、stale 应被清掉
    await db.prompts.bulkAdd([prompt("a", { title: "OLD" }), prompt("stale")]);
    await db.taskPacks.add(pack("oldpack"));

    const file = backupFile({
      prompts: [prompt("a", { title: "NEW" }), prompt("b")],
      taskPacks: [pack("newpack")],
    });

    const stats = await restoreBackupFromFile(file);
    expect(stats.prompts).toBe(2);

    const prompts = await db.prompts.toArray();
    expect(prompts.map((p) => p.id).sort()).toEqual(["a", "b"]); // 无 stale、无重命名副本
    expect((await db.prompts.get("a"))?.title).toBe("NEW"); // 同 id 被覆盖

    const packs = await db.taskPacks.toArray();
    expect(packs.map((p) => p.id)).toEqual(["newpack"]); // oldpack 已清
  });

  it("restoreBackupFromFile 清空前归档当前数据到快照（可回滚）", async () => {
    await db.prompts.add(prompt("keep-me"));

    await restoreBackupFromFile(backupFile({ prompts: [prompt("replacement")] }));

    const snapshotKeys = Object.keys(localStorage).filter((k) =>
      k.startsWith("prompt-os-snapshot:")
    );
    expect(snapshotKeys.length).toBeGreaterThan(0);
    const archived = JSON.parse(localStorage.getItem(snapshotKeys[0])!);
    expect(archived.prompts.map((p: Prompt) => p.id)).toContain("keep-me");
  });

  it("importBackupFromFile 合并模式也覆盖 taskPacks", async () => {
    const outcome = await importBackupFromFile(backupFile({ taskPacks: [pack("t1")] }));
    expect(outcome.added.taskPacks).toBe(1);
    expect((await db.taskPacks.toArray()).map((p) => p.id)).toEqual(["t1"]);
  });
});
