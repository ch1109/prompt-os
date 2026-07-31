import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
// 写盘 + git 同步的实现放在 scripts/snapshotRepo.mjs，与 Electron 主进程共用同一份，
// 避免两个宿主对同一个 public/data-snapshot.json 出现语义分叉。
import { readSnapshotGitState, writeSnapshotAndSync } from "./scripts/snapshotRepo.mjs";

/**
 * dev 专用：把 Settings「保存快照到仓库」POST 过来的备份直接写进
 * public/data-snapshot.json，随后自动 git commit + push。仅在 `pnpm dev`
 * （apply: "serve"）生效，生产构建无此端点。消除「导出文件落 Downloads →
 * 手动改名搬运 → 手敲 git」的全部断点，跨设备同步降为「点一下」。
 *
 * 桌面端（Electron）没有 dev server，同一能力走 IPC，见 electron/main.mjs。
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
            const git = writeSnapshotAndSync(__dirname, body);
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
        res.end(JSON.stringify(readSnapshotGitState(__dirname)));
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
