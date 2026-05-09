import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, ChevronRight, Clock, Plus, Search, Star, X } from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { useScenarios } from "@/hooks/useScenarios";
import { createScenario } from "@/db/repos/scenarioRepo";
import { toast } from "@/store/toastStore";
import type { Scenario, TaskPack } from "@/types";
import { ContextSection } from "./ContextSection";

type FilterMode = "all" | "favorites" | "recent";

export function WorkbenchSidebar() {
  const {
    selectedTaskPackId,
    setSelectedTaskPack,
    expandedSceneCategoryIds,
    toggleSceneCategoryExpanded,
    setSceneCategoryExpanded,
    beginCreateTaskPack,
  } = useUI();

  const allScenarios = useScenarios();
  const taskPacksRaw = useLiveQuery(() => db.taskPacks.toArray());
  const taskPacks = useMemo(() => taskPacksRaw ?? [], [taskPacksRaw]);

  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const firstLevel = useMemo(
    () => allScenarios.filter((s) => s.level === 1),
    [allScenarios]
  );

  // 选中子场景后自动展开其父场景
  useEffect(() => {
    if (!selectedTaskPackId) return;
    const pack = taskPacks.find((p) => p.id === selectedTaskPackId);
    if (pack && !expandedSceneCategoryIds[pack.sceneCategoryId]) {
      setSceneCategoryExpanded(pack.sceneCategoryId, true);
    }
  }, [
    selectedTaskPackId,
    taskPacks,
    expandedSceneCategoryIds,
    setSceneCategoryExpanded,
  ]);

  const packsByScene = useMemo(() => {
    const m = new Map<string, TaskPack[]>();
    for (const p of taskPacks) {
      const arr = m.get(p.sceneCategoryId) ?? [];
      arr.push(p);
      m.set(p.sceneCategoryId, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    }
    return m;
  }, [taskPacks]);

  const filteredPacks = useMemo(() => {
    let list = taskPacks;
    if (filterMode === "favorites") list = list.filter((p) => p.isFavorited);
    if (filterMode === "recent")
      list = list.filter((p) => p.lastUsedAt != null);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.goal?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    return new Set(list.map((p) => p.id));
  }, [taskPacks, filterMode, query]);

  useEffect(() => {
    if (!query.trim() && filterMode === "all") return;
    const sceneIdsToExpand = new Set<string>();
    for (const p of taskPacks) {
      if (filteredPacks.has(p.id)) sceneIdsToExpand.add(p.sceneCategoryId);
    }
    for (const id of sceneIdsToExpand) {
      if (!expandedSceneCategoryIds[id]) {
        setSceneCategoryExpanded(id, true);
      }
    }
  }, [
    query,
    filterMode,
    filteredPacks,
    taskPacks,
    expandedSceneCategoryIds,
    setSceneCategoryExpanded,
  ]);

  const noActiveFilter = !query.trim() && filterMode === "all";

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b border-line px-3 py-3">
        <div className="flex items-center gap-2 rounded border border-line bg-paper px-2.5 py-1.5">
          <Search size={13} strokeWidth={1.7} className="shrink-0 text-hint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索场景、子场景、Prompt"
            className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-hint"
          />
        </div>
        <div className="flex gap-1">
          <FilterChip
            active={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            label="全部"
          />
          <FilterChip
            active={filterMode === "favorites"}
            onClick={() => setFilterMode("favorites")}
            icon={<Star size={10} strokeWidth={2} />}
            label="收藏"
          />
          <FilterChip
            active={filterMode === "recent"}
            onClick={() => setFilterMode("recent")}
            icon={<Clock size={10} strokeWidth={1.8} />}
            label="最近"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 py-2">
        {firstLevel.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-hint">
            暂无场景，去下方「+ 新增场景大类」创建第一个
          </div>
        ) : (
          <ul className="space-y-px">
            {firstLevel.map((scene) => {
              const all = packsByScene.get(scene.id) ?? [];
              const visible = noActiveFilter
                ? all
                : all.filter((p) => filteredPacks.has(p.id));
              const expanded = !!expandedSceneCategoryIds[scene.id];
              const total = all.length;

              if (!noActiveFilter && visible.length === 0) return null;

              return (
                <li key={scene.id}>
                  <SceneRow
                    scene={scene}
                    expanded={expanded}
                    total={total}
                    onToggle={() => toggleSceneCategoryExpanded(scene.id)}
                    onAdd={() => beginCreateTaskPack(scene.id)}
                  />
                  {expanded && (
                    <ul className="mb-1.5 space-y-px pl-7 pr-1">
                      {visible.length === 0 ? (
                        <li>
                          <button
                            onClick={() => beginCreateTaskPack(scene.id)}
                            className="w-full rounded px-2 py-1 text-left text-[12px] italic text-hint transition hover:bg-soft hover:text-moss"
                          >
                            该场景下还没有子场景，点击新建
                          </button>
                        </li>
                      ) : (
                        visible.map((pack) => (
                          <PackRow
                            key={pack.id}
                            pack={pack}
                            active={selectedTaskPackId === pack.id}
                            onSelect={() => setSelectedTaskPack(pack.id)}
                          />
                        ))
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ContextSection />

      <div className="border-t border-line p-2.5">
        <NewSceneRow
          onCreated={(scene) => {
            setSceneCategoryExpanded(scene.id, true);
            // 创建场景后立即引导用户建第一个子场景
            beginCreateTaskPack(scene.id);
          }}
        />
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-moss text-paper"
          : "bg-soft text-sub hover:bg-soft/80 hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function SceneRow({
  scene,
  expanded,
  total,
  onToggle,
  onAdd,
}: {
  scene: Scenario;
  expanded: boolean;
  total: number;
  onToggle: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="group flex items-center rounded text-[13px] text-sub hover:bg-soft/60 hover:text-ink">
      <button
        onClick={onToggle}
        className="flex flex-1 items-center gap-1 px-1.5 py-[6px] text-left"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`shrink-0 text-hint transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <span className="flex-1 truncate text-[13.5px] font-semibold tracking-tight">
          {scene.title}
        </span>
        {total > 0 && (
          <span className="mr-1 text-[11px] tabular-nums text-hint">
            {total}
          </span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        title={`在「${scene.title}」下新建子场景`}
        aria-label={`在「${scene.title}」下新建子场景`}
        className="mr-1 rounded p-1 text-hint/70 transition hover:bg-paper hover:text-moss"
      >
        <Plus size={12} strokeWidth={1.8} />
      </button>
    </div>
  );
}

function PackRow({
  pack,
  active,
  onSelect,
}: {
  pack: TaskPack;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={`group relative flex w-full items-center gap-1.5 rounded px-2 py-[5px] text-left text-[13px] transition-colors ${
          active
            ? "bg-soft font-medium text-ink"
            : "text-sub hover:bg-soft/60 hover:text-ink"
        }`}
      >
        {active && (
          <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-moss" />
        )}
        <span className="text-hint">·</span>
        <span className="flex-1 truncate">
          {pack.title || (
            <span className="italic text-hint">未命名子场景</span>
          )}
        </span>
        {pack.isFavorited && (
          <Star size={10} strokeWidth={2} className="shrink-0 fill-amber text-amber" />
        )}
      </button>
    </li>
  );
}

function NewSceneRow({ onCreated }: { onCreated: (scene: Scenario) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function commit() {
    const title = draft.trim();
    if (!title) {
      cancel();
      return;
    }
    try {
      const scene = await createScenario({
        title,
        level: 1,
        parentId: null,
        fullPath: [title],
      });
      setDraft("");
      setEditing(false);
      toast.success(`已新建场景「${title}」`);
      onCreated(scene);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    }
  }

  function cancel() {
    setDraft("");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-line py-2 text-[12.5px] font-medium text-moss/80 transition hover:border-moss/60 hover:bg-soft hover:text-moss"
      >
        <Plus size={12} strokeWidth={1.8} /> 新增场景大类
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded border border-dashed border-moss/60 bg-paper px-2 py-1">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        placeholder="场景大类名称"
        className="flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-hint"
      />
      <button
        onClick={commit}
        className="rounded p-1 text-moss hover:bg-moss-soft"
        title="确认 (Enter)"
      >
        <Check size={12} strokeWidth={2} />
      </button>
      <button
        onClick={cancel}
        className="rounded p-1 text-hint hover:bg-soft hover:text-ink"
        title="取消 (Esc)"
      >
        <X size={12} strokeWidth={1.8} />
      </button>
    </div>
  );
}
