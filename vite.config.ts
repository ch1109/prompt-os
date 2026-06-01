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
 * dev 专用：把 Settings「保存快照到仓库」POST 过来的备份直接写进
 * public/data-snapshot.json。仅在 `pnpm dev`（apply: "serve"）生效，
 * 生产构建无此端点。消除「导出文件落 Downloads → 手动改名搬运」的断点，
 * 文件名/路径由此处写死，跨设备同步只剩一步 git push。
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
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
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
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  },
});
