import { db } from "@/db";
import type { Prompt } from "@/types";

export async function keywordSearch(q: string): Promise<Prompt[]> {
  const norm = q.trim().toLowerCase();
  if (!norm) return db.prompts.orderBy("updatedAt").reverse().limit(50).toArray();
  const all = await db.prompts.toArray();
  return all.filter(
    (p) =>
      p.title.toLowerCase().includes(norm) ||
      p.body.toLowerCase().includes(norm) ||
      p.summary.toLowerCase().includes(norm) ||
      p.tags.some((t) => t.toLowerCase().includes(norm))
  );
}
