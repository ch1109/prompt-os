import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { db } from "@/db";
import type { Prompt, TaskPack } from "@/types";
import {
  collectBackup,
  exportAllData,
  getLocalLatestEdit,
  getSyncStatus,
  importBackupFromFile,
  peekRepoSnapshot,
  restoreBackupFromFile,
  restoreFromRepoSnapshot,
} from "./backup";

const ANCHOR_KEY = "prompt-os-sync-anchor";

/** 让 getSyncStatus 里的 peekRepoSnapshot 拿到指定 exportedAt 的仓库快照（404 → 模拟无快照）。 */
function mockRepoSnapshot(exportedAt: number | null) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    exportedAt == null
      ? ({ ok: false, status: 404 } as Response)
      : ({ ok: true, json: async () => backupPayload({ exportedAt }) } as Response)
  );
}

// 最小记录：backup 只关心 id 主键与表内容的进出，其余字段不影响读写
const prompt = (id: string, extra: Partial<Prompt> = {}): Prompt =>
  ({ id, ...extra }) as unknown as Prompt;
const pack = (id: string, extra: Partial<TaskPack> = {}): TaskPack =>
  ({ id, ...extra }) as unknown as TaskPack;

type BackupData = {
  prompts?: Prompt[];
  contexts?: unknown[];
  scenarios?: unknown[];
  taskPacks?: TaskPack[];
  workflows?: unknown[];
  exportedAt?: number;
};

function backupPayload(data: BackupData) {
  return {
    format: "prompt-os-backup",
    version: 1,
    exportedAt: data.exportedAt ?? Date.now(),
    counts: {},
    data: {
      prompts: data.prompts ?? [],
      contexts: data.contexts ?? [],
      scenarios: data.scenarios ?? [],
      taskPacks: data.taskPacks ?? [],
      workflows: data.workflows ?? [],
    },
  };
}

function backupFile(data: BackupData): File {
  return new File([JSON.stringify(backupPayload(data))], "backup.json", {
    type: "application/json",
  });
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

  it("collectBackup 的 counts 与五表实际长度一致", async () => {
    await db.prompts.bulkAdd([prompt("p1"), prompt("p2")]);
    await db.taskPacks.add(pack("t1"));

    const file = await collectBackup();
    expect(file.counts.prompts).toBe(2);
    expect(file.counts.taskPacks).toBe(1);
    expect(file.counts.contexts).toBe(0);
    expect(file.data.prompts.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
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

  it("restoreFromRepoSnapshot fetch 仓库快照并覆盖恢复", async () => {
    await db.prompts.add(prompt("factory")); // 模拟 B 端出厂数据，应被替换
    const at = 1_700_000_000_000;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => backupPayload({ prompts: [prompt("synced")], exportedAt: at }),
    } as Response);

    const { stats, exportedAt } = await restoreFromRepoSnapshot();
    expect(stats.prompts).toBe(1);
    expect(exportedAt).toBe(at);
    expect((await db.prompts.toArray()).map((p) => p.id)).toEqual(["synced"]); // factory 已清

    vi.restoreAllMocks();
  });

  it("restoreFromRepoSnapshot 快照不存在时抛友好错误", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(restoreFromRepoSnapshot()).rejects.toThrow(/还没有数据快照/);
    vi.restoreAllMocks();
  });

  it("getLocalLatestEdit 取三表 updatedAt 最大值，空库为 0", async () => {
    expect(await getLocalLatestEdit()).toBe(0);
    await db.prompts.add(prompt("p1", { updatedAt: 100 }));
    await db.taskPacks.add(pack("t1", { updatedAt: 300 }));
    await db.prompts.add(prompt("p2", { updatedAt: 200 }));
    expect(await getLocalLatestEdit()).toBe(300);
  });

  it("peekRepoSnapshot 只读 exportedAt + counts，不触碰本机数据", async () => {
    await db.prompts.add(prompt("local")); // 不应被改动
    const at = 1_700_000_000_000;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => backupPayload({ prompts: [prompt("x"), prompt("y")], exportedAt: at }),
    } as Response);

    const meta = await peekRepoSnapshot();
    expect(meta.exportedAt).toBe(at);
    expect((await db.prompts.toArray()).map((p) => p.id)).toEqual(["local"]); // 未恢复

    vi.restoreAllMocks();
  });

  it("peekRepoSnapshot 快照不存在时抛友好错误", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 404 } as Response);
    await expect(peekRepoSnapshot()).rejects.toThrow(/还没有数据快照/);
    vi.restoreAllMocks();
  });
});

describe("getSyncStatus", () => {
  beforeEach(async () => {
    await Promise.all([db.prompts.clear(), db.taskPacks.clear(), db.contexts.clear()]);
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("【致命陷阱】锚点为空 + 本机 seed 时间晚于仓库快照 → unknown，绝不误判 local-newer", async () => {
    // 模拟刚 pull 完的 B 台：seed 把出厂数据 updatedAt 设成「今天」，晚于历史快照
    await db.prompts.add(prompt("seeded", { updatedAt: 9_999_999 }));
    mockRepoSnapshot(1_000); // 仓库快照很旧
    // 锚点为空（从未保存/恢复过）

    const s = await getSyncStatus();
    expect(s.state).toBe("unknown"); // 必须中性，若判成 local-newer 会诱导推 seed 覆盖真快照
  });

  it("锚点存在、仓库快照比锚点新 → repo-newer（B 台该恢复）", async () => {
    localStorage.setItem(ANCHOR_KEY, "1000");
    await db.prompts.add(prompt("p", { updatedAt: 500 })); // 本机编辑不晚于锚点
    mockRepoSnapshot(2000);

    expect((await getSyncStatus()).state).toBe("repo-newer");
  });

  it("锚点存在、本机编辑晚于锚点、仓库未更新 → local-newer（A 台该保存）", async () => {
    localStorage.setItem(ANCHOR_KEY, "1000");
    await db.prompts.add(prompt("p", { updatedAt: 2000 }));
    mockRepoSnapshot(1000); // 仓库 == 锚点，未更新

    expect((await getSyncStatus()).state).toBe("local-newer");
  });

  it("锚点存在、仓库与本机都晚于锚点 → conflict", async () => {
    localStorage.setItem(ANCHOR_KEY, "1000");
    await db.prompts.add(prompt("p", { updatedAt: 3000 }));
    mockRepoSnapshot(2000);

    expect((await getSyncStatus()).state).toBe("conflict");
  });

  it("锚点存在、两边都不晚于锚点 → in-sync", async () => {
    localStorage.setItem(ANCHOR_KEY, "1000");
    await db.prompts.add(prompt("p", { updatedAt: 800 }));
    mockRepoSnapshot(1000);

    expect((await getSyncStatus()).state).toBe("in-sync");
  });

  it("仓库无快照 → no-snapshot", async () => {
    localStorage.setItem(ANCHOR_KEY, "1000");
    mockRepoSnapshot(null);

    expect((await getSyncStatus()).state).toBe("no-snapshot");
  });
});
