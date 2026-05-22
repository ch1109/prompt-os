// 批量打包模板：sidebar 顶部「PackagePlus」按钮触发
//
// 让 admin 一次选多个一级场景，聚合 ids 后跳 /admin/templates/new。
// 复用 collectMultiSceneSubtree（与单场景打包出同样的 ids 规则）。
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { X, Loader2, PackagePlus } from "lucide-react";
import { db } from "@/db";
import type { Scenario, TaskPack } from "@/types";
import { collectMultiSceneSubtree } from "@/services/scenePackHelper";
import { toast } from "@/store/toastStore";

interface Props {
  open: boolean;
  onClose: () => void;
  firstLevel: Scenario[];
  allScenarios: Scenario[];
  packsByScene: Map<string, TaskPack[]>;
}

export function BatchPackModal({
  open,
  onClose,
  firstLevel,
  allScenarios,
  packsByScene,
}: Props) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  // 异步统计每个场景下 prompts 数量（按场景标题匹配 primaryScenario[0]）
  // 用 useLiveQuery 跟随数据变化，避免每次打开 Modal 都重新查
  const promptCountRaw = useLiveQuery(async () => {
    const all = await db.prompts.toArray();
    const m = new Map<string, number>();
    for (const p of all) {
      const k = p.primaryScenario?.[0];
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  });
  const promptCountByScene = useMemo(
    () => promptCountRaw ?? new Map<string, number>(),
    [promptCountRaw]
  );

  const total = useMemo(
    () =>
      [...selected].reduce(
        (acc, id) => {
          const scene = firstLevel.find((s) => s.id === id);
          if (!scene) return acc;
          return {
            prompts: acc.prompts + (promptCountByScene.get(scene.title) ?? 0),
            packs: acc.packs + (packsByScene.get(scene.id)?.length ?? 0),
          };
        },
        { prompts: 0, packs: 0 }
      ),
    [selected, firstLevel, packsByScene, promptCountByScene]
  );

  if (!open) return null;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    setSelected(new Set(firstLevel.map((s) => s.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  async function handlePack() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const scenes = firstLevel.filter((s) => selected.has(s.id));
      const ids = await collectMultiSceneSubtree(
        scenes,
        allScenarios,
        packsByScene
      );
      if (
        ids.promptIds.length +
          ids.sceneIds.length +
          ids.taskPackIds.length ===
        0
      ) {
        toast.info("所选场景下没有可打包的内容");
        setBusy(false);
        return;
      }
      const titles = scenes.map((s) => s.title);
      navigate("/admin/templates/new", {
        state: {
          preselected: {
            promptIds: ids.promptIds,
            scenarioIds: ids.sceneIds,
            taskPackIds: ids.taskPackIds,
          },
          suggestedTitle:
            scenes.length === 1
              ? `${titles[0]} · 完整工作包`
              : `${titles.join(" + ")} · 综合包`,
          suggestedAudience: titles.join("、"),
        },
      });
      onClose();
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "打包失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-serif text-[17px] tracking-tight text-ink">
              批量打包为模板
            </h2>
            <p className="mt-0.5 text-[11.5px] text-sub">
              勾选多个一级场景，合并成一个模板
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded p-1 text-hint transition hover:bg-soft hover:text-ink"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {/* toolbar */}
        <div className="flex items-center gap-2 border-b border-line bg-soft/30 px-5 py-2.5 text-xs">
          <button
            onClick={selectAll}
            className="rounded border border-line bg-paper px-2.5 py-1 text-sub transition hover:text-ink"
          >
            全选
          </button>
          <button
            onClick={clearAll}
            className="rounded border border-line bg-paper px-2.5 py-1 text-sub transition hover:text-ink"
          >
            清空
          </button>
          <span className="ml-auto text-hint">
            已选 <span className="mono text-ink">{selected.size}</span> 个场景
            {selected.size > 0 && (
              <>
                {" · "}
                <span className="mono text-ink">{total.prompts}</span> prompts /
                <span className="mono text-ink"> {total.packs}</span> tasks
              </>
            )}
          </span>
        </div>

        {/* scene list */}
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {firstLevel.length === 0 ? (
            <li className="py-12 text-center text-xs text-hint">
              工作区没有任何一级场景
            </li>
          ) : (
            firstLevel.map((s) => {
              const checked = selected.has(s.id);
              const pCount = promptCountByScene.get(s.title) ?? 0;
              const tCount = packsByScene.get(s.id)?.length ?? 0;
              return (
                <li key={s.id}>
                  <label
                    className={`flex cursor-pointer items-center gap-3 px-5 py-2.5 transition hover:bg-soft/40 ${checked ? "bg-moss-soft/30" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(s.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-moss"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-medium text-ink">
                        {s.title}
                      </div>
                    </div>
                    <span className="mono shrink-0 text-[11px] text-hint">
                      {pCount} prompts · {tCount} tasks
                    </span>
                  </label>
                </li>
              );
            })
          )}
        </ul>

        {/* footer */}
        <div className="flex gap-2 border-t border-line bg-canvas/60 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded border border-line bg-paper px-4 py-1.5 text-sm text-sub transition hover:bg-soft"
          >
            取消
          </button>
          <div className="flex-1" />
          <button
            onClick={handlePack}
            disabled={selected.size === 0 || busy}
            className="inline-flex items-center gap-1.5 rounded bg-moss px-4 py-1.5 text-sm font-medium text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <PackagePlus size={13} strokeWidth={1.8} />
            )}
            打包（已选 {selected.size}）
          </button>
        </div>
      </div>
    </div>
  );
}
