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
  level: number;
  description: string;
  tags: string[];
}

export interface WorkflowStep {
  step: number;
  name: string;
  promptId: string | null;
  input: string;
  output: string;
  nextAction: string;
}

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
