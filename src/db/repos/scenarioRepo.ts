import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Scenario, Prompt } from "@/types";

export async function createScenario(
  input: Partial<Scenario> & { title: string }
): Promise<Scenario> {
  const parentId = input.parentId ?? null;
  // 新建节点默认追加到同层尾部：取当前最大 order + 10
  let order = input.order;
  if (order === undefined) {
    const siblings = await db.scenarios.filter((s) => s.parentId === parentId).toArray();
    order = siblings.reduce((mx, s) => Math.max(mx, s.order ?? 0), -10) + 10;
  }
  const s: Scenario = {
    id: nanoid(),
    title: input.title,
    parentId,
    level: input.level ?? 1,
    fullPath: input.fullPath ?? [input.title],
    description: input.description ?? "",
    tags: input.tags ?? [],
    order,
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

/**
 * 重命名场景节点，并级联更新：
 * 1) 自身 title + fullPath[level-1]
 * 2) 所有后代 scenarios 的 fullPath[level-1]（前缀对齐）
 * 3) 所有 prompts 的 primaryScenario / secondaryScenarios 中前缀匹配此节点路径的项
 *
 * 返回级联影响的 prompts 数量，方便上层提示用户。
 */
export async function renameScenario(id: string, nextTitle: string): Promise<{ touchedPrompts: number }> {
  const trimmed = nextTitle.trim();
  if (!trimmed) throw new Error("名称不能为空");

  const target = await db.scenarios.get(id);
  if (!target) throw new Error("场景不存在");
  if (target.title === trimmed) return { touchedPrompts: 0 };

  const oldPath = target.fullPath;
  const idx = target.level - 1;
  const newPath = [...oldPath];
  newPath[idx] = trimmed;

  // 级联更新自身 + 所有后代 scenarios 的 fullPath
  const allScenarios = await db.scenarios.toArray();
  const scenarioPatches: Scenario[] = [];
  for (const s of allScenarios) {
    if (s.id === id) {
      scenarioPatches.push({ ...s, title: trimmed, fullPath: newPath });
      continue;
    }
    if (s.fullPath.length > idx && pathStartsWith(s.fullPath, oldPath)) {
      const replaced = [...s.fullPath];
      replaced[idx] = trimmed;
      scenarioPatches.push({ ...s, fullPath: replaced });
    }
  }
  if (scenarioPatches.length) await db.scenarios.bulkPut(scenarioPatches);

  // 级联更新 prompts.primaryScenario / secondaryScenarios 中的路径前缀
  const allPrompts = await db.prompts.toArray();
  const promptPatches: Prompt[] = [];
  for (const p of allPrompts) {
    let dirty = false;
    let primary = p.primaryScenario;
    if (pathStartsWith(primary, oldPath)) {
      primary = [...primary];
      primary[idx] = trimmed;
      dirty = true;
    }
    let secondary = p.secondaryScenarios;
    if (secondary?.some((sp) => pathStartsWith(sp, oldPath))) {
      secondary = secondary.map((sp) => {
        if (!pathStartsWith(sp, oldPath)) return sp;
        const next = [...sp];
        next[idx] = trimmed;
        return next;
      });
      dirty = true;
    }
    if (dirty) {
      promptPatches.push({ ...p, primaryScenario: primary, secondaryScenarios: secondary, updatedAt: Date.now() });
    }
  }
  if (promptPatches.length) await db.prompts.bulkPut(promptPatches);

  return { touchedPrompts: promptPatches.length };
}

/**
 * 把同 parentId 内的兄弟节点按给定 id 顺序重新排序，写入 order = idx*10。
 * 调用方需保证传入的 ids 都属于同一个 parentId，否则返回 0。
 */
export async function reorderSiblings(orderedIds: string[]): Promise<number> {
  if (!orderedIds.length) return 0;
  const records = await db.scenarios.bulkGet(orderedIds);
  const valid = records.filter((s): s is Scenario => Boolean(s));
  if (valid.length !== orderedIds.length) return 0;
  const parent = valid[0].parentId;
  if (valid.some((s) => s.parentId !== parent)) return 0;
  const patches = valid.map((s, i) => ({ ...s, order: i * 10 }));
  await db.scenarios.bulkPut(patches);
  return patches.length;
}

function pathStartsWith(path: string[] | undefined, prefix: string[]): boolean {
  if (!path || path.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (path[i] !== prefix[i]) return false;
  return true;
}
