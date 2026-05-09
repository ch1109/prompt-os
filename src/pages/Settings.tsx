import { useRef, useState } from "react";
import {
  Workflow as WorkflowIcon,
  Monitor,
  Sun,
  Moon,
  Download,
  Upload,
} from "lucide-react";
import { useSettings, type ThemeMode } from "@/store/settingsStore";
import { buildRelationGraph } from "@/services/relationBuilder";
import { exportAllData, importBackupFromFile, type ImportOutcome } from "@/services/backup";
import { toast } from "@/store/toastStore";
import { confirm } from "@/store/confirmStore";

const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { value: "system", label: "跟随系统", Icon: Monitor },
  { value: "light", label: "浅色", Icon: Sun },
  { value: "dark", label: "深色", Icon: Moon },
];

export default function Settings() {
  const { apiKey, model, theme, setApiKey, setModel, setTheme } = useSettings();
  const [saved, setSaved] = useState(false);
  const [graphState, setGraphState] = useState<
    | { phase: "idle" }
    | { phase: "running"; done: number; total: number }
    | { phase: "done"; updated: number; groups: number }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  const [backupBusy, setBackupBusy] = useState<"idle" | "exporting" | "importing">("idle");
  const [lastImport, setLastImport] = useState<ImportOutcome | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleExport() {
    setBackupBusy("exporting");
    try {
      const counts = await exportAllData();
      const total = counts.prompts + counts.contexts + counts.scenarios + counts.workflows;
      toast.success(
        `已导出 ${total} 条（Prompt ${counts.prompts} · 上下文 ${counts.contexts} · 场景 ${counts.scenarios} · 工作流 ${counts.workflows}）`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBackupBusy("idle");
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
        outcome.added.workflows;
      toast.success(`已导入 ${total} 条`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导入失败");
    } finally {
      setBackupBusy("idle");
    }
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={backupBusy !== "idle"}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-1.5 text-xs text-sub transition-colors hover:border-moss/40 hover:bg-moss-soft hover:text-moss disabled:opacity-40"
          >
            <Download size={13} strokeWidth={1.7} />
            {backupBusy === "exporting" ? "导出中…" : "导出全部数据"}
          </button>
          <button
            onClick={pickImportFile}
            disabled={backupBusy !== "idle"}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-1.5 text-xs text-sub transition-colors hover:border-moss/40 hover:bg-moss-soft hover:text-moss disabled:opacity-40"
          >
            <Upload size={13} strokeWidth={1.7} />
            {backupBusy === "importing" ? "导入中…" : "导入备份"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
        {lastImport && (
          <div className="rounded-md border border-line bg-canvas/60 p-2.5 text-xs text-sub">
            <div className="mb-1 text-hint">最近一次导入</div>
            <div className="tabular-nums">
              新增：Prompt {lastImport.added.prompts} · 上下文 {lastImport.added.contexts} · 场景{" "}
              {lastImport.added.scenarios} · 工作流 {lastImport.added.workflows}
            </div>
            {(lastImport.renamed.prompts ||
              lastImport.renamed.contexts ||
              lastImport.renamed.scenarios ||
              lastImport.renamed.workflows) > 0 && (
              <div className="mt-0.5 tabular-nums text-hint">
                因 id 冲突重命名：
                {[
                  ["Prompt", lastImport.renamed.prompts],
                  ["上下文", lastImport.renamed.contexts],
                  ["场景", lastImport.renamed.scenarios],
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
    </div>
  );
}
