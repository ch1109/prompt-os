import { usePrompts } from "@/hooks/usePrompts";
import { useUI } from "@/store/uiStore";
import { PromptCard } from "./PromptCard";

export function PromptList({ onNew }: { onNew: () => void }) {
  const items = usePrompts();
  const { searchQuery, selectedScenarioId, filterTaskTypes, filterDifficulties } = useUI();

  if (!items.length) {
    const isSearch = searchQuery.trim().length > 0;
    const isFilter =
      !!selectedScenarioId || filterTaskTypes.length > 0 || filterDifficulties.length > 0;
    const isFav = selectedScenarioId === "qs:fav";
    const isPending = selectedScenarioId === "qs:pending";

    const { glyph, title, hint, showCta } = (() => {
      if (isSearch)
        return {
          glyph: "无",
          title: `没有匹配「${searchQuery.trim().slice(0, 20)}」的 Prompt`,
          hint: "换个关键词，或切换 AI 模式按意图搜索",
          showCta: false,
        };
      if (isFav)
        return {
          glyph: "★",
          title: "还没有收藏任何 Prompt",
          hint: "在卡片或详情面板点击右上角的星标即可加入收藏",
          showCta: false,
        };
      if (isPending)
        return {
          glyph: "✓",
          title: "暂无待确认的 Prompt",
          hint: "批量导入时低置信度的条目会出现在这里",
          showCta: false,
        };
      if (isFilter)
        return {
          glyph: "空",
          title: "当前筛选下没有 Prompt",
          hint: "尝试清除筛选条件，或切换到其他场景",
          showCta: false,
        };
      return {
        glyph: "空",
        title: "这里还没有 Prompt",
        hint: "点击下方按钮新建第一条，或导入已有内容",
        showCta: true,
      };
    })();

    return (
      <div className="flex min-h-[44vh] flex-col items-center justify-center px-6 py-16 text-center">
        <div className="rounded-2xl border border-line/75 bg-paper/75 px-9 py-8 shadow-[0_18px_44px_-36px_rgb(var(--ink)/0.65)]">
          <div className="mono mb-3 text-[34px] leading-none text-ink/25">{glyph}</div>
          <div className="text-[17px] font-semibold tracking-tight text-ink">{title}</div>
          <div className="mx-auto mt-2 max-w-[360px] text-[14.5px] leading-relaxed text-sub">{hint}</div>
          {showCta && (
            <button
              onClick={onNew}
              className="mt-5 rounded-full bg-moss px-[18px] py-2 text-sm font-semibold text-paper shadow-[0_12px_24px_-18px_rgb(var(--moss)/0.9)] transition hover:bg-moss/90"
            >
              新建 Prompt
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-grid grid items-start gap-[18px] p-4 md:p-5">
      {items.map((p) => (
        <PromptCard key={p.id} p={p} />
      ))}
    </div>
  );
}
