import { db } from "./index";
import type { Prompt } from "@/types";

const SEED_URL = "/seed-prompts.json";

/**
 * 启动时幂等清洗 prompts.title。
 *
 * 用户的 IndexedDB 可能保留早期解析阶段写入的"用 body 截断当 title"的脏数据
 * （e.g. 截图里的 "Prompt:请以一个深度读者的身份..."），而 seedPromptsFromFile
 * 仅在 count===0 时跑，老库不会被覆盖。这里做一道兜底修复。
 *
 * 三层兜底：
 *  1. 通过 body 指纹匹配当前 seed-prompts.json 的标题（最准）
 *  2. summary 是简洁动宾结构（≤18 字、无标点）→ 用 summary
 *  3. 仍无 → 截前 12 字 + 去 markdown / 引号 / "Prompt:" 前缀
 */

const BAD_PUNCT = /[，。？：；,.?:;]/;
const BAD_PREFIX = /^(请[你以对帮把]|Prompt[:：]|[一二三四五六七八九十]、|[*#`>]|\[|（)/;

export function isBadTitle(title: string, body: string): boolean {
  if (!title) return true;
  if (title.length > 18) return true;
  if (BAD_PUNCT.test(title)) return true;
  if (BAD_PREFIX.test(title)) return true;
  if (title.endsWith("…") || title.endsWith("...")) return true;
  const tNorm = title.replace(/\s+/g, "").replace(/[*`]/g, "");
  const bNorm = (body || "").replace(/\s+/g, "").slice(0, 80);
  if (tNorm.length >= 10 && bNorm.startsWith(tNorm.slice(0, 10))) return true;
  return false;
}

function bodyFingerprint(body: string): string {
  return (body || "").replace(/\s+/g, "").slice(0, 80);
}

function ruleBasedFix(title: string): string {
  const cleaned = title
    .replace(/^[*#`>\[（\s]+/, "")
    .replace(/^(Prompt[:：]\s*)/i, "")
    .split(BAD_PUNCT)[0]
    .trim();
  return cleaned.slice(0, 12) || "未命名 Prompt";
}

export async function repairBadTitles(): Promise<number> {
  let seedIdx = new Map<string, string>();
  try {
    const res = await fetch(SEED_URL);
    if (res.ok) {
      const data = (await res.json()) as { prompts: Prompt[] };
      for (const p of data.prompts) {
        seedIdx.set(bodyFingerprint(p.body), p.title);
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[repairTitles] seed fetch failed", e);
  }

  const all = await db.prompts.toArray();
  const updates: { id: string; title: string }[] = [];

  for (const p of all) {
    if (!isBadTitle(p.title, p.body)) continue;

    const fpHit = seedIdx.get(bodyFingerprint(p.body));
    let nextTitle: string;

    if (fpHit && fpHit !== p.title) {
      nextTitle = fpHit;
    } else if (p.summary && p.summary.length <= 18 && !isBadTitle(p.summary, p.body)) {
      nextTitle = p.summary;
    } else {
      nextTitle = ruleBasedFix(p.title);
    }

    if (nextTitle && nextTitle !== p.title) {
      updates.push({ id: p.id, title: nextTitle });
    }
  }

  if (updates.length) {
    await db.transaction("rw", db.prompts, async () => {
      for (const u of updates) {
        await db.prompts.update(u.id, { title: u.title });
      }
    });
    if (import.meta.env.DEV) {
      console.log(`[Prompt OS] 已修复 ${updates.length} 条问题标题`);
    }
  }
  return updates.length;
}
