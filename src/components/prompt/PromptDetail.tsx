import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, Layers, Pencil, Star, Trash2, Wand2, X } from "lucide-react";
import { MarkdownView } from "@/components/MarkdownView";
import { db } from "@/db";
import { deletePrompt, incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";
import { extractVariables, isLongValue, renderTemplate } from "@/services/templateVariables";
import { confirm } from "@/store/confirmStore";
import { useUI } from "@/store/uiStore";
import { UsePromptDialog } from "./UsePromptDialog";

interface Props {
  onEdit: (id: string) => void;
}

export function PromptDetail({ onEdit }: Props) {
  const { selectedPromptId, setSelectedPrompt } = useUI();
  const [copied, setCopied] = useState<"raw" | "filled" | null>(null);
  const [useWithContextOpen, setUseWithContextOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});

  const p = useLiveQuery(
    () => (selectedPromptId ? db.prompts.get(selectedPromptId) : undefined),
    [selectedPromptId]
  );

  const variables = useMemo(() => extractVariables(p?.body ?? ""), [p?.body]);
  const filledBody = useMemo(
    () => renderTemplate(p?.body ?? "", slotValues),
    [p?.body, slotValues]
  );

  useEffect(() => {
    queueMicrotask(() => {
      setCopied(null);
      setSlotOpen(false);
      setSlotValues({});
    });
  }, [selectedPromptId]);

  if (!p) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-hint">
        选择左侧卡片查看详情
      </div>
    );
  }
  const prompt = p;
  const filledCount = variables.filter((name) => (slotValues[name] ?? "").trim()).length;

  async function handleCopy(text: string, kind: "raw" | "filled") {
    await navigator.clipboard.writeText(text);
    await incrementUseCount(prompt.id);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleDelete() {
    const ok = await confirm({
      title: "确认删除这条 Prompt？",
      message: `「${prompt.title}」删除后无法恢复。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await deletePrompt(prompt.id);
    setSelectedPrompt(null);
  }

  return (
    <div className="space-y-6 p-5 text-[15px] md:p-6">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[22px] font-semibold leading-snug tracking-tight text-ink">
          {prompt.title}
        </h2>
        <div className="flex shrink-0 gap-0.5 [&_button]:rounded-md [&_button]:p-2 [&_button]:transition [&_button:hover]:bg-soft">
          <button onClick={() => toggleFavorite(prompt.id)} title="收藏">
            <Star
              size={17}
              strokeWidth={1.6}
              className={prompt.isFavorited ? "fill-amber text-amber" : "text-hint hover:text-amber"}
            />
          </button>
          <button onClick={() => onEdit(prompt.id)} title="编辑">
            <Pencil size={17} strokeWidth={1.6} className="text-hint hover:text-moss" />
          </button>
          <button onClick={handleDelete} title="删除">
            <Trash2 size={17} strokeWidth={1.6} className="text-hint hover:text-red-500" />
          </button>
          <button onClick={() => setSelectedPrompt(null)} title="关闭">
            <X size={17} strokeWidth={1.6} className="text-hint hover:text-ink" />
          </button>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex flex-wrap gap-1.5">
        <span className="chip chip-task chip-mono uppercase tracking-wider2">{prompt.taskType}</span>
        <span className="chip chip-mono">{prompt.difficulty}</span>
        <span className="chip chip-mono">{prompt.valueLevel}</span>
      </div>

      {/* 正文 */}
      <Field label="正文">
        <div className="rounded-2xl border border-line/75 bg-canvas/[0.72] px-[18px] py-4 shadow-[inset_0_1px_0_rgb(var(--paper)/0.6)]">
          <MarkdownView text={prompt.body} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => handleCopy(prompt.body, "raw")}
            className="inline-flex items-center gap-1.5 rounded-full bg-moss px-4 py-2 text-[13px] font-semibold text-paper shadow-[0_10px_22px_-16px_rgb(var(--moss)/0.85)] transition hover:bg-moss/90"
          >
            {copied === "raw" ? <Check size={14} strokeWidth={2} /> : <Copy size={14} strokeWidth={2} />}
            {copied === "raw" ? "已复制" : "复制正文"}
          </button>
          {variables.length > 0 && (
            <button
              onClick={() => setSlotOpen((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-full border border-line/75 bg-paper/70 px-4 py-2 text-[13px] font-semibold text-sub transition hover:border-line hover:bg-soft hover:text-ink"
            >
              <Wand2 size={14} strokeWidth={1.8} /> {slotOpen ? "收起插槽" : "填写插槽"}
            </button>
          )}
          <button
            onClick={() => setUseWithContextOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-line/75 bg-paper/70 px-4 py-2 text-[13px] font-semibold text-sub transition hover:border-line hover:bg-soft hover:text-ink"
          >
            <Layers size={14} strokeWidth={1.8} /> 带上下文使用
          </button>
        </div>
      </Field>
      {slotOpen && variables.length > 0 && (
        <Field label="插槽填写">
          <div className="space-y-3 rounded-2xl border border-line/75 bg-canvas/[0.72] p-4">
            <div className="grid gap-3">
              {variables.map((name) => {
                const value = slotValues[name] ?? "";
                return (
                  <label key={name} className="block">
                    <span className="mono mb-1.5 block text-xs font-semibold text-sub">
                      {name}
                    </span>
                    <textarea
                      value={value}
                      onChange={(e) =>
                        setSlotValues((prev) => ({
                          ...prev,
                          [name]: e.target.value,
                        }))
                      }
                      rows={isLongValue(value) ? 4 : 2}
                      placeholder={`填写 ${name}`}
                      className="input w-full resize-y text-[14.5px] leading-relaxed"
                    />
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-hint">
                已填 {filledCount}/{variables.length}，未填插槽会保留原样
              </span>
              <button
                onClick={() => handleCopy(filledBody, "filled")}
                className="inline-flex items-center gap-1.5 rounded-full bg-moss px-4 py-2 text-[13px] font-semibold text-paper transition hover:bg-moss/90"
              >
                {copied === "filled" ? (
                  <Check size={14} strokeWidth={2} />
                ) : (
                  <Copy size={14} strokeWidth={2} />
                )}
                {copied === "filled" ? "已复制" : "复制填好版本"}
              </button>
            </div>
          </div>
        </Field>
      )}
      {useWithContextOpen && (
        <UsePromptDialog prompt={prompt} onClose={() => setUseWithContextOpen(false)} />
      )}

      {prompt.summary && <Field label="摘要">{prompt.summary}</Field>}
      {prompt.taskIntent && <Field label="任务意图">{prompt.taskIntent}</Field>}
      {prompt.primaryScenario.length > 0 && (
        <Field label="主场景">
          <span className="mono text-[13px] text-ink/80">{prompt.primaryScenario.join(" / ")}</span>
        </Field>
      )}
      {prompt.secondaryScenarios?.length > 0 && (
        <Field label="副场景">
          <div className="space-y-1">
            {prompt.secondaryScenarios.map((sp, i) => (
              <div key={i} className="mono text-[13px] text-sub">{sp.join(" / ")}</div>
            ))}
          </div>
        </Field>
      )}
      {prompt.inputRequirements && <Field label="输入要求">{prompt.inputRequirements}</Field>}
      {prompt.outputFormat && <Field label="输出格式">{prompt.outputFormat}</Field>}
      {prompt.boundaries && <Field label="适用边界">{prompt.boundaries}</Field>}

      {prompt.tags.length > 0 && (
        <Field label="标签">
          <div className="flex flex-wrap gap-1">
            {prompt.tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        </Field>
      )}

      {(prompt.upstreamPrompts?.length > 0 || prompt.downstreamPrompts?.length > 0) && (
        <Field label="任务流">
          <div className="space-y-2.5">
            {prompt.upstreamPrompts?.length > 0 && (
              <RelationList label="上游" ids={prompt.upstreamPrompts} onSelect={setSelectedPrompt} />
            )}
            {prompt.downstreamPrompts?.length > 0 && (
              <RelationList label="下游" ids={prompt.downstreamPrompts} onSelect={setSelectedPrompt} />
            )}
          </div>
        </Field>
      )}

      <Field label="使用 / 上次">
        <span className="mono text-[13px] text-sub">
          {prompt.useCount} 次 / {prompt.lastUsedAt ? new Date(prompt.lastUsedAt).toLocaleString("zh-CN") : "从未使用"}
        </span>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono mb-2 text-xs font-semibold uppercase tracking-wider2 text-hint">
        {label}
      </div>
      <div className="text-[15px] leading-relaxed text-ink/[0.92]">{children}</div>
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
      <div className="mb-1.5 text-xs uppercase tracking-wider2 text-hint">{label}</div>
      <div className="space-y-1">
        {items.map((p, i) =>
          p ? (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="block w-full rounded-lg border border-line/75 bg-paper/70 px-3 py-2.5 text-left text-[13.5px] font-medium text-sub transition hover:border-moss/25 hover:bg-soft hover:text-ink"
            >
              {p.title}
            </button>
          ) : (
            <div key={i} className="text-xs text-hint">（已删除）</div>
          )
        )}
      </div>
    </div>
  );
}
