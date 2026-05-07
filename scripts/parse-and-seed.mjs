/**
 * 解析 Prompt大全.md，映射分类，生成 seed-prompts.json
 * 运行：node scripts/parse-and-seed.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// 现有分类 → PRD 10 个场景的映射
const CAT_MAP = {
  "读书场景": "读书场景",
  "开发场景": "工作场景",
  "AI提效与提示词工程": "AI工具场景",
  "工作与商业场景 > 商业规划": "商业场景",
  "工作与商业场景 > 商务沟通": "工作场景",
  "工作与商业场景 > 产品设计": "工作场景",
  "工作与商业场景 > 会议协作": "工作场景",
  "工作与商业场景 > 工作复盘": "个人成长场景",
  "工作与商业场景": "工作场景",
  "学习与认知场景 > 知识理解": "学习场景",
  "学习与认知场景 > 知识整理": "知识管理场景",
  "学习与认知场景 > 深度思考": "个人成长场景",
  "学习与认知场景 > 学习规划": "学习场景",
  "学习与认知场景": "学习场景",
  "自媒体与创作场景 > 内容分发": "自媒体场景",
  "自媒体与创作场景 > 账号与选题": "自媒体场景",
  "自媒体与创作场景 > 内容生产": "写作场景",
  "自媒体与创作场景": "自媒体场景",
};

// 二级→子场景映射
const SUB_MAP = {
  "选书与规划": "选书规划",
  "二次创作": "读后创作",
  "读书笔记与提炼": "笔记提炼",
  "深度理解": "深度阅读",
  "功能实现与分析": "代码开发",
  "专家角色扮演": "角色扮演",
  "框架与元指令": "提示词设计",
  "提示词优化": "提示词优化",
  "策略分析": "策略分析",
  "邮件撰写": "商务沟通",
  "需求与方案": "产品设计",
  "会议纪要": "会议协作",
  "深度总结": "工作复盘",
  "概念拆解": "概念拆解",
  "知识体系构建": "知识体系",
  "思维模型运用": "思维模型",
  "入门新领域": "入门学习",
  "平台适配": "平台适配",
  "选题策划": "选题策划",
  "高转化文案撰写": "文案写作",
};

// 现有原始分类 → taskType 推断
function inferTaskType(originalCategory, title, body) {
  const text = (title + " " + body).toLowerCase();
  if (text.includes("分析") || text.includes("拆解") || text.includes("解析")) return "分析";
  if (text.includes("改写") || text.includes("优化") || text.includes("重写") || text.includes("提炼")) return "改写";
  if (text.includes("总结") || text.includes("精华") || text.includes("萃取") || text.includes("提取")) return "总结";
  if (text.includes("规划") || text.includes("计划") || text.includes("路径") || text.includes("体系")) return "规划";
  if (text.includes("决策") || text.includes("选择") || text.includes("判断")) return "决策";
  if (text.includes("复盘") || text.includes("回顾") || text.includes("反思")) return "复盘";
  return "生成";
}

// 推断难度
function inferDifficulty(body) {
  const len = body.length;
  if (len > 3000) return "高级";
  if (len > 1000) return "中级";
  return "初级";
}

// 推断价值等级
function inferValueLevel(title, body) {
  const text = title + body;
  if (text.includes("终极") || text.includes("战略") || text.includes("系统") || text.includes("框架")) return "战略型";
  if (text.includes("高效") || text.includes("快速") || text.includes("日常") || text.includes("每次")) return "高频";
  if (text.includes("深度") || text.includes("核心") || text.includes("精华") || text.includes("顶级")) return "高价值";
  return "高频";
}

// 提取标签
function extractTags(title, body, cat1) {
  const tags = new Set();
  if (cat1) tags.add(cat1.replace("场景",""));
  
  const keywords = ["提示词","学习","写作","分析","总结","创作","思维","知识","框架","工作流",
    "文案","内容","商业","复盘","规划","阅读","读书","AI","自媒体","小红书","深度","效率"];
  const text = title + " " + body;
  for (const kw of keywords) {
    if (text.includes(kw)) tags.add(kw);
    if (tags.size >= 6) break;
  }
  return [...tags].slice(0, 6);
}

// 清理标题（去除模板标记、版本号等）
function cleanTitle(title) {
  return title
    .replace(/\s*v\d+\.\d+\s*/i, "")
    .replace(/【|】/g, "")
    .replace(/^\s+|\s+$/g, "")
    .slice(0, 40);
}

