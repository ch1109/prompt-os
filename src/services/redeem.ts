import { db } from "@/db";
import { supabase, isSupabaseConfigured } from "./supabase";
import { getFingerprint } from "@/lib/fingerprint";
import type { Prompt, Scenario, TaskPack } from "@/types";

/** 模板包结构（与 Supabase templates.payload jsonb 对应） */
export interface TemplatePayload {
  prompts: Prompt[];
  scenarios: Scenario[];
  taskPacks: TaskPack[];
}

export interface RedeemStats {
  prompts: number;
  scenarios: number;
  taskPacks: number;
}

export interface ConflictResult {
  promptConflicts: string[];
  scenarioConflicts: string[];
  taskPackConflicts: string[];
  total: number;
}

export type RedeemErrorCode =
  | "NO_SUPABASE"
  | "INVALID_CODE"
  | "CODE_ALREADY_USED"
  | "CODE_EXPIRED"
  | "CODE_REVOKED"
  | "TEMPLATE_NOT_FOUND"
  | "CONFLICT"
  | "NETWORK_ERROR";

export class RedeemError extends Error {
  code: RedeemErrorCode;
  conflicts?: ConflictResult;
  constructor(code: RedeemErrorCode, conflicts?: ConflictResult) {
    super(code);
    this.code = code;
    this.conflicts = conflicts;
    this.name = "RedeemError";
  }
}

/** 把用户输入的码统一格式化：去空白、大写、保留破折号 */
export function normalizeCode(input: string): string {
  return input.replace(/\s/g, "").toUpperCase();
}

/**
 * dry-run 预览：从 Supabase 拉取模板内容，本地检查 id 冲突
 * 不消耗邀请码。
 */
export async function previewCode(code: string): Promise<{
  payload: TemplatePayload;
  conflicts: ConflictResult;
  stats: RedeemStats;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new RedeemError("NO_SUPABASE");
  }
  const normalized = normalizeCode(code);
  const { data, error } = await supabase.rpc("preview_invite_code", {
    p_code: normalized,
  });
  if (error) throw mapRpcError(error.message);

  const payload = data as TemplatePayload;
  const conflicts = await checkConflicts(payload);
  return {
    payload,
    conflicts,
    stats: {
      prompts: payload.prompts?.length ?? 0,
      scenarios: payload.scenarios?.length ?? 0,
      taskPacks: payload.taskPacks?.length ?? 0,
    },
  };
}

/**
 * 检查模板 id 与本地 IndexedDB 是否冲突
 * 用「冲突即拒绝」策略保护交叉引用链路完整性
 */
export async function checkConflicts(
  payload: TemplatePayload
): Promise<ConflictResult> {
  const promptIds = payload.prompts?.map((p) => p.id) ?? [];
  const scenarioIds = payload.scenarios?.map((s) => s.id) ?? [];
  const taskPackIds = payload.taskPacks?.map((t) => t.id) ?? [];

  const [existPrompts, existScenarios, existTaskPacks] = await Promise.all([
    promptIds.length ? db.prompts.bulkGet(promptIds) : Promise.resolve([]),
    scenarioIds.length ? db.scenarios.bulkGet(scenarioIds) : Promise.resolve([]),
    taskPackIds.length ? db.taskPacks.bulkGet(taskPackIds) : Promise.resolve([]),
  ]);

  const promptConflicts = promptIds.filter((_, i) => !!existPrompts[i]);
  const scenarioConflicts = scenarioIds.filter((_, i) => !!existScenarios[i]);
  const taskPackConflicts = taskPackIds.filter((_, i) => !!existTaskPacks[i]);

  return {
    promptConflicts,
    scenarioConflicts,
    taskPackConflicts,
    total:
      promptConflicts.length +
      scenarioConflicts.length +
      taskPackConflicts.length,
  };
}

/**
 * 真兑换：内部先 dry-run 冲突预检 → 通过才调用核销 RPC → 写本地库
 *
 * 安全保证：冲突预检失败时立即 abort，邀请码不被消耗。
 * 并发保证：Supabase RPC 内部 SELECT FOR UPDATE 行锁。
 */
export async function redeemCode(code: string): Promise<{
  stats: RedeemStats;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    throw new RedeemError("NO_SUPABASE");
  }

  const preview = await previewCode(code);
  if (preview.conflicts.total > 0) {
    throw new RedeemError("CONFLICT", preview.conflicts);
  }

  const fingerprint = await getFingerprint();
  const { data, error } = await supabase.rpc("redeem_invite_code", {
    p_code: normalizeCode(code),
    p_fingerprint: fingerprint,
    p_ua: navigator.userAgent.slice(0, 256),
  });
  if (error) throw mapRpcError(error.message);

  const payload = data as TemplatePayload;
  await importPayload(payload);

  return {
    stats: {
      prompts: payload.prompts?.length ?? 0,
      scenarios: payload.scenarios?.length ?? 0,
      taskPacks: payload.taskPacks?.length ?? 0,
    },
  };
}

/**
 * 写入本地 IndexedDB。不做 id 重命名（依赖上游冲突预检）
 * 顺序：scenarios → prompts → taskPacks，保证 TaskPack.sceneCategoryId 引用先就位
 */
async function importPayload(payload: TemplatePayload): Promise<void> {
  if (payload.scenarios?.length) {
    await db.scenarios.bulkAdd(payload.scenarios);
  }
  if (payload.prompts?.length) {
    await db.prompts.bulkAdd(payload.prompts);
  }
  if (payload.taskPacks?.length) {
    await db.taskPacks.bulkAdd(payload.taskPacks);
  }
}

/** Supabase RPC 抛出的 PostgrestError.message 含 RAISE EXCEPTION 字符串 */
function mapRpcError(message: string): RedeemError {
  if (message.includes("INVALID_CODE")) return new RedeemError("INVALID_CODE");
  if (message.includes("CODE_ALREADY_USED"))
    return new RedeemError("CODE_ALREADY_USED");
  if (message.includes("CODE_EXPIRED")) return new RedeemError("CODE_EXPIRED");
  if (message.includes("CODE_REVOKED")) return new RedeemError("CODE_REVOKED");
  if (message.includes("TEMPLATE_NOT_FOUND"))
    return new RedeemError("TEMPLATE_NOT_FOUND");
  return new RedeemError("NETWORK_ERROR");
}
