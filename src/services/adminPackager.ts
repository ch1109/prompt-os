import { db } from "@/db";
import type { Prompt, Scenario, TaskPack, TaskStage } from "@/types";
import type { TemplatePayload } from "./adminTemplate";

export interface SelectionIds {
  promptIds: string[];
  scenarioIds: string[];
  taskPackIds: string[];
}

export interface PackResult {
  payload: TemplatePayload;
  stats: { promptCount: number; scenarioCount: number; taskPackCount: number };
  warnings: string[];
}

/**
 * 从本地 IndexedDB 抽取选中内容，做两件事：
 *
 * 1. **自动闭包依赖**：
 *    - 选了 TaskPack 自动带其 sceneCategoryId 指向的 Scenario
 *    - 选了子 Scenario 自动带其 parentId 链上所有祖先
 *    - **不**自动带 Prompts（任务包/场景引用的未选 prompt 会从引用列表里剥离）
 *
 * 2. **id 命名空间隔离**：所有 id 重命名为 `tpl_<templateId>_<原 id>`，
 *    并同步修正所有交叉引用字段（避免兑换时与本地 seed 冲突）。
 */
export async function packTemplate(
  selection: SelectionIds,
  templateId: string
): Promise<PackResult> {
  const warnings: string[] = [];

  const [rawP, rawS, rawT] = await Promise.all([
    selection.promptIds.length
      ? db.prompts.bulkGet(selection.promptIds)
      : Promise.resolve([] as (Prompt | undefined)[]),
    selection.scenarioIds.length
      ? db.scenarios.bulkGet(selection.scenarioIds)
      : Promise.resolve([] as (Scenario | undefined)[]),
    selection.taskPackIds.length
      ? db.taskPacks.bulkGet(selection.taskPackIds)
      : Promise.resolve([] as (TaskPack | undefined)[]),
  ]);

  const prompts = rawP.filter((p): p is Prompt => !!p);
  const scenarios = rawS.filter((s): s is Scenario => !!s);
  const taskPacks = rawT.filter((t): t is TaskPack => !!t);

  // 自动闭包：TaskPack → Scenario
  const allScenarios = await db.scenarios.toArray();
  const sceneMap = new Map(allScenarios.map((s) => [s.id, s]));
  const sceneSet = new Set(scenarios.map((s) => s.id));

  for (const tp of taskPacks) {
    if (!sceneSet.has(tp.sceneCategoryId)) {
      const scene = sceneMap.get(tp.sceneCategoryId);
      if (scene) {
        scenarios.push(scene);
        sceneSet.add(scene.id);
        warnings.push(`任务包「${tp.title}」依赖的场景「${scene.title}」已自动包含`);
      } else {
        warnings.push(`任务包「${tp.title}」的 sceneCategoryId 在本地找不到，发布后用户兑换会出问题`);
      }
    }
  }

  // 自动闭包：Scenario → 祖先链
  const ancestorsAdded: string[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    let cursor: string | null = scenarios[i].parentId;
    while (cursor && !sceneSet.has(cursor)) {
      const parent = sceneMap.get(cursor);
      if (!parent) break;
      scenarios.push(parent);
      sceneSet.add(parent.id);
      ancestorsAdded.push(parent.title);
      cursor = parent.parentId;
    }
  }
  if (ancestorsAdded.length > 0) {
    warnings.push(`已自动包含 ${ancestorsAdded.length} 个父级场景：${ancestorsAdded.join("、")}`);
  }

  // 构建 idMap
  const cleanTplId = templateId.replace(/^tpl_/, "");
  const ns = `tpl_${cleanTplId}_`;
  const idMap = new Map<string, string>();
  for (const p of prompts) idMap.set(p.id, ns + p.id);
  for (const s of scenarios) idMap.set(s.id, ns + s.id);
  for (const t of taskPacks) idMap.set(t.id, ns + t.id);

  const remap = (id: string): string => idMap.get(id) ?? id;
  /** 过滤掉指向"未选中对象"的悬空引用，并把保留的引用重命名 */
  const remapInternalRefs = (ids: string[]): string[] =>
    ids.filter((id) => idMap.has(id)).map(remap);

  const finalPrompts: Prompt[] = prompts.map((p) => ({
    ...p,
    id: remap(p.id),
    upstreamPrompts: remapInternalRefs(p.upstreamPrompts),
    downstreamPrompts: remapInternalRefs(p.downstreamPrompts),
    recommendedCombinations: remapInternalRefs(p.recommendedCombinations),
  }));

  const finalScenarios: Scenario[] = scenarios.map((s) => ({
    ...s,
    id: remap(s.id),
    parentId: s.parentId && idMap.has(s.parentId) ? remap(s.parentId) : null,
    recommendedPrompts: s.recommendedPrompts
      ? remapInternalRefs(s.recommendedPrompts)
      : [],
  }));

  const finalTaskPacks: TaskPack[] = taskPacks.map((t) => ({
    ...t,
    id: remap(t.id),
    sceneCategoryId: remap(t.sceneCategoryId),
    stages: t.stages.map(
      (stage: TaskStage): TaskStage => ({
        ...stage,
        promptIds: remapInternalRefs(stage.promptIds),
      })
    ),
  }));

  return {
    payload: {
      prompts: finalPrompts,
      scenarios: finalScenarios,
      taskPacks: finalTaskPacks,
    },
    stats: {
      promptCount: finalPrompts.length,
      scenarioCount: finalScenarios.length,
      taskPackCount: finalTaskPacks.length,
    },
    warnings,
  };
}
