import { useState } from "react";
import { Workflow as WorkflowIcon } from "lucide-react";
import { splitPrompts } from "@/services/parser";
import { classifyBatch } from "@/services/classifier";
import { buildRelationGraph } from "@/services/relationBuilder";
import { bulkInsert } from "@/db/repos/promptRepo";
import { nanoid } from "nanoid";
import type { Prompt } from "@/types";

type Step = "paste" | "classifying" | "done" | "graphing" | "graph-done";

export default function Import() {
  const [raw, setRaw] = useState("");
  const [step, setStep] = useState<Step>("paste");
  const [preview, setPreview] = useState<string[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [graphProgress, setGraphProgress] = useState({ done: 0, total: 0 });
  const [graphResult, setGraphResult] = useState<{ updated: number; groups: number } | null>(null);
  const [error, setError] = useState("");

  function handleParse() {
    const items = splitPrompts(raw);
    if (!items.length) {
      setError("未检测到有效 Prompt，请检查输入格式");
      return;
    }
    setError("");
    setPreview(items);
  }

  async function handleClassify() {
    if (!preview.length) return;
    setStep("classifying");
    setProgress({ done: 0, total: preview.length });
    setError("");

    try {
      const results = await classifyBatch(
        preview,
        (done, total) => setProgress({ done, total }),
        3
      );

      const now = Date.now();
      const prompts: Prompt[] = results.map((r) => ({
        id: nanoid(),
        title: r.title || r.body.slice(0, 20),
        body: r.body,
        summary: r.summary,
        taskIntent: r.taskIntent,
        primaryScenario: r.primaryScenario,
        secondaryScenarios: r.secondaryScenarios ?? [],
        taskType: r.taskType,
        inputRequirements: r.inputRequirements,
        outputFormat: r.outputFormat,
        upstreamPrompts: [],
        downstreamPrompts: [],
        recommendedCombinations: [],
        boundaries: r.boundaries,
        tags: r.tags,
        difficulty: r.difficulty,
        valueLevel: r.valueLevel,
        shareable: true,
        isFavorited: false,
        useCount: 0,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
        classificationConfidence: r.confidence,
        pendingReview: r.confidence < 0.7,
      }));

      await bulkInsert(prompts);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "分类失败，请检查 API Key 设置");
      setStep("paste");
    }
  }

  function handleReset() {
    setRaw("");
    setPreview([]);
    setStep("paste");
    setError("");
    setProgress({ done: 0, total: 0 });
    setGraphProgress({ done: 0, total: 0 });
    setGraphResult(null);
  }

  async function handleBuildGraph() {
    setStep("graphing");
    setError("");
    try {
      const r = await buildRelationGraph((done, total) =>
        setGraphProgress({ done, total })
      );
      setGraphResult(r);
      setStep("graph-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "构建任务图失败");
      setStep("done"); // 退回完成态，让用户重试或跳过
    }
  }

  if (step === "done") {
    return (
      <div className="mx-auto max-w-xl p-6 text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-semibold">导入完成</h1>
        <p className="text-sm text-foreground/60">
          已导入 {progress.total} 条 Prompt。低置信度条目已标记为「待确认」。
        </p>
        <div className="rounded-lg border border-accent/20 bg-accent/[0.04] p-4 space-y-2 text-left">
          <div className="flex items-center gap-1.5">
            <WorkflowIcon size={14} className="text-accent" />
            <h2 className="text-sm font-medium">下一步：构建上下游任务图</h2>
          </div>
          <p className="text-xs text-foreground/65">
            让 AI 分析这批 Prompt 之间的协作关系，自动填充每条的「任务流」（上游 / 下游），并解锁工作流自动推荐。
          </p>
          <button
            onClick={handleBuildGraph}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
          >
            立即构建任务图（按一级场景分组）
          </button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-3 justify-center pt-1">
          <button
            onClick={handleReset}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            继续导入
          </button>
          <a
            href="/prompts"
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            稍后再说，先看 Prompt 库
          </a>
        </div>
      </div>
    );
  }

  if (step === "graphing") {
    return (
      <div className="mx-auto max-w-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">构建任务图中…</h1>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm text-foreground/70 tabular-nums">
            已完成 {graphProgress.done} / {graphProgress.total} 组
          </p>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{
                width: `${
                  graphProgress.total ? (graphProgress.done / graphProgress.total) * 100 : 0
                }%`,
              }}
            />
          </div>
          <p className="text-xs text-foreground/40">每组独立调用 AI，可能需要十几秒到一分钟…</p>
        </div>
      </div>
    );
  }

  if (step === "graph-done") {
    return (
      <div className="mx-auto max-w-xl p-6 text-center space-y-4">
        <div className="text-4xl">🎉</div>
        <h1 className="text-xl font-semibold">导入 + 任务图全部完成</h1>
        <p className="text-sm text-foreground/60">
          已导入 {progress.total} 条 Prompt；任务图已更新 {graphResult?.updated ?? 0} 条上下游关系（
          {graphResult?.groups ?? 0} 组）。
        </p>
        <div className="flex gap-3 justify-center">
          <a
            href="/"
            className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90"
          >
            前往工作台
          </a>
          <a
            href="/prompts"
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            查看 Prompt 库
          </a>
          <button
            onClick={handleReset}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            继续导入
          </button>
        </div>
      </div>
    );
  }

  if (step === "classifying") {
    return (
      <div className="mx-auto max-w-xl p-6 space-y-4">
        <h1 className="text-xl font-semibold">AI 分类中…</h1>
        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm text-foreground/70">
            已分类 {progress.done} / {progress.total}
          </p>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-foreground/40">并发 3 个请求，请勿关闭页面…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">批量导入 Prompt</h1>

      <div className="space-y-2">
        <label className="text-xs text-foreground/60">
          粘贴 Prompt 文本（用空行或 ### 分隔多条）
        </label>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={12}
          className="input resize-none font-mono text-xs"
          placeholder={"你是一位专业的...&#10;&#10;请根据以下信息...&#10;&#10;### 第二条 Prompt&#10;另一段提示词内容..."}
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={handleParse}
          className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
        >
          解析边界
        </button>
        {preview.length > 0 && (
          <button
            onClick={handleClassify}
            className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90"
          >
            开始 AI 分类（{preview.length} 条）
          </button>
        )}
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-foreground/60">预览（共 {preview.length} 条）：</p>
          <div className="max-h-60 overflow-y-auto space-y-1.5 rounded-lg border border-border p-3">
            {preview.map((p, i) => (
              <div key={i} className="rounded bg-muted px-2 py-1.5 text-xs">
                <span className="text-foreground/40 mr-2">#{i + 1}</span>
                {p.slice(0, 80)}{p.length > 80 ? "…" : ""}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
