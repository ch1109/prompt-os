export type TaskType = "分析" | "生成" | "改写" | "总结" | "规划" | "决策" | "复盘";
export type Difficulty = "初级" | "中级" | "高级";
export type ValueLevel = "高频" | "高价值" | "战略型" | "辅助型";
export type ContextType =
  | "角色人格"
  | "用户背景"
  | "项目背景"
  | "领域知识"
  | "输出规范"
  | "风格指南"
  | "参考样例"
  | "约束规则"
  | "自定义";

export type ContextTriggerStrategy = "always" | "manual" | "conditional";
export type ContextScope = "global" | "scene_category" | "sub_scene";

export interface ContextTriggerConditions {
  scenarioIds?: string[];      // 命中场景（level=1）
  subScenarioIds?: string[];   // 命中子场景（level>=2）
  promptTags?: string[];       // 命中 Prompt 标签
  keywords?: string[];         // 命中关键词（出现在 prompt.body / title）
}

export interface ContextScopeRefs {
  scenarioIds?: string[];      // scope === "scene_category" 时使用
  subScenarioIds?: string[];   // scope === "sub_scene" 时使用
}

/** 旧 ContextType 字面量，仅用于 v9 升级映射，业务代码请使用新 ContextType */
export const LEGACY_CONTEXT_TYPES = [
  "个人背景",
  "职业身份",
  "当前项目",
  "长期目标",
  "输出风格",
  "任务背景",
  "产品介绍",
  "用户画像",
  "品牌信息",
  "常用限制条件",
] as const;
export type LegacyContextType = (typeof LEGACY_CONTEXT_TYPES)[number];

export interface Prompt {
  id: string;
  title: string;
  body: string;
  summary: string;
  taskIntent?: string; // 该 Prompt 解决的真实问题（PRD 12.6）
  primaryScenario: string[];
  secondaryScenarios: string[][];
  taskType: TaskType;
  inputRequirements: string;
  outputFormat: string;
  upstreamPrompts: string[];
  downstreamPrompts: string[];
  recommendedCombinations: string[];
  boundaries: string;
  tags: string[];
  difficulty: Difficulty;
  valueLevel: ValueLevel;
  shareable: boolean;
  isFavorited: boolean;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  classificationConfidence?: number;
  pendingReview?: boolean;
  boundContextIds?: string[]; // 与该 Prompt 绑定的常用上下文，调用时自动勾选
}

export interface Context {
  id: string;
  title: string;
  type: ContextType;
  content: string;
  tags: string[];
  /** 兼容字段：与 triggerStrategy === "always" 双向同步，保留以兼容老的 groupContexts 分组 */
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;

  // v9 起新增（全部可选，老数据缺省时按 getTriggerStrategy / scope 默认回退）
  description?: string;
  triggerStrategy?: ContextTriggerStrategy;
  triggerConditions?: ContextTriggerConditions;
  scope?: ContextScope;
  scopeRefs?: ContextScopeRefs;
  enabled?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  parentId: string | null;
  level: number; // 1 / 2 / 3
  fullPath: string[]; // 例如 ["读书场景","选书规划","选书与规划"]
  description: string;
  tags: string[];
  /** 同 parentId 兄弟节点内排序键，升序展示。出厂数据按 i*10 间隔预留插入空间。 */
  order: number;
  // PRD 10.3：场景内可绑定的资产引用与典型任务清单
  recommendedPrompts?: string[];
  recommendedWorkflows?: string[];
  recommendedContexts?: string[];
  typicalTasks?: string[];
}

/** @deprecated v6 起被 TaskStage 取代 */
export interface WorkflowStep {
  step: number;
  name: string;
  promptId: string | null;
  input: string;
  output: string;
  nextAction: string;
}

/** @deprecated v6 起被 TaskPack 取代 */
export interface Workflow {
  id: string;
  title: string;
  goal: string;
  steps: WorkflowStep[];
  finalOutput: string;
  boundaries: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  useCount?: number;
  lastUsedAt?: number | null;
}

// 子场景：场景大类下的「流程化解决方案」，由有序的阶段组成
export interface TaskStage {
  id: string;
  name: string;
  description?: string;
  promptIds: string[]; // 顺序即推荐使用顺序
  order: number;
}

export interface TaskPack {
  id: string;
  title: string;
  goal: string;            // 一句话目标（v2 新增）
  description: string;     // 更长的说明
  sceneCategoryId: string; // 必须指向 Scenario.id 且 Scenario.level === 1
  stages: TaskStage[];
  tags: string[];
  isFavorited: boolean;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  /** 同一 sceneCategoryId 下兄弟节点的排序键，升序展示。新建/迁移按 i*10 间隔预留插入空间。 */
  order: number;
}

export interface SharedTemplate {
  id: string;
  title: string;
  description: string;
  payload: {
    prompts?: Prompt[];
    workflows?: Workflow[];
    contexts?: Context[];
    scenarios?: Scenario[];
  };
  createdAt: number;
}
