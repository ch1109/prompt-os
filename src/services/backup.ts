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

/** 解析备份/旧模板文件为统一的五表结构，未知格式抛错。merge 与覆盖式恢复共用。 */
async function parseBackupFile(file: File): Promise<ParsedBackup> {
  const parsed = JSON.parse(await file.text());
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
 * 覆盖式恢复：清空本机五表并替换为文件内容，用于设备间精确镜像。
 *
 * 与 importBackupFromFile 的合并模式不同，这里会丢弃本机现有数据——所以清空前
 * 先调用 writeMigrationArchive 把现状归档到 localStorage（可在 Settings 快照列表回滚），
 * 归档失败只 warn 不阻塞，遵循项目「destructive 操作前必先归档」铁律。
 */
export async function restoreBackupFromFile(file: File): Promise<BackupStats> {
  const { data } = await parseBackupFile(file);

  try {
    const [prompts, scenarios, taskPacks, contexts] = await Promise.all([
      db.prompts.toArray(),
      db.scenarios.toArray(),
      db.taskPacks.toArray(),
      db.contexts.toArray(),
    ]);
    writeMigrationArchive({ prompts, scenarios, taskPacks, contexts });
  } catch (e) {
    console.warn("[Prompt OS] 覆盖式导入前归档失败，继续恢复", e);
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
