export type TaskType = "分析" | "生成" | "改写" | "总结" | "规划" | "决策" | "复盘";
export type Difficulty = "初级" | "中级" | "高级";
export type ValueLevel = "高频" | "高价值" | "战略型" | "辅助型";
export type ContextType =
  | "个人背景"
  | "职业身份"
  | "当前项目"
  | "长期目标"
  | "输出风格"
  | "任务背景"
  | "产品介绍"
  | "用户画像"
  | "品牌信息"
  | "常用限制条件";

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
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
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
