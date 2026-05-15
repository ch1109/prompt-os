import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import type { IntentHit } from "@/services/searcher";
import type { Context, Scenario } from "@/types";

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

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

  const visibleScenarios = scenarios.filter(isDefined);
  const visibleContexts = contexts.filter(isDefined);

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
    <div className="border-b border-moss/15 bg-moss-soft/35 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-moss">
          <Sparkles size={12} /> AI 推荐
        </div>
        <button
          onClick={close}
          className="rounded-md p-1 text-hint transition hover:bg-paper/70 hover:text-ink"
          title="关闭推荐"
        >
          <X size={13} />
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {scenarios.length > 0 && (
          <Group title={`场景 (${visibleScenarios.length})`}>
            {visibleScenarios.map((s) => (
              <Card
                key={s.id}
                title={s.fullPath.join(" / ")}
                reason={reasonOf(intentMatch.scenarios, s.id)}
                onClick={() => gotoScenario(s.id)}
              />
            ))}
          </Group>
        )}

        {contexts.length > 0 && (
          <Group title={`上下文 (${visibleContexts.length})`}>
            {visibleContexts.map((c) => (
              <Card
                key={c.id}
                title={c.title}
                reason={reasonOf(intentMatch.contexts, c.id)}
                onClick={() => gotoContext(c.id)}
                hint={c.type}
              />
            ))}
          </Group>
        )}
      </div>

      {intentMatch.nextStep && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-moss/15 bg-paper/65 px-3 py-2 text-xs shadow-[inset_0_1px_0_rgb(var(--paper)/0.75)]">
          <ArrowRight size={12} className="mt-0.5 shrink-0 text-moss" />
          <div>
            <span className="font-semibold text-ink/80">下一步：</span>
            <span className="text-sub">{intentMatch.nextStep}</span>
          </div>
        </div>
      )}

      {intentMatch.prompts.length > 0 && (
        <p className="mt-2 text-[11px] text-hint">
          下方列表已按 AI 相关度排序展示 {intentMatch.prompts.length} 条 Prompt 推荐。
        </p>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="mono text-[10.5px] font-semibold uppercase tracking-wider2 text-hint">
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
      className="block w-full rounded-lg border border-line/75 bg-paper/75 px-2.5 py-2 text-left transition hover:border-moss/25 hover:bg-paper hover:shadow-[0_12px_24px_-22px_rgb(var(--ink)/0.55)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="line-clamp-1 text-xs font-semibold leading-snug text-ink">{title}</span>
        {hint && (
          <span className="shrink-0 text-[10px] text-hint">{hint}</span>
        )}
      </div>
      {reason && (
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-sub">{reason}</p>
      )}
    </button>
  );
}
