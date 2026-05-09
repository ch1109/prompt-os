import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { updatePrompt, deletePrompt } from "@/db/repos/promptRepo";

export default function PendingReview() {
  const items = useLiveQuery(() => db.prompts.filter((p) => !!p.pendingReview).toArray()) ?? [];

  return (
    <div className="mx-auto max-w-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">待确认 ({items.length})</h1>
        <p className="text-xs text-foreground/50">AI 置信度 &lt; 0.7 的条目，请人工确认后入库</p>
      </div>

      {items.length === 0 && (
        <div className="py-12 text-center text-sm text-foreground/40">暂无待确认条目</div>
      )}

      {items.map((p) => (
        <div key={p.id} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="font-medium text-sm">{p.title}</div>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/50">
              置信度 {((p.classificationConfidence ?? 0) * 100).toFixed(0)}%
            </span>
          </div>
          {p.summary && (
            <div className="text-xs text-foreground/60">{p.summary}</div>
          )}
          <div className="flex flex-wrap gap-1">
            {p.tags.slice(0, 5).map((t) => (
              <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/60">{t}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => updatePrompt(p.id, { pendingReview: false })}
              className="rounded bg-accent px-2 py-1 text-xs text-white hover:bg-accent/90"
            >
              确认入库
            </button>
            <button
              onClick={() => deletePrompt(p.id)}
              className="rounded border px-2 py-1 text-xs text-foreground/60 hover:bg-muted"
            >
              丢弃
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
