/** 手写声明：snapshotRepo.mjs 是纯 Node 模块（Electron 主进程也要 import），不走 TS 编译。 */

export declare const SNAPSHOT_REL_PATH: string;

export declare function snapshotAbsPath(repoRoot: string): string;

export interface SnapshotGitState {
  state: "uncommitted" | "unpushed" | "no-upstream" | "synced" | "error";
  detail: string;
}

export interface SnapshotGitResult {
  committed: boolean;
  pushed: boolean;
  detail: string;
}

export declare function readSnapshotGitState(repoRoot: string): SnapshotGitState;

export declare function commitAndPushSnapshot(repoRoot: string, body: string): SnapshotGitResult;

export declare function writeSnapshotAndSync(repoRoot: string, body: string): SnapshotGitResult;
