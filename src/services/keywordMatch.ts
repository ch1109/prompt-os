import type { Context, Prompt, TaskPack } from "@/types";

// 关键字搜索的字段权重 + 排序工具。
// caller 传入原始 q，本模块统一做 trim + lowercase 归一化。空 q 一律返回 score 0。

const W_TITLE = 4;
const W_MID = 2; // summary / goal / tags
const W_LOW = 1; // body / description / content

function norm(q: string): string {
  return q.trim().toLowerCase();
}

function hit(field: string | undefined, q: string, weight: number): number {
  if (!field) return 0;
  return field.toLowerCase().includes(q) ? weight : 0;
}

function tagHit(tags: string[] | undefined, q: string, weight: number): number {
  if (!tags || tags.length === 0) return 0;
  return tags.some((t) => t.toLowerCase().includes(q)) ? weight : 0;
}

export function scorePrompt(p: Prompt, rawQ: string): number {
  const q = norm(rawQ);
  if (!q) return 0;
  return (
    hit(p.title, q, W_TITLE) +
    hit(p.summary, q, W_MID) +
    tagHit(p.tags, q, W_MID) +
    hit(p.body, q, W_LOW)
  );
}

export function scoreTaskPack(t: TaskPack, rawQ: string): number {
  const q = norm(rawQ);
  if (!q) return 0;
  return (
    hit(t.title, q, W_TITLE) +
    hit(t.goal, q, W_MID) +
    tagHit(t.tags, q, W_MID) +
    hit(t.description, q, W_LOW)
  );
}

export function scoreContext(c: Context, rawQ: string): number {
  const q = norm(rawQ);
  if (!q) return 0;
  return (
    hit(c.title, q, W_TITLE) +
    tagHit(c.tags, q, W_MID) +
    hit(c.content, q, W_LOW)
  );
}

/**
 * 在长文本里找 q 第一处位置，返回 { before, match, after } 三段，方便渲染为
 * `<>{before}<mark>{match}</mark>{after}</>`。前后各保留 radius 字符，超出原文用 "…" 收尾。
 * 空白（换行/多空格）折叠为单空格，避免在 truncate / line-clamp 容器里出现奇怪空隙。
 * 找不到匹配或 q 为空时返回 null。
 */
export function snippetAroundMatch(
  text: string,
  rawQ: string,
  radius = 30,
): { before: string; match: string; after: string } | null {
  const q = norm(rawQ);
  if (!q || !text) return null;
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return null;
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + q.length + radius);
  const collapse = (s: string) => s.replace(/\s+/g, " ");
  return {
    before: (start > 0 ? "…" : "") + collapse(text.slice(start, idx)),
    match: text.slice(idx, idx + q.length),
    after: collapse(text.slice(idx + q.length, end)) + (end < text.length ? "…" : ""),
  };
}

export function topKeywordHits<T extends { updatedAt: number }>(
  list: T[],
  scoreFn: (item: T, q: string) => number,
  rawQ: string,
  max = 8,
): T[] {
  if (!norm(rawQ)) return [];
  const scored: Array<{ item: T; score: number }> = [];
  for (const item of list) {
    const score = scoreFn(item, rawQ);
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || b.item.updatedAt - a.item.updatedAt);
  return scored.slice(0, max).map((s) => s.item);
}
