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
      className={`card-flat group relative cursor-pointer rounded-md p-4 ${
        active ? "border-line bg-paper shadow-[0_1px_2px_rgba(20,20,18,0.06)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="flex-1 text-[15px] font-medium leading-snug tracking-tight text-ink">
          {p.title}
        </h3>
        <div className="flex shrink-0 gap-0.5 [&_button]:rounded [&_button]:p-1 [&_button:hover]:bg-soft">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p.id);
            }}
            title={p.isFavorited ? "取消收藏" : "收藏"}
          >
            <Star
              size={13}
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
              <Check size={13} strokeWidth={2} className="text-moss" />
            ) : (
              <Copy size={13} strokeWidth={1.6} className="text-hint/60 transition-colors group-hover:text-hint hover:!text-moss" />
            )}
          </button>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-sub">
        {p.summary || p.body.slice(0, 120)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="chip chip-task chip-mono uppercase tracking-wider2">{p.taskType}</span>
        <span className="chip chip-mono">{p.difficulty}</span>
        {p.tags.slice(0, 3).map((t) => (
          <span key={t} className="chip">{t}</span>
        ))}
      </div>

      {reason && (
        <div className="mt-3 flex items-start gap-1.5 rounded border-l-2 border-moss/30 bg-moss-soft/60 px-2 py-1.5 text-[12px] leading-relaxed text-moss">
          <Sparkles size={11} className="mt-[3px] shrink-0" />
          <span className="line-clamp-2">{reason}</span>
        </div>
      )}
    </div>
  );
}

export const PromptCard = memo(PromptCardImpl);
