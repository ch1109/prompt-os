import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Copy, Star, Trash2, Pencil, Check, X, Layers } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { deletePrompt, incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";
import { UsePromptDialog } from "./UsePromptDialog";
import { confirm } from "@/store/confirmStore";
import { MarkdownView } from "@/components/MarkdownView";

interface Props {
  onEdit: (id: string) => void;
}

export function PromptDetail({ onEdit }: Props) {
  const { selectedPromptId, setSelectedPrompt } = useUI();
  const [copied, setCopied] = useState(false);
  const [useWithContextOpen, setUseWithContextOpen] = useState(false);

  const p = useLiveQuery(
    () => (selectedPromptId ? db.prompts.get(selectedPromptId) : undefined),
    [selectedPromptId]
  );

  if (!p) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-[13px] text-hint">
        选择左侧卡片查看详情
      </div>
    );
  }

  async function handleCopy() {
    if (!p) return;
    await navigator.clipboard.writeText(p.body);
    await incrementUseCount(p.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "确认删除这条 Prompt？",
      message: `「${p?.title}」删除后无法恢复。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await deletePrompt(p!.id);
    setSelectedPrompt(null);
  }

  return (
    <div className="space-y-5 p-5 text-[13.5px]">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="serif text-[19px] font-semibold leading-snug tracking-tight text-ink">
          {p.title}
        </h2>
        <div className="flex shrink-0 gap-0.5 [&_button]:rounded [&_button]:p-1.5 [&_button:hover]:bg-soft">
          <button onClick={() => toggleFavorite(p.id)} title="收藏">
            <Star
              size={15}
              strokeWidth={1.6}
              className={p.isFavorited ? "fill-amber text-amber" : "text-hint hover:text-amber"}
            />
          </button>
          <button onClick={() => onEdit(p.id)} title="编辑">
            <Pencil size={15} strokeWidth={1.6} className="text-hint hover:text-moss" />
          </button>
          <button onClick={handleDelete} title="删除">
            <Trash2 size={15} strokeWidth={1.6} className="text-hint hover:text-red-500" />
          </button>
          <button onClick={() => setSelectedPrompt(null)} title="关闭">
            <X size={15} strokeWidth={1.6} className="text-hint hover:text-ink" />
          </button>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex flex-wrap gap-1.5">
        <span className="chip chip-task chip-mono uppercase tracking-wider2">{p.taskType}</span>
        <span className="chip chip-mono">{p.difficulty}</span>
        <span className="chip chip-mono">{p.valueLevel}</span>
      </div>

      {/* 正文 */}
      <Field label="正文">
        <div className="max-h-72 overflow-y-auto rounded border border-line bg-canvas px-3.5 py-2.5">
          <MarkdownView text={p.body} />
        </div>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded bg-moss px-3 py-1.5 text-[12px] font-medium text-paper transition hover:bg-moss/90"
          >
            {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
            {copied ? "已复制" : "复制正文"}
          </button>
          <button
            onClick={() => setUseWithContextOpen(true)}
            className="inline-flex items-center gap-1.5 rounded border border-line px-3 py-1.5 text-[12px] font-medium text-sub transition hover:bg-soft hover:text-ink"
          >
            <Layers size={12} strokeWidth={1.8} /> 带上下文使用
          </button>
        </div>
      </Field>
      {useWithContextOpen && (
        <UsePromptDialog prompt={p} onClose={() => setUseWithContextOpen(false)} />
      )}

      {p.summary && <Field label="摘要">{p.summary}</Field>}
      {p.taskIntent && <Field label="任务意图">{p.taskIntent}</Field>}
      {p.primaryScenario.length > 0 && (
        <Field label="主场景">
          <span className="mono text-[12.5px] text-ink/80">{p.primaryScenario.join(" / ")}</span>
        </Field>
      )}
      {p.secondaryScenarios?.length > 0 && (
        <Field label="副场景">
          <div className="space-y-1">
            {p.secondaryScenarios.map((sp, i) => (
              <div key={i} className="mono text-[12px] text-sub">{sp.join(" / ")}</div>
            ))}
          </div>
        </Field>
      )}
      {p.inputRequirements && <Field label="输入要求">{p.inputRequirements}</Field>}
      {p.outputFormat && <Field label="输出格式">{p.outputFormat}</Field>}
      {p.boundaries && <Field label="适用边界">{p.boundaries}</Field>}

      {p.tags.length > 0 && (
        <Field label="标签">
          <div className="flex flex-wrap gap-1">
            {p.tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </Field>
      )}

      {(p.upstreamPrompts?.length > 0 || p.downstreamPrompts?.length > 0) && (
        <Field label="任务流">
          <div className="space-y-2.5">
            {p.upstreamPrompts?.length > 0 && (
              <RelationList label="上游" ids={p.upstreamPrompts} onSelect={setSelectedPrompt} />
            )}
            {p.downstreamPrompts?.length > 0 && (
              <RelationList label="下游" ids={p.downstreamPrompts} onSelect={setSelectedPrompt} />
            )}
          </div>
        </Field>
      )}

      <Field label="使用 / 上次">
        <span className="mono text-[12px] text-sub">
          {p.useCount} 次 / {p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleString("zh-CN") : "从未使用"}
        </span>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono mb-1.5 text-[10.5px] font-medium uppercase tracking-wider2 text-hint">
        {label}
      </div>
      <div className="text-[13.5px] leading-relaxed text-ink/90">{children}</div>
    </div>
  );
}

function RelationList({
  label,
  ids,
  onSelect,
}: {
  label: string;
  ids: string[];
  onSelect: (id: string | null) => void;
}) {
  const items = useLiveQuery(() => db.prompts.bulkGet(ids), [ids.join(",")]) ?? [];
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider2 text-hint">{label}</div>
      <div className="space-y-1">
        {items.map((p, i) =>
          p ? (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="block w-full rounded border border-line bg-paper px-2.5 py-1.5 text-left text-[12.5px] text-sub transition hover:border-moss/30 hover:bg-soft hover:text-ink"
            >
              {p.title}
            </button>
          ) : (
            <div key={i} className="text-[11px] text-hint">（已删除）</div>
          )
        )}
      </div>
    </div>
  );
}
