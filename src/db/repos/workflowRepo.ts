import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Workflow } from "@/types";

const now = () => Date.now();

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

export const listWorkflows = () =>
  db.workflows.orderBy("updatedAt").reverse().toArray();

export const getWorkflow = (id: string) => db.workflows.get(id);

export async function updateWorkflow(id: string, patch: Partial<Workflow>) {
  await db.workflows.update(id, { ...patch, updatedAt: now() });
}

export const deleteWorkflow = (id: string) => db.workflows.delete(id);
