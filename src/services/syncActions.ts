import {
  saveSnapshotToRepo,
  restoreFromRepoSnapshot,
  peekRepoSnapshot,
  getLocalLatestEdit,
} from "@/services/backup";
import { toast } from "@/store/toastStore";
import { confirm } from "@/store/confirmStore";
import { formatRelative } from "@/utils/formatRelative";

/**
 * 跨设备同步的两个共享动作：保存到仓库、从仓库恢复。
 *
 * 抽出来给「全局同步横幅」与「设置页」共用——尤其是「从仓库恢复」前那段
 * 「本机比仓库新」的冲突确认逻辑，两处必须一字不差，否则一边漏判就会丢编辑。
 * 返回 boolean 表示动作是否真正执行（用户取消/失败为 false），调用方据此刷新状态。
 */

/** 同步状态变更广播：保存/恢复成功后派发，全局横幅监听以即时刷新（跨组件、无需共享 store）。 */
export const SYNC_CHANGED_EVENT = "promptos:sync-changed";
function notifySyncChanged() {
  window.dispatchEvent(new Event(SYNC_CHANGED_EVENT));
}

/** A 台：把本机数据写入仓库快照（dev only）。成功后 toast 引导执行 git。 */
export async function runSaveToRepo(): Promise<boolean> {
  try {
    const { counts } = await saveSnapshotToRepo();
    const total =
      counts.prompts + counts.contexts + counts.scenarios + counts.taskPacks + counts.workflows;
    toast.success(`已写入 public/data-snapshot.json（${total} 条），下一步执行 git 提交并推送`);
    notifySyncChanged();
    return true;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "保存到仓库失败");
    return false;
  }
}

/**
 * B 台：从仓库快照覆盖恢复。恢复前 peek 仓库 exportedAt 与本机最近编辑比对——
 * 本机更新时升级为强警告，防止「本机有新编辑却被更旧的仓库快照覆盖」丢数据
 * （last-writer-wins 防呆）。
 */
export async function runRepoRestore(): Promise<boolean> {
  let repoAt: number;
  try {
    const meta = await peekRepoSnapshot();
    repoAt = meta.exportedAt ?? 0;
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "读取仓库快照失败");
    return false;
  }
  const localLatest = await getLocalLatestEdit();
  const localNewer = repoAt > 0 && localLatest > repoAt;

  const ok = await confirm({
    title: localNewer ? "⚠️ 本机数据似乎比仓库快照新" : "从仓库恢复最新数据",
    message: localNewer
      ? `本机存在比仓库快照更新的数据（本机最近编辑 ${formatRelative(localLatest)}，仓库快照导出于 ${formatRelative(repoAt)}）。恢复会清空本机数据、丢失这些更新。\n\n· 若本机只是出厂初始数据，可放心继续；\n· 若你在本机有新编辑，请先点「保存快照到仓库」再恢复。\n\n确定恢复吗？`
      : `将清空本机现有的 Prompt / 上下文 / 场景 / 任务包，替换为仓库快照（导出于 ${formatRelative(repoAt)}）。当前数据会自动归档到「本地快照」，可回滚。`,
    confirmText: "恢复",
    danger: true,
  });
  if (!ok) return false;

  try {
    const { stats, exportedAt } = await restoreFromRepoSnapshot();
    const total = stats.prompts + stats.contexts + stats.scenarios + stats.taskPacks;
    const when = exportedAt ? `（快照导出于 ${new Date(exportedAt).toLocaleString()}）` : "";
    toast.success(`已从仓库恢复 ${total} 条${when}，刷新页面查看`);
    notifySyncChanged();
    return true;
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "从仓库恢复失败");
    return false;
  }
}
