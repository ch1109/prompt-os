import { nanoid } from "nanoid";
import { db } from "@/db";
import type { TaskPack, TaskStage } from "@/types";

const now = () => Date.now();

function normalizeStages(stages: TaskStage[] | undefined): TaskStage[] {
  if (!stages || stages.length === 0) return [];
  return stages.map((stage, idx) => ({
    id: stage.id ?? nanoid(),
    name: stage.name ?? "",
    description: stage.description,
    promptIds: stage.promptIds ?? [],
    order: idx,
  }));
}

export async function createTaskPack(
  input: Partial<TaskPack> & { title: string; sceneCategoryId: string }
): Promise<TaskPack> {
  const pack: TaskPack = {
    id: nanoid(),
    title: input.title,
    goal: input.goal ?? "",
    description: input.description ?? "",
    sceneCategoryId: input.sceneCategoryId,
    stages: normalizeStages(input.stages),
    tags: input.tags ?? [],
    isFavorited: input.isFavorited ?? false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.taskPacks.add(pack);
  return pack;
}

export const listTaskPacks = () =>
  db.taskPacks.orderBy("updatedAt").reverse().toArray();

export const getTaskPack = (id: string) => db.taskPacks.get(id);

export async function updateTaskPack(id: string, patch: Partial<TaskPack>) {
  const next: Partial<TaskPack> = { ...patch, updatedAt: now() };
  if (patch.stages) next.stages = normalizeStages(patch.stages);
  if (patch.tags) next.tags = patch.tags;
  await db.taskPacks.update(id, next);
}

export const deleteTaskPack = (id: string) => db.taskPacks.delete(id);

export const listByScene = (sceneCategoryId: string) =>
  db.taskPacks.where("sceneCategoryId").equals(sceneCategoryId).toArray();

export const listFavorites = () =>
  db.taskPacks.filter((p) => !!p.isFavorited).toArray();

export async function listRecent(limit = 20): Promise<TaskPack[]> {
  const all = await db.taskPacks.toArray();
  return all
    .filter((p) => p.lastUsedAt != null)
    .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
    .slice(0, limit);
}

export async function toggleFavorite(id: string) {
  const p = await db.taskPacks.get(id);
  if (!p) return;
  await db.taskPacks.update(id, {
    isFavorited: !p.isFavorited,
    updatedAt: now(),
  });
}

export async function incrementUseCount(id: string) {
  const p = await db.taskPacks.get(id);
  if (!p) return;
  await db.taskPacks.update(id, {
    useCount: (p.useCount ?? 0) + 1,
    lastUsedAt: now(),
  });
}

export async function bulkInsert(packs: TaskPack[]) {
  await db.taskPacks.bulkAdd(packs);
}
