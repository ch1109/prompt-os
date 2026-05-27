import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Context, ContextTriggerStrategy } from "@/types";

const now = () => Date.now();

export async function createContext(
  input: Partial<Context> & { title: string; content: string }
): Promise<Context> {
  const triggerStrategy: ContextTriggerStrategy =
    input.triggerStrategy ?? (input.isDefault ? "always" : "manual");
  const c: Context = {
    id: nanoid(),
    title: input.title,
    type: input.type ?? "自定义",
    content: input.content,
    tags: input.tags ?? [],
    isDefault: triggerStrategy === "always" ? true : input.isDefault ?? false,
    createdAt: now(),
    updatedAt: now(),
    description: input.description ?? "",
    triggerStrategy,
    triggerConditions: input.triggerConditions,
    scope: input.scope ?? "global",
    scopeRefs: input.scopeRefs,
    enabled: input.enabled ?? true,
  };
  await db.contexts.add(c);
  return c;
}

export const listContexts = () =>
  db.contexts.orderBy("updatedAt").reverse().toArray();

export const getContext = (id: string) => db.contexts.get(id);

export async function updateContext(id: string, patch: Partial<Context>) {
  const next: Partial<Context> = { ...patch, updatedAt: now() };
  // 兼容映射：triggerStrategy 与 isDefault 双向同步
  if ("triggerStrategy" in patch) {
    next.isDefault = patch.triggerStrategy === "always";
  } else if ("isDefault" in patch && patch.isDefault === true) {
    next.triggerStrategy = "always";
  }
  await db.contexts.update(id, next);
}

export const deleteContext = (id: string) => db.contexts.delete(id);

/** 读取统一入口：老数据缺 triggerStrategy 时按 isDefault 回退 */
export function getTriggerStrategy(c: Context): ContextTriggerStrategy {
  if (c.triggerStrategy) return c.triggerStrategy;
  return c.isDefault ? "always" : "manual";
}
