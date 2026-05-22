// 主工作台「打包为模板」用的场景子树收集逻辑
//
// 单场景打包（WorkbenchSidebar.handlePackToTemplate）和批量打包（BatchPackModal）
// 都用这套 helper：保证两条路径输出的 ids 集合规则完全一致。
//
// 收集规则与 handleSceneDelete 的子树判定保持一致（fullPath[0] === scene.title）。
import { db } from "@/db";
import type { Scenario, TaskPack } from "@/types";

export interface CollectedIds {
  sceneIds: string[];
  promptIds: string[];
  taskPackIds: string[];
}

/** 单个一级场景的子树收集：自身 + 同 fullPath[0] 的子场景 + 所属 prompts + 所属 taskPacks */
export async function collectSceneSubtree(
  scene: Scenario,
  allScenarios: Scenario[],
  packsByScene: Map<string, TaskPack[]>
): Promise<CollectedIds> {
  const sceneIds = [
    scene.id,
    ...allScenarios
      .filter((s) => s.id !== scene.id && s.fullPath?.[0] === scene.title)
      .map((s) => s.id),
  ];
  const promptIds = (
    await db.prompts
      .filter((p) => p.primaryScenario?.[0] === scene.title)
      .toArray()
  ).map((p) => p.id);
  const taskPackIds = (packsByScene.get(scene.id) ?? []).map((p) => p.id);
  return { sceneIds, promptIds, taskPackIds };
}

/** 多个一级场景聚合收集 + 去重 */
export async function collectMultiSceneSubtree(
  scenes: Scenario[],
  allScenarios: Scenario[],
  packsByScene: Map<string, TaskPack[]>
): Promise<CollectedIds> {
  const scenes_ = new Set<string>();
  const prompts = new Set<string>();
  const packs = new Set<string>();
  for (const scene of scenes) {
    const r = await collectSceneSubtree(scene, allScenarios, packsByScene);
    r.sceneIds.forEach((id) => scenes_.add(id));
    r.promptIds.forEach((id) => prompts.add(id));
    r.taskPackIds.forEach((id) => packs.add(id));
  }
  return {
    sceneIds: [...scenes_],
    promptIds: [...prompts],
    taskPackIds: [...packs],
  };
}
