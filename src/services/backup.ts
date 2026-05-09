import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Context, Prompt, Scenario, Workflow } from "@/types";

const BACKUP_VERSION = 1;

interface BackupFile {
  format: "prompt-os-backup";
  version: number;
  exportedAt: number;
  counts: { prompts: number; contexts: number; scenarios: number; workflows: number };
  data: {
    prompts: Prompt[];
    contexts: Context[];
    scenarios: Scenario[];
    workflows: Workflow[];
  };
}

export interface BackupStats {
  prompts: number;
  contexts: number;
  scenarios: number;
  workflows: number;
}

export async function exportAllData(): Promise<BackupStats> {
  const [prompts, contexts, scenarios, workflows] = await Promise.all([
    db.prompts.toArray(),
    db.contexts.toArray(),
    db.scenarios.toArray(),
    db.workflows.toArray(),
  ]);
  const counts = {
    prompts: prompts.length,
    contexts: contexts.length,
    scenarios: scenarios.length,
    workflows: workflows.length,
  };
  const file: BackupFile = {
    format: "prompt-os-backup",
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    counts,
    data: { prompts, contexts, scenarios, workflows },
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

export async function importBackupFromFile(file: File): Promise<ImportOutcome> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  const data = isBackupFile(parsed)
    ? parsed.data
    : isLegacyTemplate(parsed)
      ? {
          prompts: parsed.prompts ?? [],
          contexts: parsed.contexts ?? [],
          scenarios: parsed.scenarios ?? [],
          workflows: parsed.workflows ?? [],
        }
      : null;

  if (!data) {
    throw new Error("无法识别的备份文件格式");
  }

  const [p, c, s, w] = await Promise.all([
    mergeTable(db.prompts, data.prompts),
    mergeTable(db.contexts, data.contexts),
    mergeTable(db.scenarios, data.scenarios),
    mergeTable(db.workflows, data.workflows),
  ]);

  return {
    added: { prompts: p.added, contexts: c.added, scenarios: s.added, workflows: w.added },
    renamed: {
      prompts: p.renamed,
      contexts: c.renamed,
      scenarios: s.renamed,
      workflows: w.renamed,
    },
    exportedAt: isBackupFile(parsed) ? parsed.exportedAt : null,
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
  workflows?: Workflow[];
} {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.prompts) ||
    Array.isArray(o.contexts) ||
    Array.isArray(o.scenarios) ||
    Array.isArray(o.workflows)
  );
}
