import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Context } from "@/types";

const now = () => Date.now();

export async function createContext(
  input: Partial<Context> & { title: string; content: string }
): Promise<Context> {
  const c: Context = {
    id: nanoid(),
    title: input.title,
    type: input.type ?? "个人背景",
    content: input.content,
    tags: input.tags ?? [],
    isDefault: input.isDefault ?? false,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.contexts.add(c);
  return c;
}

export const listContexts = () =>
  db.contexts.orderBy("updatedAt").reverse().toArray();

export const getContext = (id: string) => db.contexts.get(id);

export async function updateContext(id: string, patch: Partial<Context>) {
  await db.contexts.update(id, { ...patch, updatedAt: now() });
}

export const deleteContext = (id: string) => db.contexts.delete(id);
