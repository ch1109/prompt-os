import type { WorkflowStep } from "@/types";

export interface WorkflowTemplate {
  id: string;
  title: string;
  goal: string;
  tags: string[];
  boundaries: string;
  steps: WorkflowStep[];
}

/**
 * 内置工作流模板：每个 step 关联到已有的占位 prompt（ph-* id），
 * 让新建工作流可以直接接入完整的提示词链路。
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "tpl-meeting",
    title: "会议全链路",
    goal: "从会前准备到会后跟进，把一次会议的产出最大化",
    tags: ["工作", "会议"],
    boundaries: "适合 30-90 分钟的工作会议",
    steps: [
      {
        step: 1,
        name: "会前 · 生成议程",
        promptId: "ph-meeting-001",
        input: "主题、参会人、时长、必谈事项",
        output: "结构化议程 + 准备清单",
        nextAction: "把议程发给参会人，留出准备时间",
      },
      {
        step: 2,
        name: "会前 · 梳理讨论问题",
        promptId: "ph-meeting-002",
        input: "议程关键议题",
        output: "5-8 个核心问题，按优先级排序",
        nextAction: "进入会议，按问题清单推进",
      },
      {
        step: 3,
        name: "会中 · 整理纪要",
        promptId: "ph-meeting-003",
        input: "录音转写或现场速记",
        output: "决策 + 行动项 + 讨论要点",
        nextAction: "进入下一步提炼行动项",
      },
      {
        step: 4,
        name: "会后 · 提炼行动项",
        promptId: "ph-meeting-004",
        input: "纪要正文",
        output: "可执行清单：人 / 事 / 截止 / 优先级",
        nextAction: "整合到跟进邮件",
      },
      {
        step: 5,
        name: "会后 · 发送跟进邮件",
        promptId: "ph-meeting-005",
        input: "纪要 + 行动项 + 收件人",
        output: "专业跟进邮件全文",
        nextAction: "发送，定期追踪行动项进度",
      },
    ],
  },
  {
    id: "tpl-reading",
    title: "深度读书链路",
    goal: "从选书到二次创作，让一本书产生多种产出",
    tags: ["读书", "学习"],
    boundaries: "适合非虚构 / 商业 / 思维类书籍",
    steps: [
      {
        step: 1,
        name: "阅读前 · 判断是否值得读",
        promptId: "ph-read-001",
        input: "书名、作者、目录、推荐语",
        output: "5 维度评分 + 是否推荐",
        nextAction: "若值得读，进入下一步",
      },
      {
        step: 2,
        name: "阅读前 · 生成阅读问题清单",
        promptId: "ph-read-003",
        input: "目录 + 阅读目的",
        output: "10 个读前核心问题",
        nextAction: "带着问题开始阅读",
      },
      {
        step: 3,
        name: "阅读中 · 提炼章节核心",
        promptId: "ph-read-005",
        input: "章节内容",
        output: "1 句核心 + 3 支撑 + 1 反例",
        nextAction: "为每章重复此步",
      },
      {
        step: 4,
        name: "阅读后 · 生成结构化笔记",
        promptId: "ph-read-009",
        input: "全书摘录 + 个人感受",
        output: "5 段式笔记 + 索引",
        nextAction: "进入二次创作",
      },
      {
        step: 5,
        name: "二次创作 · 写书评 / 分享稿",
        promptId: "ph-read-011",
        input: "笔记 + 目标受众",
        output: "2000 字深度书评",
        nextAction: "发布到目标平台",
      },
    ],
  },
  {
    id: "tpl-content",
    title: "自媒体内容生产",
    goal: "从选题到复盘的完整内容生产链",
    tags: ["自媒体", "内容"],
    boundaries: "适合图文 / 短视频 / 公众号场景",
    steps: [
      {
        step: 1,
        name: "选题 · 拆解用户痛点",
        promptId: "ph-media-004",
        input: "目标用户群体描述",
        output: "痛点地图 + 内容钩子",
        nextAction: "据此构思具体选题",
      },
      {
        step: 2,
        name: "选题 · 判断传播潜力",
        promptId: "ph-media-002",
        input: "选题概述、平台、近期数据",
        output: "评分 + 取舍建议",
        nextAction: "若值得做，进入生产",
      },
      {
        step: 3,
        name: "生产 · 生成标题",
        promptId: "ph-media-005",
        input: "笔记主题、目标读者、核心价值",
        output: "10 个不同钩子标题",
        nextAction: "选 1 个标题进入正文",
      },
      {
        step: 4,
        name: "生产 · 生成正文",
        promptId: "ph-media-006",
        input: "标题 + 核心信息点 + 个人体验",
        output: "完整正文 + 标签",
        nextAction: "发布",
      },
      {
        step: 5,
        name: "复盘 · 分析数据",
        promptId: "ph-media-010",
        input: "数据 + 评论关键词",
        output: "下次改进方向",
        nextAction: "用于下一篇选题",
      },
    ],
  },
  {
    id: "tpl-learning",
    title: "新领域入门",
    goal: "30 天从零到能做项目",
    tags: ["学习", "成长"],
    boundaries: "适合技能型领域，每天可投入 1-2 小时",
    steps: [
      {
        step: 1,
        name: "建立地图",
        promptId: "ph-learn-001",
        input: "目标领域、当前水平、学习目的",
        output: "三层知识树 + 必读资源",
        nextAction: "据此制定计划",
      },
      {
        step: 2,
        name: "制定 30 天计划",
        promptId: "ph-learn-002",
        input: "学习领域、每日时间、目标",
        output: "4 周计划 + 里程碑",
        nextAction: "开始第 1 周",
      },
      {
        step: 3,
        name: "深化 · 用类比理解",
        promptId: "ph-learn-005",
        input: "本周难点概念",
        output: "3 个类比 + 反例对比",
        nextAction: "巩固概念后做练习",
      },
      {
        step: 4,
        name: "深化 · 多视角分析",
        promptId: "ph-learn-007",
        input: "阶段性问题或现象",
        output: "5 视角分析 + 综合判断",
        nextAction: "形成自己的判断",
      },
    ],
  },
];
