import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "path";

/**
 * 只读探测仓库快照的 git 同步状态，供 dev 横幅如实显示「已保存未 commit / 未 push」。
 * 全部用 execFileSync（参数数组，无 shell 注入面），且只跑 status/rev-list 只读命令。
 */
function readSnapshotGitState(): { state: string; detail: string } {
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: __dirname, encoding: "utf8" }).trim();
  try {
    const dirty = run(["status", "--porcelain", "--", "public/data-snapshot.json"]);
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
 * 写盘后自动把快照文件 git add + commit + push（dev only）。
 *
 * - commit 用 pathspec 限定只提交 public/data-snapshot.json，不裹挟工作区其它未提交改动；
 * - 文件无变化时 commit 抛「nothing to commit」→ committed:false，不产生空提交；
 * - 仅在 committed 后才 push；push 失败（断网/凭证/无 upstream）只记录 detail，不抛错——
 *   写盘已成功，git 失败由调用方据 detail 提示并保留手动命令兜底。
 * - 全部 execFileSync（参数数组，无 shell 注入面）。
 */
function commitAndPushSnapshot(body: string): {
  committed: boolean;
  pushed: boolean;
  detail: string;
} {
  // GIT_TERMINAL_PROMPT=0 + timeout：凭证不可用时 git 立即失败而非交互式挂起，
  // 否则会卡住 req.on("end")，让浏览器的 fetch 永远转圈。
  const run = (args: string[]) =>
    execFileSync("git", args, {
      cwd: __dirname,
      encoding: "utf8",
      timeout: 20_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    }).trim();
  const errText = (e: unknown) => {
    const err = e as { stderr?: Buffer | string; message?: string };
    const raw = err.stderr ? err.stderr.toString() : err.message ?? String(e);
    return raw.trim().split("\n").slice(-3).join(" ");
  };

  let message = `data: 自动同步数据快照（${new Date().toISOString()}）`;
  try {
    const counts = (JSON.parse(body) as { counts?: Record<string, number> }).counts;
    if (counts) {
      message = `data: 自动同步数据快照（${counts.prompts} Prompt · ${counts.contexts} 上下文 · ${counts.scenarios} 场景 · ${counts.taskPacks} 任务包）`;
    }
  } catch {
    // body 解析失败时退化为时间戳 message，不影响提交
  }

  try {
    run(["add", "--", "public/data-snapshot.json"]);
  } catch (e) {
    return { committed: false, pushed: false, detail: `git add 失败：${errText(e)}` };
  }

  // 先看暂存区是否真有改动——区分「文件未变」与「commit 真失败」，
  // 不把后者谎报成「数据无变化」（避免假安心：UI 说存好了其实没有）。
  let staged: string;
  try {
    staged = run(["diff", "--cached", "--name-only", "--", "public/data-snapshot.json"]);
  } catch (e) {
    return { committed: false, pushed: false, detail: `git diff 失败：${errText(e)}` };
  }
  if (!staged) {
    return { committed: false, pushed: false, detail: "数据无变化，仓库快照已是最新" };
  }

  try {
    run(["commit", "-m", message, "--", "public/data-snapshot.json"]);
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

/**
 * dev 专用：把 Settings「保存快照到仓库」POST 过来的备份直接写进
 * public/data-snapshot.json，随后自动 git commit + push。仅在 `pnpm dev`
 * （apply: "serve"）生效，生产构建无此端点。消除「导出文件落 Downloads →
 * 手动改名搬运 → 手敲 git」的全部断点，跨设备同步降为「点一下」。
 */
function snapshotWriter(): Plugin {
  return {
    name: "prompt-os-snapshot-writer",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__save-snapshot", (req, res, next) => {
        if (req.method !== "POST") return next();
        // 收集 Buffer 分块后一次性 concat 再解码——直接 `body += chunk` 会在
        // chunk 边界切断多字节 UTF-8 字符（快照含大量中文），逐块 toString 会损坏。
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk as Buffer));
        req.on("end", () => {
          try {
            const body = Buffer.concat(chunks).toString("utf8");
            const target = path.resolve(__dirname, "public/data-snapshot.json");
            fs.writeFileSync(target, body);
            // 写盘成功后自动提交推送；git 失败不影响保存本身，结果回传由 UI 据实提示。
            const git = commitAndPushSnapshot(body);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, git }));
          } catch (e) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: String(e) }));
          }
        });
      });

      // 只读 git 状态：横幅/设置卡片据此显示「已保存未 commit / 未 push」。
      server.middlewares.use("/__snapshot-git-status", (req, res, next) => {
        if (req.method !== "GET") return next();
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(readSnapshotGitState()));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), snapshotWriter()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // host: true 同时监听 IPv4(0.0.0.0) + IPv6(::)。Vite 默认只听 IPv6 localhost(::1)，
    // 而浏览器（尤其 Chrome）常把 localhost 解析成 IPv4 127.0.0.1 → 连不上「打不开」。
    host: true,
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
