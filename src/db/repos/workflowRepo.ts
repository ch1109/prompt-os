/**
 * @deprecated v6 起 Workflow 概念被 TaskPack 取代。该 repo 仅为保留类型签名兼容
 * services/backup.ts、services/templateExport.ts 等存量代码。新代码请使用 taskPackRepo。
 */
import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Workflow } from "@/types";

const now = () => Date.now();

/** @deprecated 改用 createTaskPack */
export async function createWorkflow(
  input: Partial<Workflow> & { title: string }
): Promise<Workflow> {
  const w: Workflow = {
    id: nanoid(),
    title: input.title,
    goal: input.goal ?? "",
    steps: input.steps ?? [],
    finalOutput: input.finalOutput ?? "",
    boundaries: input.boundaries ?? "",
    tags: input.tags ?? [],
    createdAt: now(),
    updatedAt: now(),
    useCount: 0,
    lastUsedAt: null,
  };
  await db.workflows.add(w);
  return w;
}

/** @deprecated 改用 listTaskPacks */
export const listWorkflows = () =>
  db.workflows.orderBy("updatedAt").reverse().toArray();

/** @deprecated 改用 getTaskPack */
export const getWorkflow = (id: string) => db.workflows.get(id);

/** @deprecated 改用 updateTaskPack */
export async function updateWorkflow(id: string, patch: Partial<Workflow>) {
  await db.workflows.update(id, { ...patch, updatedAt: now() });
}

/** @deprecated 改用 deleteTaskPack */
export const deleteWorkflow = (id: string) => db.workflows.delete(id);
