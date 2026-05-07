import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Copy, Star, Trash2, Pencil, Check, X } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { deletePrompt, incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";

interface Props {
  onEdit: (id: string) => void;
}

export function PromptDetail({ onEdit }: Props) {
  const { selectedPromptId, setSelectedPrompt } = useUI();
  const [copied, setCopied] = useState(false);

  const p = useLiveQuery(
    () => (selectedPromptId ? db.prompts.get(selectedPromptId) : undefined),
    [selectedPromptId]
  );

  if (!p) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-sm text-foreground/40">
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
    if (!confirm(`确认删除「${p?.title}」？`)) return;
    await deletePrompt(p!.id);
    setSelectedPrompt(null);
  }

  return (
    <div className="space-y-4 p-4 text-sm">
      {/* 标题行 */}
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug">{p.title}</h2>
        <div className="flex shrink-0 gap-1.5">
          <button onClick={() => toggleFavorite(p.id)} title="收藏">
            <Star size={16} className={p.isFavorited ? "fill-yellow-400 text-yellow-400" : "text-foreground/40 hover:text-yellow-400"} />
          </button>
          <button onClick={() => onEdit(p.id)} title="编辑">
            <Pencil size={16} className="text-foreground/40 hover:text-accent" />
          </button>
          <button onClick={handleDelete} title="删除">
            <Trash2 size={16} className="text-foreground/40 hover:text-red-500" />
          </button>
          <button onClick={() => setSelectedPrompt(null)} title="关闭">
            <X size={16} className="text-foreground/40 hover:text-foreground" />
          </button>
        </div>
      </div>

      {/* 元信息 */}
      <div className="flex flex-wrap gap-1.5">
        <Badge accent>{p.taskType}</Badge>
        <Badge>{p.difficulty}</Badge>
        <Badge>{p.valueLevel}</Badge>
      </div>

      {/* 正文 */}
      <Field label="正文">
        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
          {p.body}
        </pre>
        <button
          onClick={handleCopy}
          className="mt-2 inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "已复制" : "复制正文"}
        </button>
      </Field>

      {p.summary && <Field label="摘要">{p.summary}</Field>}
      {p.primaryScenario.length > 0 && (
        <Field label="主场景">{p.primaryScenario.join(" / ")}</Field>
      )}
      {p.inputRequirements && <Field label="输入要求">{p.inputRequirements}</Field>}
      {p.outputFormat && <Field label="输出格式">{p.outputFormat}</Field>}
      {p.boundaries && <Field label="适用边界">{p.boundaries}</Field>}

      {p.tags.length > 0 && (
        <Field label="标签">
          <div className="flex flex-wrap gap-1">
            {p.tags.map((t) => (
              <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs">
                {t}
              </span>
            ))}
          </div>
        </Field>
      )}

      <Field label="使用 / 上次">
        {p.useCount} 次 /{" "}
        {p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleString("zh-CN") : "从未使用"}
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
        {label}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Badge({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${
        accent ? "bg-accent/10 text-accent" : "bg-muted text-foreground/60"
      }`}
    >
      {children}
    </span>
  );
}
