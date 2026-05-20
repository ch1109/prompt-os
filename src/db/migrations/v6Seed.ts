import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Prompt, Scenario, TaskPack, TaskStage } from "@/types";

interface StageDef {
  name: string;
  description?: string;
  /** 模糊匹配关键词，用 OR 关系 */
  keywords: string[];
  limit?: number;
}

interface PackDef {
  title: string;
  goal: string;
  description: string;
  sceneTitle: string;
  tags: string[];
  stages: StageDef[];
}

const SEEDS: PackDef[] = [
  {
    title: "深度读完一本书",
    goal: "从理解一本到输出文章，形成完整读书工作流",
    description: "从选书判断到二次创作的完整读书闭环，4 个阶段帮你把一本书真正吸收为自己的知识。",
    sceneTitle: "读书场景",
    tags: ["读书", "知识管理"],
    stages: [
      {
        name: "选书与判断",
        description: "决定这本书是否值得花时间读完",
        keywords: ["选书", "判断", "试读", "评估"],
        limit: 3,
      },
      {
        name: "阅读中提炼",
        description: "边读边记录关键信息和金句",
        keywords: ["章节", "摘录", "金句", "笔记", "标注"],
        limit: 3,
      },
      {
        name: "结构化笔记",
        description: "把碎片信息组织成自己的知识结构",
        keywords: ["笔记", "结构", "思维导图", "框架"],
        limit: 3,
      },
      {
        name: "二次创作输出",
        description: "把书的内容输出为文章、解读或行动清单",
        keywords: ["二次创作", "公众号", "文章", "书评", "行动"],
        limit: 3,
      },
    ],
  },
  {
    title: "写一篇公众号文章",
    goal: "把一个想法打磨成一篇可发表的文章",
    description: "从选题到发布，把一个想法打磨成一篇可发表的文章。",
    sceneTitle: "写作场景",
    tags: ["写作", "自媒体"],
    stages: [
      { name: "选题立意", keywords: ["选题", "立意", "主题"], limit: 2 },
      { name: "大纲搭建", keywords: ["大纲", "结构", "提纲"], limit: 2 },
      { name: "初稿撰写", keywords: ["初稿", "写作", "文章", "撰写"], limit: 3 },
      { name: "润色发布", keywords: ["润色", "改写", "标题", "发布"], limit: 3 },
    ],
  },
  {
    title: "分析一个商业案例",
    goal: "结构化拆解一个商业现象，提炼可迁移结论",
    description: "从信息收集到迁移结论，结构化地拆解一个商业现象。",
    sceneTitle: "商业场景",
    tags: ["商业", "分析"],
    stages: [
      { name: "信息收集", keywords: ["收集", "调研", "信息"], limit: 2 },
      { name: "框架拆解", keywords: ["框架", "拆解", "分析"], limit: 3 },
      { name: "洞察提炼", keywords: ["洞察", "提炼", "总结"], limit: 3 },
      { name: "可迁移结论", keywords: ["复盘", "结论", "迁移", "经验"], limit: 2 },
    ],
  },
  {
    title: "准备一次产品方案",
    goal: "把一个产品想法整理成可评审、可决策的完整方案",
    description: "把一个产品想法整理成可评审、可决策的完整方案。",
    sceneTitle: "工作场景",
    tags: ["产品", "方案"],
    stages: [
      { name: "背景研究", keywords: ["背景", "研究", "调研"], limit: 2 },
      { name: "方案草拟", keywords: ["方案", "草拟", "设计"], limit: 2 },
      { name: "评审准备", keywords: ["评审", "汇报", "PPT", "演示"], limit: 2 },
      { name: "决策落地", keywords: ["决策", "落地", "执行"], limit: 2 },
    ],
  },
  {
    title: "整理一次会议纪要",
    goal: "把会议发言整理成结构化纪要并跟进行动项",
    description: "把会议中的发言整理成结构化纪要并跟进行动项。",
    sceneTitle: "工作场景",
    tags: ["会议", "纪要"],
    stages: [
      { name: "速记输入", keywords: ["速记", "记录", "录音"], limit: 2 },
      { name: "结构化整理", keywords: ["纪要", "整理", "结构"], limit: 2 },
      { name: "行动项提炼", keywords: ["行动", "todo", "任务"], limit: 2 },
      { name: "跟进发送", keywords: ["跟进", "发送", "邮件"], limit: 2 },
    ],
  },
  {
    title: "复盘一次项目",
    goal: "用结构化方式回顾一次项目，提炼可复用经验",
    description: "用结构化的方式回顾一次项目，提炼可复用的经验。",
    sceneTitle: "个人成长场景",
    tags: ["复盘", "成长"],
    stages: [
      { name: "事实回放", keywords: ["事实", "回放", "回顾"], limit: 2 },
      { name: "结果对比", keywords: ["对比", "目标", "结果"], limit: 2 },
      { name: "根因分析", keywords: ["根因", "原因", "分析"], limit: 3 },
      { name: "行动改进", keywords: ["行动", "改进", "下一步"], limit: 2 },
    ],
  },
];

function pickPromptsFor(
  prompts: Prompt[],
  catTitle: string,
  keywords: string[],
  limit: number
): string[] {
  const inScene = prompts.filter((p) => p.primaryScenario?.[0] === catTitle);
  const re = new RegExp(keywords.map(escape).join("|"), "i");
  const hit = inScene.filter((p) => {
    const hay = `${p.title} ${p.summary ?? ""} ${(p.tags ?? []).join(" ")}`;
    return re.test(hay);
  });
  if (hit.length === 0) return [];
  return hit.slice(0, limit).map((p) => p.id);
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function seedDefaultTaskPacks(): Promise<void> {
  const count = await db.taskPacks.count();
  if (count > 0) return;

  const [scenarios, prompts] = await Promise.all([
    db.scenarios.where("level").equals(1).toArray() as Promise<Scenario[]>,
    db.prompts.toArray(),
  ]);
  const sceneIdByTitle = new Map(scenarios.map((s) => [s.title, s.id]));
  if (sceneIdByTitle.size === 0) return;

  const now = Date.now();
  const packs: TaskPack[] = [];
  // 同 sceneId 内按 SEEDS 出现顺序赋 order = i*10
  const orderCounter = new Map<string, number>();

  for (const def of SEEDS) {
    const sceneId = sceneIdByTitle.get(def.sceneTitle);
    if (!sceneId) continue;
    const stages: TaskStage[] = def.stages.map((s, idx) => ({
      id: nanoid(),
      name: s.name,
      description: s.description,
      promptIds: pickPromptsFor(prompts, def.sceneTitle, s.keywords, s.limit ?? 3),
      order: idx,
    }));
    const orderIdx = orderCounter.get(sceneId) ?? 0;
    orderCounter.set(sceneId, orderIdx + 1);
    packs.push({
      id: nanoid(),
      title: def.title,
      goal: def.goal,
      description: def.description,
      sceneCategoryId: sceneId,
      stages,
      tags: def.tags,
      isFavorited: false,
      useCount: 0,
      lastUsedAt: null,
      order: orderIdx * 10,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!packs.length) return;
  await db.taskPacks.bulkAdd(packs);
  if (import.meta.env.DEV)
    console.log(`[Prompt OS] 已生成 ${packs.length} 个示例子场景`);
}
