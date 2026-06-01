import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudDownload, UploadCloud, AlertTriangle, Info, X } from "lucide-react";
import {
  getSyncStatus,
  peekSnapshotGitState,
  type SyncStatus,
  type SnapshotGitState,
} from "@/services/backup";
import { runRepoRestore, runSaveToRepo, SYNC_CHANGED_EVENT } from "@/services/syncActions";
import { formatRelative } from "@/utils/formatRelative";

/**
 * 全局同步状态横幅：跨设备同步「防呆」的核心——让 App 主动暴露同步状态，
 * 不再依赖用户记住「A 台保存+push、B 台 pull+恢复」两步流程。
 *
 * 只在确实需要动作时渲染（repo-newer / local-newer / conflict / unknown），
 * in-sync 与拉取失败一律不渲染，绝不 cry-wolf。本会话关闭后隐藏，刷新（下次启动）
 * 若仍不同步会再现——用组件内 state 而非 sessionStorage，正合「下次启动再现」语义。
 */
export function SyncStatusBanner() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [git, setGit] = useState<SnapshotGitState | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        getSyncStatus().catch(() => null),
        peekSnapshotGitState().catch(() => null),
      ]).then(([s, g]) => {
        if (!active) return;
        setStatus(s);
        setGit(g);
      });
    void load();
    // 保存/恢复成功后由 syncActions 广播，使从 Settings 触发的同步也能即时刷新全局横幅
    // （横幅挂在 App 不随路由重渲染，否则会停在挂载时的旧状态）。
    const onChanged = () => void load();
    window.addEventListener(SYNC_CHANGED_EVENT, onChanged);
    return () => {
      active = false;
      window.removeEventListener(SYNC_CHANGED_EVENT, onChanged);
    };
  }, []);

  if (dismissed || !status) return null;
  const { state, repoAt, localAt, anchor } = status;
  // 文件级、可靠：快照写盘但未 commit。必须盖过 in-sync 的静默，否则 A 台保存后
  // 横幅消失、用户忘了 commit/push，B 台拉到旧快照——正是要堵的断点。
  // unpushed 是分支级（会被无关 ahead 提交触发），不进横幅，只在设置页作信息提示。
  const uncommitted = import.meta.env.DEV && git?.state === "uncommitted";
  if (state === "no-snapshot") return null;
  if (state === "in-sync" && !uncommitted) return null;

  async function act(run: () => Promise<boolean>) {
    // 成功后 syncActions 广播 SYNC_CHANGED_EVENT → 监听器 load() 自动刷新，无需在此重复拉取
    setBusy(true);
    await run();
    setBusy(false);
  }

  const goSettings = () => navigate("/settings");

  // 各状态的视觉与文案。tone 决定配色（moss 提示 / amber 警告 / 中性 info）。
  const view = (() => {
    switch (state) {
      case "repo-newer":
        return {
          tone: "moss" as const,
          Icon: CloudDownload,
          text: `仓库有更新的数据快照（导出于 ${repoAt ? formatRelative(repoAt) : "未知"}），本机停留在 ${anchor ? formatRelative(anchor) : "未恢复"}。`,
          action: { label: "一键恢复", onClick: () => act(runRepoRestore) },
        };
      case "local-newer":
        return {
          tone: "amber" as const,
          Icon: UploadCloud,
          text: `本机有${anchor ? ` ${formatRelative(anchor)} 之后` : ""}的编辑尚未同步到仓库${git ? `（${git.detail}）` : ""}。`,
          action: import.meta.env.DEV
            ? { label: "保存快照到仓库", onClick: () => act(runSaveToRepo) }
            : { label: "去同步设置", onClick: goSettings },
        };
      case "conflict":
        return {
          tone: "amber" as const,
          Icon: AlertTriangle,
          text: `两台似乎都改过：仓库快照 ${repoAt ? formatRelative(repoAt) : "未知"}、本机最近编辑 ${formatRelative(localAt)}。恢复会归档当前数据可回滚。`,
          action: { label: "去同步设置", onClick: goSettings },
        };
      case "in-sync":
        // 能走到这说明 uncommitted=true（in-sync && 已提交已在上面 return null）。
        // 快照写盘但未 commit，B 台还拉不到，最紧迫的一步是去终端 git 提交并推送。
        return {
          tone: "amber" as const,
          Icon: UploadCloud,
          text: "快照已保存到磁盘但尚未提交，B 台还拉不到——请到终端执行 git 提交并推送。",
          action: { label: "去同步设置", onClick: goSettings },
        };
      default: // unknown —— 锚点为空，中性，不做方向诱导
        return {
          tone: "info" as const,
          Icon: Info,
          text: `仓库快照 ${repoAt ? formatRelative(repoAt) : "无"} · 本机最近编辑 ${localAt ? formatRelative(localAt) : "无"}。首次同步请在设置确认方向。`,
          action: { label: "去同步设置", onClick: goSettings },
        };
    }
  })();

  const toneClass = {
    moss: "border-moss/40 bg-moss-soft/60 text-moss",
    amber: "border-amber/40 bg-amber-soft/60 text-amber",
    info: "border-line bg-canvas/70 text-sub",
  }[view.tone];

  const btnClass = {
    moss: "border-moss/50 bg-moss text-paper hover:opacity-90",
    amber: "border-amber/50 bg-amber text-paper hover:opacity-90",
    info: "border-line bg-paper text-sub hover:border-moss/40 hover:text-moss",
  }[view.tone];

  return (
    <div
      className={`flex items-center gap-2 border-b px-4 py-2 text-xs ${toneClass} animate-[sync-banner-in_220ms_ease-out]`}
    >
      <view.Icon size={14} strokeWidth={1.8} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{view.text}</span>
      <button
        onClick={view.action.onClick}
        disabled={busy}
        className={`inline-flex shrink-0 items-center gap-1 rounded border px-2.5 py-1 font-medium transition-colors disabled:opacity-50 ${btnClass}`}
      >
        {busy ? "处理中…" : view.action.label}
      </button>
      <button
        onClick={() => setDismissed(true)}
        title="本次关闭（刷新后若仍不同步会再现）"
        className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
