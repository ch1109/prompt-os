import { useEffect, useRef, useState } from "react";
import {
  Workflow as WorkflowIcon,
  Monitor,
  Sun,
  Moon,
  Download,
  Upload,
  UploadCloud,
  Copy,
  Camera,
  Trash2,
  RotateCcw,
  CloudDownload,
  ShieldCheck,
  FolderGit2,
} from "lucide-react";
import { useSettings, type ThemeMode } from "@/store/settingsStore";
import { buildRelationGraph } from "@/services/relationBuilder";
import {
  exportAllData,
  importBackupFromFile,
  restoreBackupFromFile,
  getSyncStatus,
  peekSnapshotGitState,
  type ImportOutcome,
  type SyncStatus,
  type SyncState,
  type SnapshotGitState,
} from "@/services/backup";
import { runSaveToRepo, runRepoRestore } from "@/services/syncActions";
import { desktop, canWriteRepo } from "@/services/desktop";
import { formatRelative } from "@/utils/formatRelative";
import { toast } from "@/store/toastStore";
import { confirm } from "@/store/confirmStore";
import {
  listSnapshots,
  takeSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  REASON_LABELS,
  type SnapshotEntry,
} from "@/db/snapshot";

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "跟随系统", Icon: Monitor },
  { value: "light", label: "浅色", Icon: Sun },
  { value: "dark", label: "深色", Icon: Moon },
];

/** 保存快照后引导用户提交推送的一行命令（P2 复制按钮与 SOP 文案共用，DRY）。 */
const GIT_SYNC_CMD =
  'git add public/data-snapshot.json && git commit -m "data: 同步快照" && git push';

/** 同步状态 → 状态卡片的文案与配色（moss=正常/提示，amber=需注意，info=中性）。 */
const SYNC_META: Record<SyncState, { label: string; tone: "moss" | "amber" | "info" }> = {
  "in-sync": { label: "本机与仓库已同步", tone: "moss" },
  "repo-newer": { label: "仓库有更新，建议从仓库恢复", tone: "moss" },
  "local-newer": { label: "本机有未同步的编辑，建议保存到仓库", tone: "amber" },
  conflict: { label: "两台都改过，请谨慎选择同步方向", tone: "amber" },
  unknown: { label: "首次同步：请确认方向后再操作", tone: "info" },
  "no-snapshot": { label: "仓库还没有数据快照", tone: "info" },
};

const SYNC_CARD_TONE: Record<"moss" | "amber" | "info", string> = {
  moss: "border-moss/40 bg-moss-soft/40 text-moss",
  amber: "border-amber/40 bg-amber-soft/40 text-amber",
  info: "border-line bg-canvas/50 text-sub",
};

