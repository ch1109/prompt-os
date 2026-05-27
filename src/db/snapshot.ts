import { db } from "./index";
import type { Context, Prompt, Scenario, TaskPack } from "@/types";

/**
 * 启动期自动快照 + Settings 手动恢复的存储层。
 *
 * 设计要点：
 * - localStorage key 前缀 `prompt-os-snapshot:` + epochMs，便于一次扫描所有快照
 * - 只覆盖 schema 升级会清空的三张表（prompts / scenarios / taskPacks），
 *   contexts 由用户独立维护、迁移不会清，且体积较大，不进快照
 * - 默认保留 MAX_KEEP 份，超出按时间升序删除最旧
 * - 配额超出时退化策略：先删最旧再重试一次；仍失败则不抛错，控制台 warn
 */

const KEY_PREFIX = "prompt-os-snapshot:";
const MAX_KEEP = 3;
const REASONS = {
  startup: "启动自动",
  manual: "手动",
  migration: "升级前归档",
} as const;

export type SnapshotReason = keyof typeof REASONS;

export const REASON_LABELS: Record<SnapshotReason, string> = REASONS;

export interface SnapshotPayload {
  at: number;
  reason: SnapshotReason;
  counts: {
    prompts: number;
    scenarios: number;
    taskPacks: number;
    contexts?: number;
  };
  prompts: Prompt[];
  scenarios: Scenario[];
  taskPacks: TaskPack[];
  /** v9 起可选携带 contexts（v9 升级 hook 与未来上下文相关 destructive 操作专用） */
  contexts?: Context[];
}

export interface SnapshotEntry {
  key: string;
  at: number;
  reason: SnapshotReason;
  counts: SnapshotPayload["counts"];
  sizeBytes: number;
}

function lsAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

function keyFor(at: number): string {
  return `${KEY_PREFIX}${at}`;
}

function listKeys(): string[] {
  if (!lsAvailable()) return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(KEY_PREFIX)) keys.push(k);
  }
  return keys;
}

export function listSnapshots(): SnapshotEntry[] {
  const entries: SnapshotEntry[] = [];
  for (const key of listKeys()) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as SnapshotPayload;
      entries.push({
        key,
        at: parsed.at,
        reason: parsed.reason,
        counts: parsed.counts,
        sizeBytes: raw.length,
      });
    } catch {
      // 损坏的条目静默跳过——pruneSnapshots 会顺手清掉
    }
  }
  return entries.sort((a, b) => b.at - a.at);
}

/**
 * 抓取当前三表的全量数据并写入 localStorage。
 *
 * - 三表全空时直接返回 null（首次启动无内容可备份）
 * - 写入失败（如 QuotaExceededError）会先删最旧的一份再重试一次，仍失败返回 null
 * - 写入成功后调用 pruneSnapshots() 把份数压回 MAX_KEEP
 */
export async function takeSnapshot(
  reason: SnapshotReason = "startup"
): Promise<SnapshotEntry | null> {
  if (!lsAvailable()) return null;

  const [prompts, scenarios, taskPacks] = await Promise.all([
    db.prompts.toArray(),
    db.scenarios.toArray(),
    db.taskPacks.toArray(),
  ]);

  if (prompts.length === 0 && scenarios.length === 0 && taskPacks.length === 0) {
    return null;
  }

  const at = Date.now();
  const payload: SnapshotPayload = {
    at,
    reason,
    counts: {
      prompts: prompts.length,
      scenarios: scenarios.length,
      taskPacks: taskPacks.length,
    },
    prompts,
    scenarios,
    taskPacks,
  };

  const serialized = JSON.stringify(payload);
  const key = keyFor(at);

  if (!tryWrite(key, serialized)) {
    return null;
  }

  pruneSnapshots(MAX_KEEP);

  return {
    key,
    at,
    reason,
    counts: payload.counts,
    sizeBytes: serialized.length,
  };
}

function tryWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    // 配额超出：删除最旧一份，再试一次
    const all = listSnapshots();
    const oldest = all[all.length - 1];
    if (oldest) {
      try {
        localStorage.removeItem(oldest.key);
        localStorage.setItem(key, value);
        return true;
      } catch (retryErr) {
        console.warn("[Prompt OS] 快照写入失败（已超配额，回退仍失败）", retryErr);
        return false;
      }
    }
    console.warn("[Prompt OS] 快照写入失败", err);
    return false;
  }
}

