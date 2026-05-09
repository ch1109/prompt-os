import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Scenario } from "@/types";

export async function createScenario(
  input: Partial<Scenario> & { title: string }
): Promise<Scenario> {
  const s: Scenario = {
    id: nanoid(),
    title: input.title,
    parentId: input.parentId ?? null,
    level: input.level ?? 1,
    fullPath: input.fullPath ?? [input.title],
    description: input.description ?? "",
    tags: input.tags ?? [],
    recommendedPrompts: input.recommendedPrompts ?? [],
    recommendedWorkflows: input.recommendedWorkflows ?? [],
    recommendedContexts: input.recommendedContexts ?? [],
    typicalTasks: input.typicalTasks ?? [],
  };
  await db.scenarios.add(s);
  return s;
}

export const listScenarios = () => db.scenarios.toArray();
export const getScenario = (id: string) => db.scenarios.get(id);

export async function updateScenario(id: string, patch: Partial<Scenario>) {
  await db.scenarios.update(id, patch);
}

export const deleteScenario = (id: string) => db.scenarios.delete(id);
