import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "path";

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