/**
 * 把快照恢复到当前数据库：清空三表，写入快照内容。
 * 通过 Dexie 事务保证三表要么一起回到快照状态，要么全部回滚。
 */
export async function restoreSnapshot(key: string): Promise<void> {
  if (!lsAvailable()) throw new Error("当前环境无 localStorage");
  const raw = localStorage.getItem(key);
  if (!raw) throw new Error("快照不存在或已被清理");

  let parsed: SnapshotPayload;
  try {
    parsed = JSON.parse(raw) as SnapshotPayload;
  } catch {
    throw new Error("快照已损坏，无法恢复");
  }

  await db.transaction("rw", db.prompts, db.scenarios, db.taskPacks, async () => {
    await db.prompts.clear();
    await db.scenarios.clear();
    await db.taskPacks.clear();
    if (parsed.prompts.length) await db.prompts.bulkAdd(parsed.prompts);
    if (parsed.scenarios.length) await db.scenarios.bulkAdd(parsed.scenarios);
    if (parsed.taskPacks.length) await db.taskPacks.bulkAdd(parsed.taskPacks);
  });
}

export function deleteSnapshot(key: string): void {
  if (!lsAvailable()) return;
  localStorage.removeItem(key);
}

/**
 * 删除多余的快照，保留最新的 keep 份。同时回收 JSON.parse 失败的损坏条目。
 */
export function pruneSnapshots(keep: number = MAX_KEEP): number {
  if (!lsAvailable()) return 0;

  const corruptKeys: string[] = [];
  const valid: SnapshotEntry[] = [];

  for (const key of listKeys()) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as SnapshotPayload;
      valid.push({
        key,
        at: parsed.at,
        reason: parsed.reason,
        counts: parsed.counts,
        sizeBytes: raw.length,
      });
    } catch {
      corruptKeys.push(key);
    }
  }

  for (const k of corruptKeys) localStorage.removeItem(k);

  valid.sort((a, b) => b.at - a.at);
  const toDrop = valid.slice(Math.max(0, keep));
  for (const e of toDrop) localStorage.removeItem(e.key);

  return corruptKeys.length + toDrop.length;
}

/**
 * Dexie upgrade hook 内调用：把已读出的三表数据按 SnapshotPayload 结构存到
 * localStorage（reason: "migration"），与启动快照走同一套 listSnapshots /
 * restoreSnapshot 入口。
 *
 * 设计原因：hook 内不能再用 `db.prompts.toArray()`（要走 tx），所以把读表的
 * 责任留给调用方，本函数只负责序列化 + 落盘。
 */
export function writeMigrationArchive(input: {
  prompts: Prompt[];
  scenarios: Scenario[];
  taskPacks: TaskPack[];
  /** v9 起可选携带 contexts，v7 等历史调用点不传仍可工作 */
  contexts?: Context[];
}): SnapshotEntry | null {
  if (!lsAvailable()) return null;
  const { prompts, scenarios, taskPacks, contexts } = input;
  const contextsLen = contexts?.length ?? 0;
  if (
    prompts.length === 0 &&
    scenarios.length === 0 &&
    taskPacks.length === 0 &&
    contextsLen === 0
  ) {
    return null;
  }
  const at = Date.now();
  const payload: SnapshotPayload = {
    at,
    reason: "migration",
    counts: {
      prompts: prompts.length,
      scenarios: scenarios.length,
      taskPacks: taskPacks.length,
      ...(contextsLen > 0 ? { contexts: contextsLen } : {}),
    },
    prompts,
    scenarios,
    taskPacks,
    ...(contextsLen > 0 ? { contexts } : {}),
  };
  const serialized = JSON.stringify(payload);
  const key = keyFor(at);
  if (!tryWrite(key, serialized)) return null;
  pruneSnapshots(MAX_KEEP);
  return {
    key,
    at,
    reason: "migration",
    counts: payload.counts,
    sizeBytes: serialized.length,
  };
}

export const __testing = { KEY_PREFIX, MAX_KEEP, REASONS };
