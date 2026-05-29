import { nanoid } from "nanoid";
import { db } from "@/db";
import { writeMigrationArchive } from "@/db/snapshot";
import type { Context, Prompt, Scenario, TaskPack, Workflow } from "@/types";

const BACKUP_VERSION = 1;

interface BackupFile {
  format: "prompt-os-backup";
  version: number;
  exportedAt: number;
  counts: {
    prompts: number;
    contexts: number;
    scenarios: number;
    taskPacks: number;
    workflows: number;
  };
  data: {
    prompts: Prompt[];
    contexts: Context[];
    scenarios: Scenario[];
    taskPacks: TaskPack[];
    workflows: Workflow[];
  };
}

export interface BackupStats {
  prompts: number;
  contexts: number;
  scenarios: number;
  taskPacks: number;
  workflows: number;
}

export async function exportAllData(): Promise<BackupStats> {
  const [prompts, contexts, scenarios, taskPacks, workflows] = await Promise.all([
    db.prompts.toArray(),
    db.contexts.toArray(),
    db.scenarios.toArray(),
    db.taskPacks.toArray(),
    db.workflows.toArray(),
  ]);
  const counts = {
    prompts: prompts.length,
    contexts: contexts.length,
    scenarios: scenarios.length,
    taskPacks: taskPacks.length,
    workflows: workflows.length,
  };
  const file: BackupFile = {
    format: "prompt-os-backup",
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    counts,
    data: { prompts, contexts, scenarios, taskPacks, workflows },
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  Object.assign(document.createElement("a"), {
    href: url,
    download: `prompt-os-backup-${date}.json`,
  }).click();
  URL.revokeObjectURL(url);
  return counts;
}

export interface ImportOutcome {
  added: BackupStats;
  renamed: BackupStats;
  exportedAt: number | null;
}

async function mergeTable<T extends { id: string }>(
  table: {
    bulkGet: (ids: string[]) => Promise<(T | undefined)[]>;
    bulkAdd: (items: T[]) => Promise<unknown>;
  },
  items: T[]
): Promise<{ added: number; renamed: number }> {
  if (!items.length) return { added: 0, renamed: 0 };
  const existing = new Set(
    (await table.bulkGet(items.map((x) => x.id))).filter((x): x is T => !!x).map((x) => x.id)
  );
  let renamed = 0;
  const final = items.map((x) => {
    if (existing.has(x.id)) {
      renamed++;
      return { ...x, id: nanoid() };
    }
    return x;
  });
  await table.bulkAdd(final);
  return { added: final.length, renamed };
}

interface ParsedBackup {
  data: BackupFile["data"];
  exportedAt: number | null;
}

/** 把已解析的 JSON 归一化为统一的五表结构，未知格式抛错。文件/仓库快照共用。 */
function normalizeBackup(parsed: unknown): ParsedBackup {
  if (isBackupFile(parsed)) {
    const d = parsed.data;
    return {
      data: {
        prompts: d.prompts ?? [],
        contexts: d.contexts ?? [],
        scenarios: d.scenarios ?? [],
        taskPacks: d.taskPacks ?? [],
        workflows: d.workflows ?? [],
      },
      exportedAt: parsed.exportedAt,
    };
  }
  if (isLegacyTemplate(parsed)) {
    return {
      data: {
        prompts: parsed.prompts ?? [],
        contexts: parsed.contexts ?? [],
        scenarios: parsed.scenarios ?? [],
        taskPacks: parsed.taskPacks ?? [],
        workflows: parsed.workflows ?? [],
      },
      exportedAt: null,
    };
  }
  throw new Error("无法识别的备份文件格式");
}

async function parseBackupFile(file: File): Promise<ParsedBackup> {
  return normalizeBackup(JSON.parse(await file.text()));
}

export async function importBackupFromFile(file: File): Promise<ImportOutcome> {
  const { data, exportedAt } = await parseBackupFile(file);

  const [p, c, s, t, w] = await Promise.all([
    mergeTable(db.prompts, data.prompts),
    mergeTable(db.contexts, data.contexts),
    mergeTable(db.scenarios, data.scenarios),
    mergeTable(db.taskPacks, data.taskPacks),
    mergeTable(db.workflows, data.workflows),
  ]);

  return {
    added: {
      prompts: p.added,
      contexts: c.added,
      scenarios: s.added,
      taskPacks: t.added,
      workflows: w.added,
    },
    renamed: {
      prompts: p.renamed,
      contexts: c.renamed,
      scenarios: s.renamed,
      taskPacks: t.renamed,
      workflows: w.renamed,
    },
    exportedAt,
  };
}

/**
 * 覆盖式恢复核心：清空本机五表并替换为给定内容，用于设备间精确镜像。
 *
 * 与合并模式不同，这里会丢弃本机现有数据——所以清空前先调用 writeMigrationArchive
 * 把现状归档到 localStorage（可在 Settings 快照列表回滚），归档失败只 warn 不阻塞，
 * 遵循项目「destructive 操作前必先归档」铁律。文件导入与仓库快照恢复共用。
 */
async function applyRestore(data: BackupFile["data"]): Promise<BackupStats> {
  try {
    const [prompts, scenarios, taskPacks, contexts] = await Promise.all([
      db.prompts.toArray(),
      db.scenarios.toArray(),
      db.taskPacks.toArray(),
      db.contexts.toArray(),
    ]);
    writeMigrationArchive({ prompts, scenarios, taskPacks, contexts });
  } catch (e) {
    console.warn("[Prompt OS] 覆盖式恢复前归档失败，继续恢复", e);
  }

  await db.transaction(
    "rw",
    [db.prompts, db.contexts, db.scenarios, db.taskPacks, db.workflows],
    async () => {
      await Promise.all([
        db.prompts.clear(),
        db.contexts.clear(),
        db.scenarios.clear(),
        db.taskPacks.clear(),
        db.workflows.clear(),
      ]);
      await Promise.all([
        db.prompts.bulkPut(data.prompts),
        db.contexts.bulkPut(data.contexts),
        db.scenarios.bulkPut(data.scenarios),
        db.taskPacks.bulkPut(data.taskPacks),
        db.workflows.bulkPut(data.workflows),
      ]);
    }
  );

  return {
    prompts: data.prompts.length,
    contexts: data.contexts.length,
    scenarios: data.scenarios.length,
    taskPacks: data.taskPacks.length,
    workflows: data.workflows.length,
  };
}

/** 覆盖式导入：从用户选择的文件恢复（离线/不走仓库时使用）。 */
export async function restoreBackupFromFile(file: File): Promise<BackupStats> {
  const { data } = await parseBackupFile(file);
  return applyRestore(data);
}

/** 仓库快照路径：放在 public/ 下，构建/dev 均由 Vite 在站点根提供。 */
const REPO_SNAPSHOT_URL = `${import.meta.env.BASE_URL}data-snapshot.json`;

/**
 * 一键从仓库快照恢复：fetch public/data-snapshot.json → 覆盖恢复。
 * 用于跨设备同步——B 端 git pull 后无需在文件对话框选文件即可镜像 A 端数据。
 */
export async function restoreFromRepoSnapshot(): Promise<{
  stats: BackupStats;
  exportedAt: number | null;
}> {
  const res = await fetch(REPO_SNAPSHOT_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("仓库里还没有数据快照（public/data-snapshot.json）");
  }
  const { data, exportedAt } = normalizeBackup(await res.json());
  const stats = await applyRestore(data);
  return { stats, exportedAt };
}

function isBackupFile(x: unknown): x is BackupFile {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { format?: string }).format === "prompt-os-backup" &&
    typeof (x as { data?: unknown }).data === "object"
  );
}

function isLegacyTemplate(x: unknown): x is {
  prompts?: Prompt[];
  contexts?: Context[];
  scenarios?: Scenario[];
  taskPacks?: TaskPack[];
  workflows?: Workflow[];
} {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.prompts) ||
    Array.isArray(o.contexts) ||
    Array.isArray(o.scenarios) ||
    Array.isArray(o.taskPacks) ||
    Array.isArray(o.workflows)
  );
}
