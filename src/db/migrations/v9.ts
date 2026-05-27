import type { Transaction } from "dexie";
import type { Context, ContextType, LegacyContextType } from "@/types";

/**
 * v9 升级：ContextType 联合完全替换为新 9 类。
 *
 * - 旧 10 类按下方映射表一次性写入新值；
 * - 同时给所有 contexts 补默认的 triggerStrategy / scope / enabled，
 *   isDefault === true 的同步标记为 "always"；
 * - 调用方需先 writeMigrationArchive 归档老 contexts，本函数只负责改表。
 */
const LEGACY_TYPE_MAP: Record<LegacyContextType, ContextType> = {
  个人背景: "用户背景",
  职业身份: "用户背景",
  当前项目: "项目背景",
  长期目标: "项目背景",
  输出风格: "风格指南",
  任务背景: "项目背景",
  产品介绍: "项目背景",
  用户画像: "用户背景",
  品牌信息: "风格指南",
  常用限制条件: "约束规则",
};

const NEW_TYPES: ReadonlySet<string> = new Set<ContextType>([
  "角色人格",
  "用户背景",
  "项目背景",
  "领域知识",
  "输出规范",
  "风格指南",
  "参考样例",
  "约束规则",
  "自定义",
]);

function remapType(raw: string | undefined): ContextType {
  if (raw && NEW_TYPES.has(raw)) return raw as ContextType;
  if (raw && raw in LEGACY_TYPE_MAP) {
    return LEGACY_TYPE_MAP[raw as LegacyContextType];
  }
  return "自定义";
}

export async function migrateContextTypesV9(tx: Transaction): Promise<void> {
  const table = tx.table<Context>("contexts");
  const all = await table.toArray();
  if (all.length === 0) return;

  const patched: Context[] = all.map((c) => {
    const isAlways = c.isDefault === true;
    return {
      ...c,
      type: remapType(c.type as unknown as string),
      triggerStrategy: c.triggerStrategy ?? (isAlways ? "always" : "manual"),
      scope: c.scope ?? "global",
      enabled: c.enabled ?? true,
    };
  });

  await table.bulkPut(patched);
  console.log(`[Prompt OS v9] 已归一 ${patched.length} 条上下文类型与触发策略`);
}
