import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { getTriggerStrategy } from "@/db/repos/contextRepo";
import type { Context } from "@/types";

interface Props {
  /** 一级场景 id（TaskPack.sceneCategoryId） */
  sceneCategoryId: string;
  /** 当前 TaskPack 自身的 scenario id（若就是一级场景，则等于 sceneCategoryId） */
  scenarioId?: string;
}

const STRATEGY_LABEL: Record<string, string> = {
  always: "始终",
  manual: "手动",
  conditional: "条件",
};

/** 找出在当前场景下「会被默认附加」的上下文：
 *  - triggerStrategy === "always" 且 scope === "global"
 *  - scope === "scene_category" 且 scopeRefs.scenarioIds 包含 sceneCategoryId
 *  - scope === "sub_scene" 且 scopeRefs.subScenarioIds 包含 scenarioId
 *  - 场景 recommendedContexts 中显式列出的上下文（无论 strategy）
 *
 * 纯函数 export 用于单元测试（与同文件组件共存，关闭 fast-refresh 限制）。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function pickSceneContexts(
  contexts: Context[],
  recommendedIds: string[] | undefined,
  sceneCategoryId: string,
  scenarioId: string | undefined
): Context[] {
  const recSet = new Set(recommendedIds ?? []);
  return contexts.filter((c) => {
    // recommendedContexts 显式列出的优先命中，无视 strategy 与 enabled
    if (recSet.has(c.id)) return true;
    const enabled = c.enabled ?? true;
    if (!enabled) return false;
    // "本场景默认"= 自动附加，仅 strategy=always 计入；
    // manual/conditional 不属于"默认"，与 computeMounted 保持一致
    const strategy = getTriggerStrategy(c);
    if (strategy !== "always") return false;
    const scope = c.scope ?? "global";
    if (scope === "global") return true;
    if (scope === "scene_category")
      return c.scopeRefs?.scenarioIds?.includes(sceneCategoryId) ?? false;
    if (scope === "sub_scene")
      return scenarioId
        ? c.scopeRefs?.subScenarioIds?.includes(scenarioId) ?? false
        : false;
    return false;
  });
}

export function SceneDefaultContextPanel({ sceneCategoryId, scenarioId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const openEditor = useUI((s) => s.openContextEditor);

  const contexts = useLiveQuery(() => db.contexts.toArray(), [], [] as Context[]);
  const sceneIdForLookup = scenarioId ?? sceneCategoryId;
  const scene = useLiveQuery(
    () => db.scenarios.get(sceneIdForLookup),
    [sceneIdForLookup]
  );

  const matched = useMemo(
    () =>
      pickSceneContexts(
        contexts,
        scene?.recommendedContexts,
        sceneCategoryId,
        scenarioId
      ),
    [contexts, scene?.recommendedContexts, sceneCategoryId, scenarioId]
  );

  return (
    <section className="mb-4 rounded-lg border border-line bg-paper/60">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded ? (
          <ChevronDown size={13} className="text-hint" />
        ) : (
          <ChevronRight size={13} className="text-hint" />
        )}
        <Layers size={13} className="text-moss" />
        <span className="text-sm font-medium text-ink">本场景默认上下文</span>
        <span className="mono text-[11px] tabular-nums text-hint">
          {matched.length}
        </span>
        {matched.length === 0 && (
          <span className="text-[11px] text-hint">暂无</span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-line px-3 py-2">
          {matched.length === 0 ? (
            <p className="text-[12px] text-hint">
              没有命中本场景的上下文。在「上下文库」中将作用域设为本场景或开启始终启用，可在此自动出现。
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {matched.map((c) => {
                const strategy = getTriggerStrategy(c);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openEditor(c.id)}
                      title={`${c.type} · 点击查看/编辑`}
                      className="group inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-[12px] text-ink hover:border-moss/50 hover:bg-soft"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          (c.enabled ?? true) ? "bg-moss" : "bg-hint"
                        }`}
                        aria-hidden
                      />
                      <span className="max-w-[180px] truncate">{c.title}</span>
                      <span className="text-[10px] text-hint">· {c.type}</span>
                      <span
                        className={`rounded px-1 py-0 text-[10px] ${
                          strategy === "always"
                            ? "bg-moss-soft text-moss"
                            : strategy === "conditional"
                            ? "bg-amber-soft text-amber"
                            : "bg-soft text-hint"
                        }`}
                      >
                        {STRATEGY_LABEL[strategy]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
