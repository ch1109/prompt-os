import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import type { IntentHit } from "@/services/searcher";
import type { Context, Scenario } from "@/types";

/**
 * AI 智能推荐结果面板：在 Prompt 库主区域顶部展示场景/上下文推荐 + 下一步建议。
 * 仅在 uiStore.intentMatch 非空时渲染。Prompt 列表本身依赖 intentResultIds 已排序。
 */
export function IntentResultPanel() {
  const navigate = useNavigate();
  const { intentMatch, setIntentMatch, setIntentResultIds, setSelectedScenario } = useUI();

  const scenarioIds = intentMatch?.scenarios.map((s) => s.id) ?? [];
  const contextIds = intentMatch?.contexts.map((c) => c.id) ?? [];

  const scenarios = useLiveQuery<(Scenario | undefined)[]>(
    async () => (scenarioIds.length ? db.scenarios.bulkGet(scenarioIds) : []),
    [scenarioIds.join(",")]
  ) ?? [];

  const contexts = useLiveQuery<(Context | undefined)[]>(
    async () => (contextIds.length ? db.contexts.bulkGet(contextIds) : []),
    [contextIds.join(",")]
  ) ?? [];

  if (!intentMatch) return null;

  const hasAny =
    intentMatch.prompts.length > 0 ||
    intentMatch.scenarios.length > 0 ||
    intentMatch.contexts.length > 0;

  if (!hasAny && !intentMatch.nextStep) return null;

  function close() {
    setIntentMatch(null);
    setIntentResultIds(null);
  }

  function reasonOf(list: IntentHit[], id: string) {
    return list.find((h) => h.id === id)?.reason ?? "";
  }

  function gotoScenario(id: string) {
    setSelectedScenario(id);
    useUI.getState().setSceneCategoryExpanded(id, true);
    navigate("/");
  }

  function gotoContext(id: string) {
    navigate("/");
    useUI.getState().openContextEditor(id);
  }

  return (
    <div className="border-b border-accent/20 bg-accent/[0.04] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
          <Sparkles size={12} /> AI 推荐
        </div>
        <button
          onClick={close}
          className="text-foreground/40 hover:text-foreground"
          title="关闭推荐"
        >
          <X size={13} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scenarios.length > 0 && (
          <Group title={`场景 (${scenarios.filter(Boolean).length})`}>
            {scenarios.filter(Boolean).map((s) => (
              <Card
                key={s!.id}
                title={s!.fullPath.join(" / ")}
                reason={reasonOf(intentMatch.scenarios, s!.id)}
                onClick={() => gotoScenario(s!.id)}
              />
            ))}
          </Group>
        )}

        {contexts.length > 0 && (
          <Group title={`上下文 (${contexts.filter(Boolean).length})`}>
            {contexts.filter(Boolean).map((c) => (
              <Card
                key={c!.id}
                title={c!.title}
                reason={reasonOf(intentMatch.contexts, c!.id)}
                onClick={() => gotoContext(c!.id)}
                hint={c!.type}
              />
            ))}
          </Group>
        )}
      </div>

      {intentMatch.nextStep && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-accent/15 bg-background/60 px-3 py-2 text-xs">
          <ArrowRight size={12} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <span className="font-medium text-foreground/70">下一步：</span>
            <span className="text-foreground/70">{intentMatch.nextStep}</span>
          </div>
        </div>
      )}

      {intentMatch.prompts.length > 0 && (
        <p className="mt-2 text-[11px] text-foreground/45">
          下方列表已按 AI 相关度排序展示 {intentMatch.prompts.length} 条 Prompt 推荐。
        </p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-foreground/45">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Card({
  title,
  reason,
  onClick,
  hint,
}: {
  title: string;
  reason: string;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-left transition hover:border-accent/40 hover:shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium leading-snug line-clamp-1">{title}</span>
        {hint && (
          <span className="shrink-0 text-[10px] text-foreground/40">{hint}</span>
        )}
      </div>
      {reason && (
        <p className="mt-0.5 text-[11px] text-foreground/55 line-clamp-2">{reason}</p>
      )}
    </button>
  );
}
