import { useState } from "react";
import { Copy, Star, Check } from "lucide-react";
import type { Prompt } from "@/types";
import { incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";
import { useUI } from "@/store/uiStore";

export function PromptCard({ p }: { p: Prompt }) {
  const { setSelectedPrompt } = useUI();
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
      className="cursor-pointer rounded-lg border border-border p-3 transition hover:-translate-y-px hover:border-accent/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 font-medium leading-tight text-foreground">{p.title}</div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(p.id);
            }}
            title={p.isFavorited ? "取消收藏" : "收藏"}
          >
            <Star
              size={15}
              className={
                p.isFavorited ? "fill-yellow-400 text-yellow-400" : "text-foreground/30 hover:text-yellow-400"
              }
            />
          </button>
          <button onClick={handleCopy} title="复制正文">
            {copied ? (
              <Check size={15} className="text-green-500" />
            ) : (
              <Copy size={15} className="text-foreground/30 hover:text-accent" />
            )}
          </button>
        </div>
      </div>

      <p className="mt-1.5 line-clamp-2 text-sm text-foreground/60">
        {p.summary || p.body.slice(0, 90)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-accent/10 px-1.5 py-0.5 text-xs font-medium text-accent">
          {p.taskType}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/50">
          {p.difficulty}
        </span>
        {p.tags.slice(0, 3).map((t) => (
          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/50">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
