import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, Star, X } from "lucide-react";
import { db } from "@/db";
import { incrementUseCount } from "@/db/repos/promptRepo";
import { MarkdownView } from "@/components/MarkdownView";
import { MountedContextChips } from "@/components/context/MountedContextChips";
import type { Context, Prompt } from "@/types";

interface Props {
  prompt: Prompt;
  onClose: () => void;
}

interface ContextGroup {
  contexts: Context[];
  recommendedIds: Set<string>;
  boundIds: Set<string>;
  defaultIds: Set<string>;
}

/**
 * 把所有上下文分类：
 *   bound：当前 prompt 显式绑定的（最高优先级，自动勾选）
 *   default：用户标记为默认的（自动勾选）
 *   recommended：基于场景路径/标签匹配的相关上下文（不自动勾选，但置顶展示）
 *   其他
 */
function groupContexts(prompt: Prompt, contexts: Context[]): ContextGroup {
  const boundIds = new Set(prompt.boundContextIds ?? []);
  const defaultIds = new Set(contexts.filter((c) => c.isDefault).map((c) => c.id));

  const promptScenarioWords = new Set<string>();
  for (const seg of prompt.primaryScenario ?? []) promptScenarioWords.add(seg);
  for (const sp of prompt.secondaryScenarios ?? [])
    for (const seg of sp ?? []) promptScenarioWords.add(seg);
  for (const t of prompt.tags ?? []) promptScenarioWords.add(t);

  const recommendedIds = new Set<string>();
  for (const c of contexts) {
    if (boundIds.has(c.id) || defaultIds.has(c.id)) continue;
    // 命中规则：context 标签或 type 出现在 prompt 的场景路径/标签集合中
    const hit =
      (c.tags ?? []).some((t) => promptScenarioWords.has(t)) ||
      promptScenarioWords.has(c.type);
    if (hit) recommendedIds.add(c.id);
  }

  return { contexts, recommendedIds, boundIds, defaultIds };
}

export function UsePromptDialog({ prompt, onClose }: Props) {
  const contextsRaw = useLiveQuery(() => db.contexts.toArray());
  // 用 useMemo 稳定引用，避免 useEffect/useMemo 依赖每次都变
  const contexts = useMemo<Context[]>(() => contextsRaw ?? [], [contextsRaw]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const initialized = useRef(false);
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => groupContexts(prompt, contexts), [prompt, contexts]);

  // contexts 由 useLiveQuery 异步返回，首次拿到数据时一次性应用默认勾选
  // 此处合法地在 effect 中同步 setState（响应外部数据加载，与 PromptEditor 一致）
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    if (initialized.current || contexts.length === 0) return;
    initialized.current = true;
    const auto = new Set<string>([...groups.boundIds, ...groups.defaultIds]);
    if (auto.size) setSelectedIds(auto);
  }, [contexts, groups]);

  const selectedContexts = contexts.filter((c) => selectedIds.has(c.id));
  const preview =
    selectedContexts.length > 0
      ? `${selectedContexts.map((c) => c.content).join("\n")}\n\n---\n\n${prompt.body}`
      : prompt.body;

  function toggleContext(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(preview);
    await incrementUseCount(prompt.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // 排序：bound > default > recommended > 其他
  const orderedContexts = useMemo(() => {
    return [...contexts].sort((a, b) => {
      const score = (c: Context) => {
        if (groups.boundIds.has(c.id)) return 0;
        if (groups.defaultIds.has(c.id)) return 1;
        if (groups.recommendedIds.has(c.id)) return 2;
        return 3;
      };
      return score(a) - score(b);
    });
  }, [contexts, groups]);

  function tagsFor(c: Context): { label: string; tone: "bound" | "default" | "rec" } | null {
    if (groups.boundIds.has(c.id)) return { label: "已绑定", tone: "bound" };
    if (groups.defaultIds.has(c.id)) return { label: "默认", tone: "default" };
    if (groups.recommendedIds.has(c.id)) return { label: "推荐", tone: "rec" };
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 md:items-start md:p-4 md:pt-12">
      <div className="flex w-full max-w-2xl flex-col bg-paper shadow-xl md:rounded-xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-medium text-ink">带上下文使用</h2>
          <button onClick={onClose} className="rounded p-1 text-hint hover:bg-soft hover:text-ink" aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-soft/30 px-4 py-2">
          <span className="text-[10px] uppercase tracking-wide text-hint">已挂载</span>
          <MountedContextChips
            prompt={prompt}
            extraSelectedIds={[...selectedIds]}
            editable
            onChange={(ids) => setSelectedIds(new Set(ids))}
          />
        </div>
        <div className="flex max-md:max-h-none max-md:flex-col flex-1 min-h-0 max-h-[70vh]">
          {/* 上下文选择 */}
          <div className="space-y-1 overflow-y-auto border-line p-3 max-md:border-b md:w-56 md:shrink-0 md:border-r md:max-h-none">
            <p className="text-xs text-hint pb-1">选择上下文</p>
            {contexts.length === 0 && (
              <p className="text-xs text-hint">暂无上下文，请先在「上下文」页创建</p>
            )}
            {orderedContexts.map((c) => {
              const tag = tagsFor(c);
              return (
                <label
                  key={c.id}
                  className="flex items-start gap-2 cursor-pointer rounded p-1.5 hover:bg-soft"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleContext(c.id)}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-medium leading-tight truncate">{c.title}</span>
                      {tag && (
                        <span
                          className={`inline-flex items-center gap-0.5 rounded px-1 py-0 text-[9px] font-medium shrink-0 ${
                            tag.tone === "bound"
                              ? "bg-moss text-paper"
                              : tag.tone === "default"
                              ? "bg-amber-soft text-amber"
                              : "bg-soft text-sub"
                          }`}
                        >
                          {tag.tone === "default" && <Star size={8} className="fill-current" />}
                          {tag.tone === "rec" && <Sparkles size={8} />}
                          {tag.label}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-hint">{c.type}</div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* 预览区 */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs text-hint">预览拼接结果</p>
                <p className="text-[10px] text-hint tabular-nums">约 {preview.length} 字</p>
              </div>
              <MarkdownView text={preview} />

            </div>
            <div className="border-t border-line p-3">
              <button
                onClick={handleCopy}
                className="w-full rounded bg-moss py-2 text-sm text-paper hover:bg-moss/90"
              >
                {copied ? "已复制 ✓" : "复制全部"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
