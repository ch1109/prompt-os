import type { SnapshotGitResult, SnapshotGitState } from "@/services/backup";

/**
 * Electron 桌面壳注入的能力桥（见 electron/preload.cjs）。web 端为 undefined。
 *
 * 全仓判断「是否运行在桌面端」只走这里导出的 `desktop`——不要各处再去摸
 * `window.promptOSDesktop` 或 navigator.userAgent，否则以后换壳要满仓库改。
 */
export interface DesktopBridge {
  isDesktop: true;
  /** 已配置的仓库根目录；未配置或目录已失效时为 null。 */
  getRepoRoot(): Promise<string | null>;
  /** 弹原生目录选择器并校验（需含 .git 与 public/）。 */
  chooseRepoRoot(): Promise<{ ok: boolean; repoRoot?: string; error?: string }>;
  /** 写 <repoRoot>/public/data-snapshot.json 并自动 git add/commit/push。 */
  saveSnapshot(body: string): Promise<{ ok: boolean; git?: SnapshotGitResult; error?: string }>;
  /** 读仓库目录里的实时快照原文；未配置仓库或文件不存在返回 null。 */
  readSnapshot(): Promise<string | null>;
  gitState(): Promise<SnapshotGitState | null>;
}

declare global {
  interface Window {
    promptOSDesktop?: DesktopBridge;
  }
}

export const desktop: DesktopBridge | null =
  typeof window !== "undefined" ? window.promptOSDesktop ?? null : null;

/**
 * 本机能否直接写仓库快照（决定「保存快照到仓库」按钮与 git 状态提示是否出现）：
 * web 端只有 `pnpm dev` 有那个写盘中间件；桌面端任何构建都能走 IPC。
 */
export const canWriteRepo = import.meta.env.DEV || !!desktop;
