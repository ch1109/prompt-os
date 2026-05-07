import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const md = readFileSync(join(ROOT, "Prompt大全.md"), "utf-8");

// 统计锚点数和代码块数
const anchors = (md.match(/<a id='[^']+'/g) || []).length;
const blocks = (md.match(/```markdown/g) || []).length;
console.log(`锚点数: ${anchors}, markdown代码块数: ${blocks}`);

// 提取所有条目
const blockRe = /<a id='([^']+)'><\/a>\n###### (.+?)\n\n```(?:markdown)?\n([\s\S]+?)```/g;
const entries = [];
let m;
while ((m = blockRe.exec(md)) !== null) {
  const [, id, title, body] = m;
  entries.push({ id, title: title.trim(), bodyLen: body.trim().length });
}

console.log(`成功提取: ${entries.length} 个条目`);

// 显示前10条
console.log("\n前10条：");
entries.slice(0, 10).forEach((e, i) => {
  console.log(`  [${i+1}] ${e.title.slice(0,50)} (${e.bodyLen}字)`);
});

// 显示可能需要过滤的条目
const SKIP = ["AGENTS.md","ChatGPT 4.5","gemini 2.5 pro","Dia","Anthropic创建","system prompt","次窗口聊天","总结这个窗口"];
const toSkip = entries.filter(e => SKIP.some(s => e.title.includes(s) || e.title.toLowerCase().includes(s.toLowerCase())));
console.log(`\n建议过滤（非提示词）：${toSkip.length} 条`);
toSkip.forEach(e => console.log(`  - ${e.title.slice(0,60)}`));
