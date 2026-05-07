import { usePrompts } from "@/hooks/usePrompts";
import { PromptCard } from "./PromptCard";

export function PromptList({ onNew }: { onNew: () => void }) {
  const items = usePrompts();

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="text-4xl">✨</div>
        <div className="font-semibold text-foreground">还没有 Prompt</div>
        <div className="text-sm text-foreground/50">点击下方按钮新建第一条，或导入已有内容</div>
        <button
          onClick={onNew}
          className="mt-1 rounded bg-accent px-4 py-1.5 text-sm text-white hover:bg-accent/90"
        >
          新建 Prompt
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((p) => (
        <PromptCard key={p.id} p={p} />
      ))}
    </div>
  );
}
