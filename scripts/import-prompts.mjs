/**
 * 从 Prompt大全.md 提取并分类所有提示词，导出为 importable JSON
 * 运行：ANTHROPIC_API_KEY=xxx node scripts/import-prompts.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// ── 1. 解析 Markdown ─────────────────────────────────────────────────
function parsePrompts(md) {
  const results = [];
  const blockRe =
    /<a id='([^']+)'><\/a>\n###### (.+?)\n\n```(?:markdown)?\n([\s\S]+?)```/g;

  const lines = md.split("\n");
  let cat1 = "", cat2 = "", cat3 = "";
  const categoryMap = {};

  const TOP_CATS = ["读书场景","开发场景","AI提效与提示词工程","工作与商业场景","学习与认知场景","自媒体与创作场景"];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith("### ") && TOP_CATS.some(c => l.includes(c))) {
      cat1 = l.replace("### ", "").trim();
      cat2 = ""; cat3 = "";
    } else if (l.startsWith("#### ")) {
      cat2 = l.replace("#### ", "").trim(); cat3 = "";
    } else if (l.startsWith("##### ")) {
      cat3 = l.replace("##### ", "").trim();
    } else if (l.match(/^<a id='([^']+)'><\/a>$/)) {
      const id = l.match(/^<a id='([^']+)'><\/a>$/)[1];
      categoryMap[id] = { cat1, cat2, cat3 };
    }
  }

  let m;
  while ((m = blockRe.exec(md)) !== null) {
    const [, anchorId, title, body] = m;
    const cat = categoryMap[anchorId] || {};
    results.push({
      anchorId,
      title: title.trim(),
      body: body.trim(),
      originalCategory: [cat.cat1, cat.cat2, cat.cat3].filter(Boolean).join(" > "),
    });
  }
  return results;
}

// ── 2. 过滤规则 ─────────────────────────────────────────────────────
const SKIP_KEYWORDS = [
  "AGENTS.md - Your Workspace",
  "ChatGPT 4.5 System Prompt",
  "gemini 2.5 pro公开的参加奥数",
  "您是一个名为 Dia",
  "助手是由Anthropic创建的Claude",
  "请按如下设定更新你的system prompt",
  "背景：现在由于次窗口聊天记录已经过长",
  "请简单总结这个窗口的聊天记录",
];

function isNonPrompt(e) {
  if (SKIP_KEYWORDS.some(s => e.title.includes(s) || e.body.startsWith(s))) return true;
  if (e.body.includes("dia网页浏览器")) return true;
  if (e.body.includes("由anthropic创建的claude") && e.body.includes("知识库最后更新")) return true;
  if (e.body.trim().length < 30) return true;
  return false;
}

// ── 3. AI 批量分类 ───────────────────────────────────────────────────
const CLASSIFY_SYSTEM = `你是 Prompt 分类专家。给定一批提示词（标题+正文前300字），对每个进行分类。

一级场景必须从以下10项中选一：
工作场景 / 自媒体场景 / 学习场景 / 读书场景 / 写作场景 / 商业场景 / 个人成长场景 / 生活管理场景 / AI工具场景 / 知识管理场景

任务类型必须从以下选一：
分析 / 生成 / 改写 / 总结 / 规划 / 决策 / 复盘

仅输出 JSON 数组：
[{"index":0,"isRealPrompt":true,"title":"简短标题(最多15字)","summary":"一句话用途(20字内)","primaryScenario":["一级场景","二级","三级"],"taskType":"...","difficulty":"初级|中级|高级","valueLevel":"高频|高价值|战略型|辅助型","tags":["t1","t2","t3","t4","t5"],"inputRequirements":"...","outputFormat":"..."}]

isRealPrompt=false 的情况：系统提示词、教程、广告、纯笔记（不是可复用的提示词模板）。
仅输出JSON，不要解释。`;

async function classifyBatch(client, entries) {
  const msg = entries
    .map((e, i) => `[${i}] 标题：${e.title}\n正文：${e.body.slice(0, 300)}`)
    .join("\n\n---\n\n");

  const res = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: CLASSIFY_SYSTEM,
    messages: [{ role: "user", content: msg }],
  });
  const text = res.content.map(c => c.type === "text" ? c.text : "").join("");
  const hit = text.match(/\[[\s\S]*\]/);
  if (!hit) throw new Error("AI未返回JSON: " + text.slice(0, 200));
  return JSON.parse(hit[0]);
}

// ── 4. 主流程 ────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("请设置 ANTHROPIC_API_KEY"); process.exit(1); }
  const client = new Anthropic({ apiKey });

  console.log("读取文件...");
  const md = readFileSync(join(ROOT, "Prompt大全.md"), "utf-8");

  console.log("解析条目...");
  const all = parsePrompts(md);
  console.log(`  共 ${all.length} 个条目`);

  const candidates = all.filter(e => !isNonPrompt(e));
  console.log(`  过滤后 ${candidates.length} 个候选`);

  const BATCH = 8;
  const results = [];
  let kept = 0, dropped = 0;

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const batchNo = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(candidates.length / BATCH);
    process.stdout.write(`  批次 ${batchNo}/${total}... `);

    try {
      const cls = await classifyBatch(client, batch);
      for (let j = 0; j < batch.length; j++) {
        const r = cls.find(x => x.index === j);
        if (!r || !r.isRealPrompt) { dropped++; continue; }
        results.push({ entry: batch[j], cls: r, pending: false });
        kept++;
      }
      console.log(`保留 ${cls.filter(r => r.isRealPrompt).length}/${batch.length}`);
    } catch (err) {
      console.log(`失败(全部标记待确认): ${err.message.slice(0,60)}`);
      for (const e of batch) {
        results.push({ entry: e, cls: { title: e.title.slice(0,30), summary: "", primaryScenario: ["AI工具场景"], taskType: "生成", difficulty: "中级", valueLevel: "高频", tags: [], inputRequirements: "", outputFormat: "" }, pending: true });
        kept++;
      }
    }

    if (i + BATCH < candidates.length) await new Promise(r => setTimeout(r, 600));
  }

  const { nanoid } = await import("nanoid");
  const now = Date.now();

  const prompts = results.map(({ entry, cls, pending }) => ({
    id: nanoid(),
    title: cls.title || entry.title.slice(0, 40),
    body: entry.body,
    summary: cls.summary || "",
    primaryScenario: cls.primaryScenario || [],
    secondaryScenarios: [],
    taskType: cls.taskType || "生成",
    inputRequirements: cls.inputRequirements || "",
    outputFormat: cls.outputFormat || "",
    upstreamPrompts: [],
    downstreamPrompts: [],
    recommendedCombinations: [],
    boundaries: "",
    tags: cls.tags || [],
    difficulty: cls.difficulty || "中级",
    valueLevel: cls.valueLevel || "高频",
    shareable: true,
    isFavorited: false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
    classificationConfidence: pending ? 0.5 : 0.88,
    pendingReview: pending,
    _originalTitle: entry.title,
    _originalCategory: entry.originalCategory,
  }));

  const dist = {};
  for (const p of prompts) {
    const k = p.primaryScenario[0] || "未分类";
    dist[k] = (dist[k] || 0) + 1;
  }

  const outPath = join(ROOT, "scripts", "imported-prompts.json");
  writeFileSync(outPath, JSON.stringify({ prompts }, null, 2), "utf-8");

  console.log(`\n完成！保留 ${kept} 条，丢弃 ${dropped} 条`);
  console.log("\n场景分布：");
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${v} 条`);
  }
  console.log(`\n输出：${outPath}`);
}

main().catch(e => { console.error("错误:", e.message); process.exit(1); });
