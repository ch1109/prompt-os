import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";

/**
 * 聚合 contexts + prompts 的标签，按使用频率倒序返回。
 * 用于 ContextTagInput 的自动补全候选。
 */
export function useAllTags(): string[] {
  const tags = useLiveQuery(async () => {
    const [contexts, prompts] = await Promise.all([
      db.contexts.toArray(),
      db.prompts.toArray(),
    ]);
    const counter = new Map<string, number>();
    for (const c of contexts) {
      for (const t of c.tags ?? []) {
        const key = t.trim();
        if (!key) continue;
        counter.set(key, (counter.get(key) ?? 0) + 1);
      }
    }
    for (const p of prompts) {
      for (const t of p.tags ?? []) {
        const key = t.trim();
        if (!key) continue;
        counter.set(key, (counter.get(key) ?? 0) + 1);
      }
    }
    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);
  });
  return tags ?? [];
}