// 生成摘要（取正文前40字）
function genSummary(body) {
  return body.replace(/\n+/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
}

const SKIP_KEYWORDS = [
  "AGENTS.md","ChatGPT 4.5","gemini 2.5 pro","您是一个名为 Dia",
  "Anthropic创建的Claude","请按如下设定更新你的system prompt",
  "次窗口聊天记录已经过长","请简单总结这个窗口",
];

const md = readFileSync(join(ROOT, "Prompt大全.md"), "utf-8");

// 解析
const blockRe = /<a id='([^']+)'><\/a>\n###### (.+?)\n\n```(?:markdown)?\n([\s\S]+?)```/g;
const lines = md.split("\n");
const TOP_CATS = ["读书场景","开发场景","AI提效与提示词工程","工作与商业场景","学习与认知场景","自媒体与创作场景"];
let cat1="",cat2="",cat3="";
const catMap = {};
for (let i=0; i<lines.length; i++) {
  const l = lines[i];
  if (l.startsWith("### ") && TOP_CATS.some(c=>l.includes(c))) { cat1=l.replace("### ","").trim(); cat2=""; cat3=""; }
  else if (l.startsWith("#### ")) { cat2=l.replace("#### ","").trim(); cat3=""; }
  else if (l.startsWith("##### ")) { cat3=l.replace("##### ","").trim(); }
  else if (l.match(/^<a id='([^']+)'><\/a>$/)) {
    const id = l.match(/^<a id='([^']+)'><\/a>$/)[1];
    catMap[id] = { cat1, cat2, cat3 };
  }
}

const entries = [];
let m;
while ((m = blockRe.exec(md)) !== null) {
  const [,id,title,body] = m;
  entries.push({ id, title: title.trim(), body: body.trim(), cat: catMap[id]||{} });
}
console.log(`解析到 ${entries.length} 个条目`);

// 过滤
const valid = entries.filter(e => {
  if (SKIP_KEYWORDS.some(s=>e.title.includes(s)||e.body.includes(s))) return false;
  if (e.body.trim().length < 30) return false;
  if (e.body.includes("dia网页浏览器")) return false;
  return true;
});
console.log(`过滤后 ${valid.length} 个有效提示词`);

// 生成
const { nanoid: genId } = await import("nanoid");

// 简单 ID 生成

const now = Date.now();
const prompts = valid.map(e => {
  const { cat1: c1, cat2: c2, cat3: c3 } = e.cat;
  
  // 确定一级场景
  const catKey = [c1, c2].filter(Boolean).join(" > ");
  const scenario1 = CAT_MAP[catKey] || CAT_MAP[c1] || (c1||"AI工具场景");
  const scenario2 = SUB_MAP[c3] || SUB_MAP[c2] || c2 || "";
  const scenario3 = c3 || "";
  
  const primaryScenario = [scenario1, scenario2, scenario3].filter(Boolean);
  
  return {
    id: genId(),
    title: cleanTitle(e.title),
    body: e.body,
    summary: genSummary(e.body),
    primaryScenario,
    secondaryScenarios: [],
    taskType: inferTaskType(c1, e.title, e.body),
    inputRequirements: "",
    outputFormat: "",
    upstreamPrompts: [],
    downstreamPrompts: [],
    recommendedCombinations: [],
    boundaries: "",
    tags: extractTags(e.title, e.body, scenario1),
    difficulty: inferDifficulty(e.body),
    valueLevel: inferValueLevel(e.title, e.body),
    shareable: true,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    classificationConfidence: 0.75,
    pendingReview: false,
    _originalTitle: e.title,
    _originalCategory: [c1,c2,c3].filter(Boolean).join(" > "),
  };
});

// 统计
const dist = {};
for (const p of prompts) {
  const k = p.primaryScenario[0] || "未分类";
  dist[k] = (dist[k]||0) + 1;
}
console.log("\n场景分布：");
for (const [k,v] of Object.entries(dist).sort((a,b)=>b[1]-a[1])) {
  console.log(`  ${k.padEnd(14)} ${v} 条`);
}

const outPath = join(ROOT, "src", "db", "seed-prompts.json");
writeFileSync(outPath, JSON.stringify({ prompts }, null, 2), "utf-8");
console.log(`\n输出到 ${outPath} (${prompts.length} 条)`);
