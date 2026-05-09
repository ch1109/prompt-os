import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Prompt } from "@/types";

const now = () => Date.now();

export async function createPrompt(
  input: Partial<Prompt> & { title: string; body: string }
): Promise<Prompt> {
  const p: Prompt = {
    id: nanoid(),
    title: input.title,
    body: input.body,
    summary: input.summary ?? "",
    primaryScenario: input.primaryScenario ?? [],
    secondaryScenarios: input.secondaryScenarios ?? [],
    taskType: input.taskType ?? "生成",
    inputRequirements: input.inputRequirements ?? "",
    outputFormat: input.outputFormat ?? "",
    upstreamPrompts: input.upstreamPrompts ?? [],
    downstreamPrompts: input.downstreamPrompts ?? [],
    recommendedCombinations: input.recommendedCombinations ?? [],
    boundaries: input.boundaries ?? "",
    tags: input.tags ?? [],
    difficulty: input.difficulty ?? "初级",
    valueLevel: input.valueLevel ?? "高频",
    shareable: input.shareable ?? true,
    isFavorited: input.isFavorited ?? false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now(),
    updatedAt: now(),
    classificationConfidence: input.classificationConfidence,
    pendingReview: input.pendingReview ?? false,
    boundContextIds: input.boundContextIds ?? [],
  };
  await db.prompts.add(p);
  return p;
}

export const listPrompts = () =>
  db.prompts.orderBy("updatedAt").reverse().toArray();

export const getPrompt = (id: string) => db.prompts.get(id);

export async function updatePrompt(id: string, patch: Partial<Prompt>) {
  await db.prompts.update(id, { ...patch, updatedAt: now() });
}

export const deletePrompt = (id: string) => db.prompts.delete(id);

export async function toggleFavorite(id: string) {
  const p = await db.prompts.get(id);
  if (!p) return;
  await db.prompts.update(id, { isFavorited: !p.isFavorited, updatedAt: now() });
}

export async function incrementUseCount(id: string) {
  const p = await db.prompts.get(id);
  if (!p) return;
  await db.prompts.update(id, {
    useCount: (p.useCount ?? 0) + 1,
    lastUsedAt: now(),
  });
}

export async function bulkInsert(prompts: Prompt[]) {
  await db.prompts.bulkAdd(prompts);
}
