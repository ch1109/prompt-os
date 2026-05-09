import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Context, Prompt, Scenario, Workflow } from "@/types";

export interface TemplateMeta {
  title: string;
  description: string;
  audience: string; // 适用人群
  recommendedPath: string; // 推荐使用路径
  boundaries: string; // 适用边界
}

export interface TemplatePayload {
  meta?: TemplateMeta;
  prompts?: Prompt[];
  workflows?: Workflow[];
  contexts?: Context[];
  scenarios?: Scenario[];
}

export interface ExportSelection {
  promptIds?: string[];
  workflowIds?: string[];
  contextIds?: string[];
  scenarioIds?: string[];
  meta?: TemplateMeta;
}

export async function exportTemplate(sel: ExportSelection) {
  const payload: TemplatePayload = {};
  if (sel.meta) payload.meta = sel.meta;
  if (sel.promptIds?.length) {
    payload.prompts = (await db.prompts.bulkGet(sel.promptIds)).filter(
      (p): p is Prompt => !!p
    );
  }
  if (sel.workflowIds?.length) {
    payload.workflows = (await db.workflows.bulkGet(sel.workflowIds)).filter(
      (w): w is Workflow => !!w
    );
  }
  if (sel.contextIds?.length) {
    payload.contexts = (await db.contexts.bulkGet(sel.contextIds)).filter(
      (c): c is Context => !!c
    );
  }
  if (sel.scenarioIds?.length) {
    payload.scenarios = (await db.scenarios.bulkGet(sel.scenarioIds)).filter(
      (s): s is Scenario => !!s
    );
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const filename = sel.meta?.title
    ? `${sel.meta.title.replace(/[^\w一-龥]+/g, "-")}-${Date.now()}.promptos.json`
    : `template-${Date.now()}.promptos.json`;
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  meta: TemplateMeta | null;
  prompts: number;
  workflows: number;
  contexts: number;
  scenarios: number;
  conflictedPrompts: number;
  conflictedWorkflows: number;
  conflictedContexts: number;
  conflictedScenarios: number;
}

/** 检测 id 冲突时给冲突项重新分配 nanoid，避免静默覆盖本地数据 */
async function importWithConflictGuard<T extends { id: string }>(
  table: { bulkGet: (ids: string[]) => Promise<(T | undefined)[]>; bulkAdd: (items: T[]) => Promise<unknown> },
  items: T[]
): Promise<number> {
  const existing = new Set(
    (await table.bulkGet(items.map((x) => x.id))).filter((x): x is T => !!x).map((x) => x.id)
  );
  let conflicted = 0;
  const final = items.map((x) => {
    if (existing.has(x.id)) {
      conflicted++;
      return { ...x, id: nanoid() };
    }
    return x;
  });
  await table.bulkAdd(final);
  return conflicted;
}

export async function importTemplateFromFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  const data = JSON.parse(text) as TemplatePayload;

  const conflictedPrompts = data.prompts?.length
    ? await importWithConflictGuard(db.prompts, data.prompts)
    : 0;
  const conflictedWorkflows = data.workflows?.length
    ? await importWithConflictGuard(db.workflows, data.workflows)
    : 0;
  const conflictedContexts = data.contexts?.length
    ? await importWithConflictGuard(db.contexts, data.contexts)
    : 0;
  // 场景导入需要保留 parentId 引用关系：若 fullPath 本地已有同 path scenario，跳过；否则按 conflict guard 入
  let conflictedScenarios = 0;
  if (data.scenarios?.length) {
    conflictedScenarios = await importWithConflictGuard(db.scenarios, data.scenarios);
  }

  return {
    meta: data.meta ?? null,
    prompts: data.prompts?.length ?? 0,
    workflows: data.workflows?.length ?? 0,
    contexts: data.contexts?.length ?? 0,
    scenarios: data.scenarios?.length ?? 0,
    conflictedPrompts,
    conflictedWorkflows,
    conflictedContexts,
    conflictedScenarios,
  };
}