export default function Settings() {
  const { apiKey, model, theme, setApiKey, setModel, setTheme } = useSettings();
  const [saved, setSaved] = useState(false);
  const [graphState, setGraphState] = useState<
    | { phase: "idle" }
    | { phase: "running"; done: number; total: number }
    | { phase: "done"; updated: number; groups: number }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  const [backupBusy, setBackupBusy] = useState<
    "idle" | "exporting" | "importing" | "saving"
  >("idle");
  const [lastImport, setLastImport] = useState<ImportOutcome | null>(null);
  const [savedToRepoAt, setSavedToRepoAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreFileRef = useRef<HTMLInputElement>(null);

  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [snapshotBusy, setSnapshotBusy] = useState<string | "creating" | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [gitState, setGitState] = useState<SnapshotGitState | null>(null);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);

  async function refreshSync() {
    const [s, g] = await Promise.all([
      getSyncStatus().catch(() => null),
      peekSnapshotGitState().catch(() => null),
    ]);
    setSync(s);
    setGitState(g);
  }

  useEffect(() => {
    setSnapshots(listSnapshots());
    void refreshSync();
    void desktop?.getRepoRoot().then(setRepoRoot);
  }, []);

  /** 桌面端：选仓库目录。选定后同步状态与 git 状态都会变，立刻重拉一次。 */
  async function handleChooseRepo() {
    if (!desktop) return;
    const res = await desktop.chooseRepoRoot();
    if (!res.ok) {
      if (res.error !== "已取消") toast.error(res.error ?? "选择仓库目录失败");
      return;
    }
    setRepoRoot(res.repoRoot ?? null);
    toast.success("已绑定仓库目录，可以保存/恢复快照了");
    void refreshSync();
  }

  async function handleCreateSnapshot() {
    setSnapshotBusy("creating");
    try {
      const entry = await takeSnapshot("manual");
      setSnapshots(listSnapshots());
      if (entry) {
        const total = entry.counts.prompts + entry.counts.scenarios + entry.counts.taskPacks;
        toast.success(`已生成快照（${total} 条记录 · ${formatBytes(entry.sizeBytes)}）`);
      } else {
        toast.info("当前数据库为空，未生成快照");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成快照失败");
    } finally {
      setSnapshotBusy(null);
    }
  }

  async function handleRestoreSnapshot(entry: SnapshotEntry) {
    const ok = await confirm({
      title: "确认恢复到该快照",
      message: `将清空当前 Prompt / 场景 / 任务包并替换为 ${formatRelative(entry.at)} 的快照内容（${entry.counts.prompts} Prompt · ${entry.counts.scenarios} 场景 · ${entry.counts.taskPacks} 任务包）。Context 不受影响。`,
      confirmText: "恢复",
      danger: true,
    });
    if (!ok) return;
    setSnapshotBusy(entry.key);
    try {
      await restoreSnapshot(entry.key);
      toast.success("已恢复到该快照，刷新页面查看");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "恢复失败");
    } finally {
      setSnapshotBusy(null);
      setSnapshots(listSnapshots());
    }
  }

  async function handleDeleteSnapshot(entry: SnapshotEntry) {
    const ok = await confirm({
      title: "删除快照",
      message: `删除 ${formatRelative(entry.at)} 的快照后无法找回，是否继续？`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    deleteSnapshot(entry.key);
    setSnapshots(listSnapshots());
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleExport() {
    setBackupBusy("exporting");
    try {
      const counts = await exportAllData();
      const total =
        counts.prompts + counts.contexts + counts.scenarios + counts.taskPacks + counts.workflows;
      toast.success(
        `已导出 ${total} 条（Prompt ${counts.prompts} · 上下文 ${counts.contexts} · 场景 ${counts.scenarios} · 任务包 ${counts.taskPacks}）`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBackupBusy("idle");
    }
  }

  async function handleSaveToRepo() {
    setBackupBusy("saving");
    const ok = await runSaveToRepo();
    if (ok) {
      setSavedToRepoAt(Date.now());
      await refreshSync();
    }
    setBackupBusy("idle");
  }

  async function handleCopyGitCmd() {
    try {
      await navigator.clipboard.writeText(GIT_SYNC_CMD);
      toast.success("已复制 git 命令，去终端粘贴执行");
    } catch {
      toast.error("复制失败，请手动选中下方命令复制");
    }
  }

  function pickImportFile() {
    fileRef.current?.click();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ok = await confirm({
      title: "确认导入备份",
      message: `将合并文件「${file.name}」中的数据。重复 id 会被重新分配，不会覆盖现有内容。`,
      confirmText: "导入",
    });
    if (!ok) return;
    setBackupBusy("importing");
    try {
      const outcome = await importBackupFromFile(file);
      setLastImport(outcome);
      const total =
        outcome.added.prompts +
        outcome.added.contexts +
        outcome.added.scenarios +
        outcome.added.taskPacks +
        outcome.added.workflows;
      toast.success(`已导入 ${total} 条`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setBackupBusy("idle");
    }
  }

  function pickRestoreFile() {
    restoreFileRef.current?.click();
  }

  async function handleRestore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const ok = await confirm({
      title: "确认覆盖式导入",
      message: `将清空本机现有的 Prompt / 上下文 / 场景 / 任务包，替换为文件「${file.name}」的内容（用于设备间精确镜像）。当前数据会自动归档到本地快照，可在下方「本地快照」回滚。`,
      confirmText: "覆盖导入",
      danger: true,
    });
    if (!ok) return;
    setBackupBusy("importing");
    try {
      const stats = await restoreBackupFromFile(file);
      setLastImport(null);
      const total = stats.prompts + stats.contexts + stats.scenarios + stats.taskPacks;
      toast.success(`已覆盖导入 ${total} 条，刷新页面查看`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "覆盖导入失败");
    } finally {
      setBackupBusy("idle");
    }
  }

  async function handleRepoRestore() {
    setBackupBusy("importing");
    const ok = await runRepoRestore();
    if (ok) {
      setLastImport(null);
      await refreshSync();
    }
    setBackupBusy("idle");
  }

  async function handleBuildGraph() {
    if (!apiKey) {
      setGraphState({ phase: "error", message: "请先填入 API Key" });
      return;
    }
    setGraphState({ phase: "running", done: 0, total: 0 });
    try {
      const r = await buildRelationGraph((done, total) =>
        setGraphState({ phase: "running", done, total })
      );
      setGraphState({ phase: "done", updated: r.updated, groups: r.groups });
    } catch (e) {
      setGraphState({
        phase: "error",
        message: e instanceof Error ? e.message : "构建失败",
      });
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-xl space-y-6 p-6 text-sm">
      <h1 className="text-xl font-semibold">设置</h1>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <h2 className="font-medium">主题</h2>
        <div className="grid grid-cols-3 gap-1.5 rounded-md border border-line p-1">
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={`flex items-center justify-center gap-1.5 rounded py-1.5 text-xs transition-colors ${
                  active
                    ? "bg-moss-soft font-medium text-moss"
                    : "text-sub hover:bg-soft"
                }`}
              >
                <Icon size={13} strokeWidth={1.7} />
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-hint">
          「跟随系统」会自动响应操作系统的浅色 / 深色偏好变化。
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-line p-4">
        <h2 className="font-medium">AI 配置</h2>

        <label className="block">
          <div className="mb-1 text-xs text-hint">Anthropic API Key</div>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="input"
            placeholder="sk-ant-..."
          />
        </label>

        <label className="block">
          <div className="mb-1 text-xs text-hint">模型</div>
          <input value={model} onChange={(e) => setModel(e.target.value)} className="input" />
        </label>

        <button
          onClick={handleSave}
          className="rounded bg-moss px-3 py-1.5 text-xs font-medium text-paper hover:bg-moss/90"
        >
          {saved ? "已保存 ✓" : "保存"}
        </button>

        <p className="text-xs text-hint">API Key 仅保存在本机 localStorage，不会上传。</p>
      </div>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <div className="flex items-center gap-1.5">
          <WorkflowIcon size={14} className="text-moss" />
          <h2 className="font-medium">AI 后处理</h2>
        </div>
        <p className="text-xs text-hint">
          重建任务图：按一级场景分组，让 AI 分析每条 Prompt 的上下游关系，写入 upstreamPrompts /
          downstreamPrompts。完成后 PromptDetail 会显示「任务流」。
        </p>
        <button
          onClick={handleBuildGraph}
          disabled={graphState.phase === "running"}
          className="rounded bg-moss px-3 py-1.5 text-xs font-medium text-paper hover:bg-moss/90 disabled:opacity-40"
        >
          {graphState.phase === "running" ? "构建中…" : "重建任务图"}
        </button>

        {graphState.phase === "running" && (
          <div className="space-y-1.5">
            <p className="text-xs text-hint tabular-nums">
              已完成 {graphState.done} / {graphState.total} 组
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-soft">
              <div
                className="h-full bg-moss transition-all"
                style={{
                  width: `${
                    graphState.total ? (graphState.done / graphState.total) * 100 : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {graphState.phase === "done" && (
          <p className="text-xs text-moss">
            ✓ 已更新 {graphState.updated} 条 Prompt 的上下游关系（{graphState.groups} 组）
          </p>
        )}

        {graphState.phase === "error" && (
          <p className="text-xs text-red-500">{graphState.message}</p>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <h2 className="font-medium">数据管理</h2>
        <p className="text-xs text-hint">
          所有数据存储在浏览器 IndexedDB。建议定期导出备份；换浏览器、清缓存或换设备时再导入恢复。
        </p>
        {desktop && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-canvas/40 px-3 py-2 text-xs">
            <FolderGit2 size={13} strokeWidth={1.7} className="shrink-0 text-sub" />
            <span className="text-sub">仓库目录</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-hint">
              {repoRoot ?? "未绑定 —— 绑定后才能保存快照 / 读取仓库最新数据"}
            </code>
            <button
              onClick={handleChooseRepo}
              className="shrink-0 rounded border border-line bg-paper px-2 py-1 text-[11px] text-sub transition-colors hover:border-moss/40 hover:text-moss"
            >
              {repoRoot ? "更换…" : "选择仓库目录…"}
            </button>
          </div>
        )}
        {sync &&
          (() => {
            // git「快照已写盘未 commit」必须盖过时间戳的「已同步」——否则保存后卡片头条
            // 显示「已同步」会让用户误以为搬运完成、忘了 commit/push，B 台拉到旧快照。
            const pendingCommit = canWriteRepo && gitState?.state === "uncommitted";
            const meta = pendingCommit
              ? { label: "快照已保存，待提交并推送（见下方 git 命令）", tone: "amber" as const }
              : SYNC_META[sync.state];
            return (
              <div className={`rounded-md border px-3 py-2.5 text-xs ${SYNC_CARD_TONE[meta.tone]}`}>
                <p className="font-medium">同步状态 · {meta.label}</p>
                <p className="mt-1 text-hint tabular-nums">
                  仓库快照 {sync.repoAt ? formatRelative(sync.repoAt) : "无"} · 本机最近编辑{" "}
                  {sync.localAt ? formatRelative(sync.localAt) : "无"} · 已镜像{" "}
                  {sync.anchor ? formatRelative(sync.anchor) : "（尚未保存/恢复过）"}
                  {canWriteRepo && gitState ? ` · git：${gitState.detail}` : ""}
                </p>
              </div>
            );
          })()}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={backupBusy !== "idle"}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-1.5 text-xs text-sub transition-colors hover:border-moss/40 hover:bg-moss-soft hover:text-moss disabled:opacity-40"
          >
            <Download size={13} strokeWidth={1.7} />
            {backupBusy === "exporting" ? "导出中…" : "导出全部数据"}
          </button>
          {canWriteRepo && (
            <button
              onClick={handleSaveToRepo}
              disabled={backupBusy !== "idle"}
              title="直接写入 public/data-snapshot.json 并自动提交推送，省去手动改名搬运"
              className="inline-flex items-center gap-1.5 rounded border border-moss/50 bg-moss-soft px-3 py-1.5 text-xs font-medium text-moss transition-colors hover:bg-moss hover:text-paper disabled:opacity-40"
            >
              <UploadCloud size={13} strokeWidth={1.7} />
              {backupBusy === "saving" ? "写入中…" : "保存快照到仓库"}
            </button>
          )}
          <button
            onClick={pickImportFile}
            disabled={backupBusy !== "idle"}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-1.5 text-xs text-sub transition-colors hover:border-moss/40 hover:bg-moss-soft hover:text-moss disabled:opacity-40"
          >
            <Upload size={13} strokeWidth={1.7} />
            {backupBusy === "importing" ? "导入中…" : "导入备份（合并）"}
          </button>
          <button
            onClick={handleRepoRestore}
            disabled={backupBusy !== "idle"}
            className="inline-flex items-center gap-1.5 rounded border border-moss/50 bg-moss-soft px-3 py-1.5 text-xs font-medium text-moss transition-colors hover:bg-moss hover:text-paper disabled:opacity-40"
          >
            <CloudDownload size={13} strokeWidth={1.7} />
            从仓库恢复最新数据
          </button>
          <button
            onClick={pickRestoreFile}
            disabled={backupBusy !== "idle"}
            className="inline-flex items-center gap-1.5 rounded border border-amber/40 bg-paper px-3 py-1.5 text-xs text-amber transition-colors hover:bg-amber-soft disabled:opacity-40"
          >
            <RotateCcw size={13} strokeWidth={1.7} />
            覆盖式导入（选文件）
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="hidden"
          />
          <input
            ref={restoreFileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleRestore}
            className="hidden"
          />
        </div>
        {canWriteRepo && savedToRepoAt && (
          <div className="flex items-center gap-2 rounded-md border border-moss/40 bg-moss-soft/50 px-3 py-2 text-xs text-moss">
            <UploadCloud size={13} strokeWidth={1.7} className="shrink-0" />
            <span>
              已于 {formatRelative(savedToRepoAt)} 保存并自动提交推送到仓库 ✓（若推送失败可用下方命令手动补推）
            </span>
          </div>
        )}
        <div className="space-y-1.5 rounded-md border border-line bg-canvas/40 p-3 text-xs text-hint">
          <p className="font-medium text-sub">跨设备同步（last-writer-wins，勿两台同时编辑）</p>
          <p>
            <strong className="text-sub">A 台（编辑端 · dev）</strong>
            ：编辑完点上方
            <strong className="text-moss">「保存快照到仓库」</strong>
            即自动写盘 + git 提交并推送，一步到位。下方命令仅在自动推送失败时手动兜底：
          </p>
          <div className="flex items-stretch gap-1.5">
            <code className="block flex-1 select-all rounded bg-soft px-2 py-1 font-mono text-[11px] leading-relaxed text-ink">
              {GIT_SYNC_CMD}
            </code>
            <button
              onClick={handleCopyGitCmd}
              title="复制 git 命令"
              className="inline-flex shrink-0 items-center gap-1 rounded border border-line bg-paper px-2 text-[11px] text-sub transition-colors hover:border-moss/40 hover:text-moss"
            >
              <Copy size={12} strokeWidth={1.7} />
              复制
            </button>
          </div>
          <p>
            <strong className="text-sub">B 台（接收端）</strong>：
            <span className="mono">git pull</span> 后点
            <strong className="text-moss">「从仓库恢复最新数据」</strong>
            一键镜像（会清空本机数据，已自动归档可回滚）。
          </p>
        </div>
        {lastImport && (
          <div className="rounded-md border border-line bg-canvas/60 p-2.5 text-xs text-sub">
            <div className="mb-1 text-hint">最近一次导入</div>
            <div className="tabular-nums">
              新增：Prompt {lastImport.added.prompts} · 上下文 {lastImport.added.contexts} · 场景{" "}
              {lastImport.added.scenarios} · 任务包 {lastImport.added.taskPacks}
            </div>
            {(lastImport.renamed.prompts ||
              lastImport.renamed.contexts ||
              lastImport.renamed.scenarios ||
              lastImport.renamed.taskPacks ||
              lastImport.renamed.workflows) > 0 && (
              <div className="mt-0.5 tabular-nums text-hint">
                因 id 冲突重命名：
                {[
                  ["Prompt", lastImport.renamed.prompts],
                  ["上下文", lastImport.renamed.contexts],
                  ["场景", lastImport.renamed.scenarios],
                  ["任务包", lastImport.renamed.taskPacks],
                  ["工作流", lastImport.renamed.workflows],
                ]
                  .filter(([, n]) => (n as number) > 0)
                  .map(([k, n]) => `${k} ${n}`)
                  .join(" · ")}
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-hint">
          完全重置：DevTools → Application → IndexedDB → 删除 <span className="mono">prompt_os</span>{" "}
          数据库。
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-line p-4">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-moss" />
          <h2 className="font-medium">本地快照</h2>
        </div>
        <p className="text-xs text-hint">
          每次打开应用会自动把 Prompt / 场景 / 任务包的当前状态保存一份到浏览器
          localStorage，最多保留最近 3 份。数据库 schema 升级前也会自动归档。Context
          不在快照内（请用上方「导出全部数据」备份）。
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCreateSnapshot}
            disabled={snapshotBusy !== null}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-1.5 text-xs text-sub transition-colors hover:border-moss/40 hover:bg-moss-soft hover:text-moss disabled:opacity-40"
          >
            <Camera size={13} strokeWidth={1.7} />
            {snapshotBusy === "creating" ? "生成中…" : "立即生成快照"}
          </button>
        </div>

        {snapshots.length === 0 ? (
          <p className="text-xs text-hint">还没有快照。下次打开应用时会自动生成第一份。</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {snapshots.map((s) => {
              const busy = snapshotBusy === s.key;
              return (
                <li key={s.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-medium text-ink tabular-nums">
                        {formatRelative(s.at)}
                      </span>
                      <span className="rounded bg-soft px-1.5 py-0.5 text-[10px] text-sub">
                        {REASON_LABELS[s.reason]}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-hint tabular-nums">
                      Prompt {s.counts.prompts} · 场景 {s.counts.scenarios} · 任务包{" "}
                      {s.counts.taskPacks} · {formatBytes(s.sizeBytes)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleRestoreSnapshot(s)}
                      disabled={snapshotBusy !== null}
                      title="恢复"
                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-sub transition-colors hover:bg-moss-soft hover:text-moss disabled:opacity-40"
                    >
                      <RotateCcw size={12} strokeWidth={1.7} />
                      {busy ? "恢复中…" : "恢复"}
                    </button>
                    <button
                      onClick={() => handleDeleteSnapshot(s)}
                      disabled={snapshotBusy !== null}
                      title="删除"
                      className="inline-flex items-center rounded p-1 text-hint transition-colors hover:bg-soft hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 size={12} strokeWidth={1.7} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
