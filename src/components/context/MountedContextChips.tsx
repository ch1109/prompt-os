import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, X } from "lucide-react";
import { db } from "@/db";
import { getTriggerStrategy } from "@/db/repos/contextRepo";
import type { Context, Prompt } from "@/types";

type Tone = "bound" | "always" | "scene" | "manual" | "conditional";

interface ChipInfo {
  context: Context;
  tone: Tone;
  toneLabel: string;
}

/**
 * 计算"如果现在调用该 Prompt，会附加哪些上下文"。
 * tone 含义：
 *  - bound：Prompt 显式 boundContextIds
 *  - always：triggerStrategy=always 且 scope=global
 *  - scene：scope=scene_category/sub_scene 且命中 prompt.primaryScenario / secondaryScenarios
 *  - conditional：策略为 conditional 且命中标签/关键词
 *  - manual：选择性手动添加（extra）
 *
 * 纯函数 export 用于单元测试（与同文件组件共存，关闭 fast-refresh 限制）。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function computeMounted(
  prompt: Prompt,
  contexts: Context[],
  extraIds: Set<string>
): ChipInfo[] {
  const boundIds = new Set(prompt.boundContextIds ?? []);
  const scenePool = new Set<string>();
  for (const seg of prompt.primaryScenario ?? []) scenePool.add(seg);
  for (const sp of prompt.secondaryScenarios ?? [])
    for (const seg of sp ?? []) scenePool.add(seg);
  const tagPool = new Set(prompt.tags ?? []);
  const text = `${prompt.title}\n${prompt.body}`.toLowerCase();

  const result: ChipInfo[] = [];
  const seen = new Set<string>();

  function push(c: Context, tone: Tone, label: string) {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    result.push({ context: c, tone, toneLabel: label });
  }

  // 1. 显式绑定
  for (const c of contexts) {
    if (boundIds.has(c.id)) push(c, "bound", "已绑定");
  }

  // 2. 用户额外手动添加
  for (const c of contexts) {
    if (extraIds.has(c.id) && !seen.has(c.id)) push(c, "manual", "手动添加");
  }

  // 3. 全局始终启用 / 作用域命中 / 条件命中
  for (const c of contexts) {
    if (seen.has(c.id)) continue;
    if (!(c.enabled ?? true)) continue;
    const strategy = getTriggerStrategy(c);
    const scope = c.scope ?? "global";

    if (strategy === "always" && scope === "global") {
      push(c, "always", "始终");
      continue;
    }

    if (scope === "scene_category" || scope === "sub_scene") {
      const refIds =
        scope === "scene_category"
          ? c.scopeRefs?.scenarioIds ?? []
          : c.scopeRefs?.subScenarioIds ?? [];
      const hit = refIds.some((id) => scenePool.has(id));
      // scope 命中后，strategy=always 即附加；manual/conditional 不强制附加
      if (hit && strategy === "always") push(c, "scene", "作用域");
      continue;
    }

    if (strategy === "conditional") {
      const cond = c.triggerConditions;
      if (!cond) continue;
      const tagHit = (cond.promptTags ?? []).some((t) => tagPool.has(t));
      const kwHit = (cond.keywords ?? []).some((k) =>
        text.includes(k.toLowerCase())
      );
      const sceneHit = (cond.scenarioIds ?? []).some((id) => scenePool.has(id));
      const subSceneHit = (cond.subScenarioIds ?? []).some((id) =>
        scenePool.has(id)
      );
      if (tagHit || kwHit || sceneHit || subSceneHit) {
        push(c, "conditional", "条件");
      }
    }
  }

  return result;
}

const TONE_CLASS: Record<Tone, string> = {
  bound: "border-moss/40 bg-moss text-paper",
  always: "border-moss/30 bg-moss-soft text-moss",
  scene: "border-line bg-soft text-sub",
  conditional: "border-amber/30 bg-amber-soft text-amber",
  manual: "border-line bg-paper text-ink",
};

interface Props {
  prompt: Prompt;
  /** 额外选中（manual 手动添加），可选 */
  extraSelectedIds?: string[];
  /** 是否允许在 UI 上增删（false 表示只读） */
  editable?: boolean;
  /** editable=true 时回调最终选中集合 */
  onChange?: (ids: string[]) => void;
}

export function MountedContextChips({
  prompt,
  extraSelectedIds,
  editable = false,
  onChange,
}: Props) {
  const contexts = useLiveQuery(() => db.contexts.toArray(), [], [] as Context[]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [showAdder, setShowAdder] = useState(false);

  const extra = useMemo(
    () => new Set(extraSelectedIds ?? []),
    [extraSelectedIds]
  );

  const mounted = useMemo(
    () => computeMounted(prompt, contexts, extra),
    [prompt, contexts, extra]
  );
  const visible = mounted.filter((m) => !removedIds.has(m.context.id));

  // addable = 所有未当前展示的 context（既包含从未挂载的，也包含被用户 × 临时移除的，方便找回）
  const visibleIdSet = useMemo(
    () => new Set(visible.map((v) => v.context.id)),
    [visible]
  );
  const addable = useMemo(
    () => contexts.filter((c) => !visibleIdSet.has(c.id)),
    [contexts, visibleIdSet]
  );

  function fireChange(nextRemoved: Set<string>, addId?: string) {
    if (!onChange) return;
    const next = new Set([...(extraSelectedIds ?? [])]);
    if (addId) next.add(addId);
    const finalIds: string[] = [];
    for (const m of mounted) {
      if (nextRemoved.has(m.context.id)) continue;
      finalIds.push(m.context.id);
    }
    for (const id of next) if (!nextRemoved.has(id)) finalIds.push(id);
    onChange(Array.from(new Set(finalIds)));
  }

  if (mounted.length === 0 && !editable) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.length === 0 && (
        <span className="text-[11px] italic text-hint">无上下文</span>
      )}
      {visible.map(({ context: c, tone, toneLabel }) => (
        <span
          key={c.id}
          title={`${c.type} · ${toneLabel}`}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${TONE_CLASS[tone]}`}
        >
          <span className="max-w-[140px] truncate">{c.title}</span>
          <span className="text-[9px] opacity-70">· {toneLabel}</span>
          {editable && (
            <button
              type="button"
              onClick={() => {
                const next = new Set(removedIds);
                next.add(c.id);
                setRemovedIds(next);
                fireChange(next);
              }}
              className="hover:opacity-80"
              aria-label={`取消 ${c.title}`}
            >
              <X size={10} strokeWidth={2.2} />
            </button>
          )}
        </span>
      ))}
      {editable && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdder((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-line bg-paper px-1.5 py-0.5 text-[11px] text-sub hover:border-moss/40 hover:text-ink"
          >
            <Plus size={10} strokeWidth={2.2} />
            添加上下文
          </button>
          {showAdder && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-56 w-60 overflow-y-auto rounded-md border border-line bg-paper shadow-lg">
              {addable.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] text-hint">没有可添加的上下文</p>
              ) : (
                addable.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      fireChange(removedIds, c.id);
                      // 把它从 removedIds 中清掉（如果之前因为某些原因被排除）
                      const r = new Set(removedIds);
                      r.delete(c.id);
                      setRemovedIds(r);
                      setShowAdder(false);
                    }}
                    className="block w-full px-2.5 py-1.5 text-left text-[12px] text-ink hover:bg-soft"
                  >
                    <div className="truncate">{c.title}</div>
                    <div className="text-[10px] text-hint">{c.type}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
