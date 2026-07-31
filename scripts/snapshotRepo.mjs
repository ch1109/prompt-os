import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/**
 * 仓库快照的写盘 + git 同步逻辑，被两个宿主共用：
 *
 * - `vite.config.ts` 的 snapshotWriter 中间件（web 端 `pnpm dev`，repoRoot = 仓库根）
 * - `electron/main.mjs` 的 IPC handler（桌面端，repoRoot = 用户在设置里选的仓库目录）
 *
 * 两边行为必须一字不差，否则同一份 public/data-snapshot.json 会被两条路径以不同
 * 语义写坏——所以这里只留一份实现，宿主只负责传 repoRoot 与搬运请求/响应。
 */

/** 快照文件相对仓库根的路径，git pathspec 与写盘共用同一个常量。 */
export const SNAPSHOT_REL_PATH = "public/data-snapshot.json";

export function snapshotAbsPath(repoRoot) {
  return path.resolve(repoRoot, SNAPSHOT_REL_PATH);
}

/** 统一的 git 执行器：参数数组（无 shell 注入面）+ 禁止交互式凭证 + 超时。 */
function gitRunner(repoRoot) {
  return (args) =>
    execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 20_000,
      // GIT_TERMINAL_PROMPT=0 + timeout：凭证不可用时 git 立即失败而非交互式挂起，
      // 否则会卡住调用方（dev 中间件的 req.on("end") / Electron 的 ipcMain.handle），
      // 让 UI 的 fetch/invoke 永远转圈。
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    }).trim();
}

function errText(e) {
  const raw = e.stderr ? e.stderr.toString() : e.message ?? String(e);
  return raw.trim().split("\n").slice(-3).join(" ");
}

/**
 * 只读探测仓库快照的 git 同步状态，供 UI 横幅如实显示「已保存未 commit / 未 push」。
 * 全部只跑 status/rev-list 只读命令。
 */
export function readSnapshotGitState(repoRoot) {
  const run = gitRunner(repoRoot);
  try {
    const dirty = run(["status", "--porcelain", "--", SNAPSHOT_REL_PATH]);
    if (dirty) return { state: "uncommitted", detail: "快照已保存到磁盘，但尚未 commit" };
    // 已提交：再看本地分支是否领先 upstream（无 upstream 时 rev-list 会抛错）
    try {
      const ahead = run(["rev-list", "--count", "@{upstream}..HEAD"]);
      if (Number(ahead) > 0) return { state: "unpushed", detail: `本地有 ${ahead} 个提交未 push` };
      return { state: "synced", detail: "快照已提交并推送" };
    } catch {
      return { state: "no-upstream", detail: "当前分支未设置 upstream，无法判断是否已推送" };
    }
  } catch (e) {
    return { state: "error", detail: String(e) };
  }
}

/**
 * 写盘后自动把快照文件 git add + commit + push。
 *
 * - commit 用 pathspec 限定只提交 public/data-snapshot.json，不裹挟工作区其它未提交改动；
 * - 文件无变化时 staged 为空 → committed:false，不产生空提交；
 * - 仅在 committed 后才 push；push 失败（断网/凭证/无 upstream）只记录 detail，不抛错——
 *   写盘已成功，git 失败由调用方据 detail 提示并保留手动命令兜底。
 */
export function commitAndPushSnapshot(repoRoot, body) {
  const run = gitRunner(repoRoot);

  let message = `data: 自动同步数据快照（${new Date().toISOString()}）`;
  try {
    const counts = JSON.parse(body).counts;
    if (counts) {
      message = `data: 自动同步数据快照（${counts.prompts} Prompt · ${counts.contexts} 上下文 · ${counts.scenarios} 场景 · ${counts.taskPacks} 任务包）`;
    }
  } catch {
    // body 解析失败时退化为时间戳 message，不影响提交
  }

  try {
    run(["add", "--", SNAPSHOT_REL_PATH]);
  } catch (e) {
    return { committed: false, pushed: false, detail: `git add 失败：${errText(e)}` };
  }

  // 先看暂存区是否真有改动——区分「文件未变」与「commit 真失败」，
  // 不把后者谎报成「数据无变化」（避免假安心：UI 说存好了其实没有）。
  let staged;
  try {
    staged = run(["diff", "--cached", "--name-only", "--", SNAPSHOT_REL_PATH]);
  } catch (e) {
    return { committed: false, pushed: false, detail: `git diff 失败：${errText(e)}` };
  }
  if (!staged) {
    return { committed: false, pushed: false, detail: "数据无变化，仓库快照已是最新" };
  }

  try {
    run(["commit", "-m", message, "--", SNAPSHOT_REL_PATH]);
  } catch (e) {
    return { committed: false, pushed: false, detail: `提交失败：${errText(e)}` };
  }

  try {
    run(["push"]);
    return { committed: true, pushed: true, detail: "已提交并推送" };
  } catch (e) {
    return { committed: true, pushed: false, detail: errText(e) };
  }
}

/** 写盘 + 自动提交推送。写盘失败会抛错（调用方转成 500 / IPC 错误）。 */
export function writeSnapshotAndSync(repoRoot, body) {
  fs.writeFileSync(snapshotAbsPath(repoRoot), body);
  // 写盘成功后自动提交推送；git 失败不影响保存本身，结果回传由 UI 据实提示。
  return commitAndPushSnapshot(repoRoot, body);
}
