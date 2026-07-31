import { nanoid } from "nanoid";
import { db } from "@/db";
import { writeMigrationArchive } from "@/db/snapshot";
import { desktop } from "@/services/desktop";
import type { Context, Prompt, Scenario, TaskPack, Workflow } from "@/types";

const BACKUP_VERSION = 1;

/**
 * 同步锚点：记录「本机当前镜像的是哪一份仓库快照」的 exportedAt。
 *
 * 为什么需要它：判断同步方向不能只靠 `max(updatedAt)`——seed 会把出厂数据的
 * updatedAt 设成灌库时刻，一台刚 pull 完的 B 台会显得「本机有新编辑」，从而诱导
 * 用户把出厂数据推回仓库覆盖真实快照。锚点让我们区分「本机真实编辑过」与
 * 「只是 seed 时间晚于快照」：只有保存/恢复显式发生后锚点才写入，方向判断才可信。
 */
const SYNC_ANCHOR_KEY = "prompt-os-sync-anchor";

function getSyncAnchor(): number | null {
  try {
    const raw = localStorage.getItem(SYNC_ANCHOR_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function setSyncAnchor(exportedAt: number | null): void {
  try {
    if (exportedAt == null) localStorage.removeItem(SYNC_ANCHOR_KEY);
    else localStorage.setItem(SYNC_ANCHOR_KEY, String(exportedAt));
  } catch (e) {
    console.warn("[Prompt OS] 写入同步锚点失败", e);
  }
}

interface BackupFile {
  format: "prompt-os-backup";
  version: number;
  exportedAt: number;
  counts: {
    prompts: number;
    contexts: number;
    scenarios: number;
    taskPacks: number;
    workflows: number;
  };
  data: {
    prompts: Prompt[];
    contexts: Context[];
    scenarios: Scenario[];
    taskPacks: TaskPack[];
    workflows: Workflow[];
  };
}

export interface BackupStats {
  prompts: number;
  contexts: number;
  scenarios: number;
  taskPacks: number;
  workflows: number;
}

/**
 * 读取五张活跃表并组装成统一的 BackupFile 结构。
 * 导出下载（exportAllData）与「保存到仓库」（saveSnapshotToRepo）共用同一份采集逻辑。
 */
export async function collectBackup(): Promise<BackupFile> {
  const [prompts, contexts, scenarios, taskPacks, workflows] = await Promise.all([
    db.prompts.toArray(),
    db.contexts.toArray(),
    db.scenarios.toArray(),
    db.taskPacks.toArray(),
    db.workflows.toArray(),
  ]);
  return {
    format: "prompt-os-backup",
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    counts: {
      prompts: prompts.length,
      contexts: contexts.length,
      scenarios: scenarios.length,
      taskPacks: taskPacks.length,
      workflows: workflows.length,
    },
    data: { prompts, contexts, scenarios, taskPacks, workflows },
  };
}

export async function exportAllData(): Promise<BackupStats> {
  const file = await collectBackup();
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  Object.assign(document.createElement("a"), {
    href: url,
    download: `prompt-os-backup-${date}.json`,
  }).click();
  URL.revokeObjectURL(url);
  return file.counts;
}

/** dev 中间件落盘端点，实现见 vite.config.ts 的 snapshotWriter 插件。 */
const SAVE_SNAPSHOT_URL = "/__save-snapshot";

/** 中间件自动 git 操作的结果（dev only）。 */
export interface SnapshotGitResult {
  committed: boolean;
  pushed: boolean;
  detail: string;
}

/**
 * 一键把当前 IndexedDB 五表写入仓库快照 public/data-snapshot.json，并自动 git
 * commit + push。
 *
 * 两条宿主路径，行为一致：
 * - web：`pnpm dev` 下靠 Vite dev 中间件落盘 + 提交，生产构建无此端点（缺失会 404）；
 * - 桌面（Electron）：走 preload 暴露的 IPC，写用户在设置页选定的仓库目录。
 *
 * 设计意图：消除「导出文件落 Downloads → 手动改名搬进 public/ → 手敲 git」的全部断点，
 * 跨设备同步降为「点一下」。git 结果随响应回传（`git` 字段）：push 失败时
 * 写盘与 commit 仍算成功，调用方据 `git.pushed/detail` 提示并保留手动命令兜底。
 */
export async function saveSnapshotToRepo(): Promise<{
  counts: BackupStats;
  exportedAt: number;
  git?: SnapshotGitResult;
}> {
  const file = await collectBackup();
  const body = JSON.stringify(file, null, 2);

  let payload: { git?: SnapshotGitResult };
  if (desktop) {
    const out = await desktop.saveSnapshot(body);
    if (!out.ok) throw new Error(out.error ?? "写入仓库快照失败");
    payload = { git: out.git };
  } else {
    const res = await fetch(SAVE_SNAPSHOT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? "写盘端点不可用：请确认在 pnpm dev 下操作（生产构建无法写入仓库）"
          : `写入仓库快照失败（HTTP ${res.status}）`
      );
    }
    payload = (await res.json().catch(() => ({}))) as { git?: SnapshotGitResult };
  }
  // 本机刚把自己推上仓库 → 本机即与这份快照同步，落锚点供后续方向判断。
  setSyncAnchor(file.exportedAt);
  return { counts: file.counts, exportedAt: file.exportedAt, git: payload.git };
}

export interface SnapshotGitState {
  state: "uncommitted" | "unpushed" | "no-upstream" | "synced" | "error";
  detail: string;
}

/**
 * 只读探测仓库快照的 git 状态。桌面端走 IPC；web 端仅 dev 有此端点（见 vite.config.ts），
 * 生产构建返回 null，调用方据此不显示 git 维度信息。
 */
export async function peekSnapshotGitState(): Promise<SnapshotGitState | null> {
  if (desktop) return desktop.gitState();
  if (!import.meta.env.DEV) return null;
  try {
    const res = await fetch("/__snapshot-git-status", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as SnapshotGitState;
  } catch {
    return null;
  }
}

export interface ImportOutcome {
  added: BackupStats;
  renamed: BackupStats;
  exportedAt: number | null;
}

async function mergeTable<T extends { id: string }>(
  table: {
    bulkGet: (ids: string[]) => Promise<(T | undefined)[]>;
    bulkAdd: (items: T[]) => Promise<unknown>;
  },
  items: T[]
): Promise<{ added: number; renamed: number }> {
  if (!items.length) return { added: 0, renamed: 0 };
  const existing = new Set(
    (await table.bulkGet(items.map((x) => x.id))).filter((x): x is T => !!x).map((x) => x.id)
  );
  let renamed = 0;
  const final = items.map((x) => {
    if (existing.has(x.id)) {
      renamed++;
      return { ...x, id: nanoid() };
    }
    return x;
  });
  await table.bulkAdd(final);
  return { added: final.length, renamed };
}

interface ParsedBackup {
  data: BackupFile["data"];
  exportedAt: number | null;
}

/** 把已解析的 JSON 归一化为统一的五表结构，未知格式抛错。文件/仓库快照共用。 */
function normalizeBackup(parsed: unknown): ParsedBackup {
  if (isBackupFile(parsed)) {
    const d = parsed.data;
    return {
      data: {
        prompts: d.prompts ?? [],
        contexts: d.contexts ?? [],
        scenarios: d.scenarios ?? [],
        taskPacks: d.taskPacks ?? [],
        workflows: d.workflows ?? [],
      },
      exportedAt: parsed.exportedAt,
    };
  }
  if (isLegacyTemplate(parsed)) {
    return {
      data: {
        prompts: parsed.prompts ?? [],
        contexts: parsed.contexts ?? [],
        scenarios: parsed.scenarios ?? [],
        taskPacks: parsed.taskPacks ?? [],
        workflows: parsed.workflows ?? [],
      },
      exportedAt: null,
    };
  }
  throw new Error("无法识别的备份文件格式");
}

async function parseBackupFile(file: File): Promise<ParsedBackup> {
  return normalizeBackup(JSON.parse(await file.text()));
}

export async function importBackupFromFile(file: File): Promise<ImportOutcome> {
  const { data, exportedAt } = await parseBackupFile(file);

  const [p, c, s, t, w] = await Promise.all([
    mergeTable(db.prompts, data.prompts),
    mergeTable(db.contexts, data.contexts),
    mergeTable(db.scenarios, data.scenarios),
    mergeTable(db.taskPacks, data.taskPacks),
    mergeTable(db.workflows, data.workflows),
  ]);

  return {
    added: {
      prompts: p.added,
      contexts: c.added,
      scenarios: s.added,
      taskPacks: t.added,
      workflows: w.added,
    },
    renamed: {
      prompts: p.renamed,
      contexts: c.renamed,
      scenarios: s.renamed,
      taskPacks: t.renamed,
      workflows: w.renamed,
    },
    exportedAt,
  };
}

/**
 * 覆盖式恢复核心：清空本机五表并替换为给定内容，用于设备间精确镜像。
 *
 * 与合并模式不同，这里会丢弃本机现有数据——所以清空前先调用 writeMigrationArchive
 * 把现状归档到 localStorage（可在 Settings 快照列表回滚），归档失败只 warn 不阻塞，
 * 遵循项目「destructive 操作前必先归档」铁律。文件导入与仓库快照恢复共用。
 */
async function applyRestore(data: BackupFile["data"]): Promise<BackupStats> {
  try {
    const [prompts, scenarios, taskPacks, contexts] = await Promise.all([
      db.prompts.toArray(),
      db.scenarios.toArray(),
      db.taskPacks.toArray(),
      db.contexts.toArray(),
    ]);
    writeMigrationArchive({ prompts, scenarios, taskPacks, contexts });
  } catch (e) {
    console.warn("[Prompt OS] 覆盖式恢复前归档失败，继续恢复", e);
  }

  await db.transaction(
    "rw",
    [db.prompts, db.contexts, db.scenarios, db.taskPacks, db.workflows],
    async () => {
      await Promise.all([
        db.prompts.clear(),
        db.contexts.clear(),
        db.scenarios.clear(),
        db.taskPacks.clear(),
        db.workflows.clear(),
      ]);
      await Promise.all([
        db.prompts.bulkPut(data.prompts),
        db.contexts.bulkPut(data.contexts),
        db.scenarios.bulkPut(data.scenarios),
        db.taskPacks.bulkPut(data.taskPacks),
        db.workflows.bulkPut(data.workflows),
      ]);
    }
  );

  return {
    prompts: data.prompts.length,
    contexts: data.contexts.length,
    scenarios: data.scenarios.length,
    taskPacks: data.taskPacks.length,
    workflows: data.workflows.length,
  };
}

/** 覆盖式导入：从用户选择的文件恢复（离线/不走仓库时使用）。 */
export async function restoreBackupFromFile(file: File): Promise<BackupStats> {
  const { data, exportedAt } = await parseBackupFile(file);
  const stats = await applyRestore(data);
  // 本机现镜像这份文件 → 落锚点（legacy 模板无 exportedAt 时置空，回到中性 unknown，
  // 不残留旧锚点误判方向）。
  setSyncAnchor(exportedAt);
  return stats;
}

/** 仓库快照路径：放在 public/ 下，构建/dev 均由 Vite 在站点根提供。 */
const REPO_SNAPSHOT_URL = `${import.meta.env.BASE_URL}data-snapshot.json`;

/**
 * 本机三张可编辑表（prompts/contexts/taskPacks）里最新的 updatedAt。
 * 用于「从仓库恢复」前判断本机是否有比快照更新的编辑（Scenario 无 updatedAt，故不计；
 * 空库返回 0）。注意：全新用户 seed 后 updatedAt=seed 时刻，可能晚于历史快照的
 * exportedAt——这会触发一次中性的「本机更新」提示，用户确认即可，不是误报为患。
 */
export async function getLocalLatestEdit(): Promise<number> {
  const [prompts, contexts, taskPacks] = await Promise.all([
    db.prompts.toArray(),
    db.contexts.toArray(),
    db.taskPacks.toArray(),
  ]);
  let max = 0;
  for (const r of [...prompts, ...contexts, ...taskPacks]) {
    if (r.updatedAt > max) max = r.updatedAt;
  }
  return max;
}

/**
 * 取回仓库快照的 JSON。两处（peek 元信息 / 覆盖恢复）共用，保证读的是同一份来源。
 *
 * 桌面端优先读**仓库目录里的实时文件**（git pull 后立刻生效，不受安装包里那份
 * 构建时副本的影响）；读不到（未配置仓库目录）时回退到随包分发的 dist 副本——
 * 这条回退正好承担首次迁移：新装的桌面端点「从仓库恢复」就能拿到打包时的数据。
 */
async function loadRepoSnapshotJson(): Promise<unknown> {
  if (desktop) {
    const text = await desktop.readSnapshot();
    if (text) return JSON.parse(text);
  }
  const res = await fetch(REPO_SNAPSHOT_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("仓库里还没有数据快照（public/data-snapshot.json）");
  }
  return res.json();
}

/**
 * 只读取仓库快照的元信息（exportedAt + counts），不做任何恢复。
 * 供恢复前比对时间、提示冲突用，与 restoreFromRepoSnapshot 各自独立读取。
 */
export async function peekRepoSnapshot(): Promise<{
  exportedAt: number | null;
  counts: BackupStats | null;
}> {
  const json = await loadRepoSnapshotJson();
  if (isBackupFile(json)) {
    return { exportedAt: json.exportedAt, counts: json.counts };
  }
  return { exportedAt: null, counts: null };
}

/**
 * 一键从仓库快照恢复：读 public/data-snapshot.json → 覆盖恢复。
 * 用于跨设备同步——B 端 git pull 后无需在文件对话框选文件即可镜像 A 端数据。
 */
export async function restoreFromRepoSnapshot(): Promise<{
  stats: BackupStats;
  exportedAt: number | null;
}> {
  const { data, exportedAt } = normalizeBackup(await loadRepoSnapshotJson());
  const stats = await applyRestore(data);
  // 本机已镜像这份仓库快照 → 落锚点，后续方向判断以此为基准。
  setSyncAnchor(exportedAt);
  return { stats, exportedAt };
}

/**
 * 同步状态机：组合「仓库快照 exportedAt」「本机锚点」「本机最近编辑」三者判定方向。
 *
 * - `no-snapshot`：仓库还没有快照文件。
 * - `unknown`：**锚点为空**——本机从未显式保存/恢复过。此时时间戳无法区分
 *   「带 seed 的新 B 台」和「有真实编辑的 A 台」，故为中性态，UI 不做方向诱导。
 * - `repo-newer`：锚点存在且仓库快照比锚点新 → B 台应「从仓库恢复」。
 * - `local-newer`：锚点存在、本机编辑晚于锚点、且仓库未更新 → A 台应「保存+推送」。
 * - `conflict`：锚点存在、仓库已更新 **且** 本机也有新编辑 → 两台并发改动。
 * - `in-sync`：其余（本机与仓库一致）。
 */
export type SyncState =
  | "no-snapshot"
  | "unknown"
  | "repo-newer"
  | "local-newer"
  | "conflict"
  | "in-sync";

export interface SyncStatus {
  state: SyncState;
  repoAt: number | null;
  localAt: number;
  anchor: number | null;
  counts: BackupStats | null;
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const anchor = getSyncAnchor();
  const localAt = await getLocalLatestEdit();

  let repoAt: number | null;
  let counts: BackupStats | null;
  try {
    const meta = await peekRepoSnapshot();
    repoAt = meta.exportedAt;
    counts = meta.counts;
  } catch {
    return { state: "no-snapshot", repoAt: null, localAt, anchor, counts: null };
  }

  const base = { repoAt, localAt, anchor, counts };
  if (anchor == null || repoAt == null) return { ...base, state: "unknown" };

  const repoNewer = repoAt > anchor;
  const localNewer = localAt > anchor;
  if (repoNewer && localNewer) return { ...base, state: "conflict" };
  if (repoNewer) return { ...base, state: "repo-newer" };
  if (localNewer) return { ...base, state: "local-newer" };
  return { ...base, state: "in-sync" };
}

function isBackupFile(x: unknown): x is BackupFile {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { format?: string }).format === "prompt-os-backup" &&
    typeof (x as { data?: unknown }).data === "object"
  );
}

function isLegacyTemplate(x: unknown): x is {
  prompts?: Prompt[];
  contexts?: Context[];
  scenarios?: Scenario[];
  taskPacks?: TaskPack[];
  workflows?: Workflow[];
} {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    Array.isArray(o.prompts) ||
    Array.isArray(o.contexts) ||
    Array.isArray(o.scenarios) ||
    Array.isArray(o.taskPacks) ||
    Array.isArray(o.workflows)
  );
}
