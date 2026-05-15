import { memo, useState } from "react";
import { Copy, Star, Check, Sparkles } from "lucide-react";
import type { Prompt } from "@/types";
import { incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";
import { useUI } from "@/store/uiStore";

function PromptCardImpl({ p }: { p: Prompt }) {
  const setSelectedPrompt = useUI((s) => s.setSelectedPrompt);
  const reason = useUI((s) => s.intentMatch?.prompts.find((h) => h.id === p.id)?.reason);
  const active = useUI((s) => s.selectedPromptId === p.id);
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    await navigator.clipboard.writeText(p.body);
    await incrementUseCount(p.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div
      onClick={() => setSelectedPrompt(p.id)}
      className={`card-flat group relative cursor-pointer overflow-hidden rounded-2xl p-[18px] ${
        active ? "border-moss/[0.35] bg-paper shadow-[0_16px_34px_-26px_rgb(var(--moss)/0.7)] ring-1 ring-moss/[0.15]" : ""
      }`}
    >
      {active && <span className="absolute inset-y-3 left-0 w-[2px] rounded-full bg-moss" />}
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 text-[16px] font-semibold leading-snug tracking-tight text-ink">
          {p.title}
        </h3>
        <div className="flex shrink-0 gap-0.5 [&_button]:rounded-md [&_button]:p-1.5 [&_button]:transition [&_button:hover]:bg-soft">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p.id);
            }}
            title={p.isFavorited ? "取消收藏" : "收藏"}
          >
            <Star
              size={15}
              strokeWidth={1.6}
              className={
                p.isFavorited
                  ? "fill-amber text-amber"
                  : "text-hint/60 transition-colors group-hover:text-hint hover:!text-amber"
              }
            />
          </button>
          <button onClick={handleCopy} title="复制正文">
            {copied ? (
              <Check size={15} strokeWidth={2} className="text-moss" />
            ) : (
              <Copy size={15} strokeWidth={1.6} className="text-hint/60 transition-colors group-hover:text-hint hover:!text-moss" />
            )}
          </button>
        </div>
      </div>

      <p className="mt-2.5 line-clamp-2 min-h-[3.25rem] text-[14px] leading-relaxed text-sub">
        {p.summary || p.body.slice(0, 120)}
      </p>

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
        <span className="chip chip-task chip-mono uppercase tracking-wider2">{p.taskType}</span>
        <span className="chip chip-mono">{p.difficulty}</span>
        {p.tags.slice(0, 3).map((t) => (
          <span key={t} className="chip">{t}</span>
        ))}
      </div>

      {reason && (
        <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-moss/[0.15] bg-moss-soft/70 px-3 py-2.5 text-[13px] leading-relaxed text-moss">
          <Sparkles size={13} className="mt-[3px] shrink-0" />
          <span className="line-clamp-2">{reason}</span>
        </div>
      )}
    </div>
  );
}

export const PromptCard = memo(PromptCardImpl);
