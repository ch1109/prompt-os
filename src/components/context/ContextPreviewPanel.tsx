import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Play } from "lucide-react";
import { db } from "@/db";
import { MarkdownView } from "@/components/MarkdownView";
import { estimateTokens } from "@/utils/tokenEstimate";
import { useContextReferenceCount } from "@/hooks/useContextReferenceCount";

interface Props {
  contextId: string | null;
  content: string;
  updatedAt: number | null;
}

const PLACEHOLDER_PROMPT = {
  id: "__placeholder__",
  title: "示例 Prompt",
  body: "请分析以下内容并给出结构化建议。",
};

export function ContextPreviewPanel({ contextId, content, updatedAt }: Props) {
  const prompts = useLiveQuery(
    () => db.prompts.orderBy("lastUsedAt").reverse().limit(20).toArray(),
    [],
    []
  );
  const candidates = useMemo(
    () =>
      (prompts && prompts.length > 0
        ? prompts.map((p) => ({ id: p.id, title: p.title, body: p.body }))
        : [PLACEHOLDER_PROMPT]),
    [prompts]
  );
  const [selectedId, setSelectedId] = useState<string>(candidates[0]?.id ?? "");
  // candidates 是 useLiveQuery 异步加载结果，首次拿到时需要把默认选中同步过去。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!candidates.find((c) => c.id === selectedId)) {
      setSelectedId(candidates[0]?.id ?? "");
    }
  }, [candidates, selectedId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];
  const preview =
    content.trim().length > 0 && selected
      ? `${content}\n\n---\n\n${selected.body}`
      : selected?.body ?? "";

  const tokenCount = estimateTokens(content);
  const charCount = content.length;
  const refCount = useContextReferenceCount(contextId);

  return (
    <div className="flex h-full flex-col gap-3">
      <section className="grid grid-cols-2 gap-2">
        <Metric label="字数" value={charCount.toString()} />
        <Metric label="预估 tokens" value={tokenCount.toString()} />
        <Metric
          label="被引用"
          value={`${refCount.total}`}
          hint={
            refCount.total > 0
              ? `${refCount.promptCount} Prompt · ${refCount.scenarioCount} 场景`
              : "暂无引用"
          }
        />
        <Metric
          label="最后修改"
          value={updatedAt ? formatTime(updatedAt) : "—"}
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-sub">预览拼接效果</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded border border-line bg-paper px-1.5 py-0.5 text-[11px] text-ink"
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title.length > 24 ? `${c.title.slice(0, 24)}…` : c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-line bg-soft/30 p-2.5">
          {preview ? (
            <MarkdownView text={preview} />
          ) : (
            <p className="text-xs italic text-hint">填写内容后预览将显示在此</p>
          )}
        </div>
      </section>

      <button
        type="button"
        disabled
        title="试运行能力暂未接入，将在后续版本提供"
        className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-soft/60 px-3 py-2 text-sm text-hint disabled:cursor-not-allowed"
      >
        <Play size={13} strokeWidth={1.8} />
        试运行（暂未接入）
      </button>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-line bg-paper px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-hint">{label}</div>
      <div className="mono text-sm tabular-nums text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-hint">{hint}</div>}
    </div>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
