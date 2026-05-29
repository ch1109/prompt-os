import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Check,
  ChevronRight,
  Clock,
  PackagePlus,
  Plus,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { useScenarios } from "@/hooks/useScenarios";
import { useAdminSession } from "@/admin/useAdminSession";
import { scoreTaskPack } from "@/services/keywordMatch";
import { collectSceneSubtree } from "@/services/scenePackHelper";
import {
  createScenario,
  deleteScenarioCascade,
  renameScenario,
  reorderSiblings,
} from "@/db/repos/scenarioRepo";
import { deleteTaskPack, reorderTaskPacks } from "@/db/repos/taskPackRepo";
import { confirm } from "@/store/confirmStore";
import { toast } from "@/store/toastStore";
import type { Scenario, TaskPack } from "@/types";
import { ContextSection } from "./ContextSection";
import { BatchPackModal } from "./BatchPackModal";
import {
  DropIndicator,
  InlineEdit,
  NodeMenuButton,
  type DropEdge,
} from "@/components/sidebar/scenarioControls";

type FilterMode = "all" | "favorites" | "recent";

export function WorkbenchSidebar() {
  const navigate = useNavigate();
  const { isAdmin } = useAdminSession();
  const {
    selectedTaskPackId,
    setSelectedTaskPack,
    setSelectedPrompt,
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
  const [batchOpen, setBatchOpen] = useState(false);

  const firstLevel = useMemo(
    () =>
      [...allScenarios.filter((s) => s.level === 1)].sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.title.localeCompare(b.title, "zh");
      }),
    [allScenarios]
  );

  // 编辑/菜单/拖拽态局部管理(只针对一级场景)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: DropEdge } | null>(null);

  // 子场景(TaskPack)拖拽态，独立于一级场景，避免互相干扰
  const [draggingPackId, setDraggingPackId] = useState<string | null>(null);
  const [packDropTarget, setPackDropTarget] = useState<{ id: string; edge: DropEdge } | null>(null);

  async function handleSceneRename(id: string, nextTitle: string) {
    const scn = firstLevel.find((s) => s.id === id);
    if (!scn) return setEditingId(null);
    if (!nextTitle.trim() || nextTitle.trim() === scn.title) {
      setEditingId(null);
      return;
    }
    try {
      const { touchedPrompts } = await renameScenario(id, nextTitle);
      toast.success(
        touchedPrompts > 0
          ? `已重命名,并联动更新 ${touchedPrompts} 条 Prompt`
          : "已重命名"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重命名失败");
    }
    setEditingId(null);
  }

  async function handleSceneDrop(targetId: string, edge: DropEdge) {
    setDropTarget(null);
    if (!draggingId || draggingId === targetId) return;
    const source = firstLevel.find((s) => s.id === draggingId);
    const target = firstLevel.find((s) => s.id === targetId);
    setDraggingId(null);
    if (!source || !target) return;
    const without = firstLevel.filter((s) => s.id !== source.id);
    const targetIdx = without.findIndex((s) => s.id === target.id);
    if (targetIdx === -1) return;
    const insertAt = edge === "before" ? targetIdx : targetIdx + 1;
    const reordered = [...without.slice(0, insertAt), source, ...without.slice(insertAt)];
    await reorderSiblings(reordered.map((s) => s.id));
  }

  async function handleSceneDelete(scene: Scenario) {
    const childPacks = (packsByScene.get(scene.id) ?? []).length;
    const childScenes = allScenarios.filter(
      (s) => s.id !== scene.id && s.fullPath?.[0] === scene.title
    ).length;
    const detail = [
      childPacks > 0 ? `${childPacks} 个子场景` : "",
      childScenes > 0 ? `${childScenes} 个子级目录` : "",
      "归属此场景的所有 Prompt",
    ]
      .filter(Boolean)
      .join("、");
    const ok = await confirm({
      title: `删除「${scene.title}」?`,
      message: `将一并删除 ${detail}。此操作不可撤销。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await deleteScenarioCascade(scene.id);
      const selectedPack = taskPacks.find((p) => p.id === selectedTaskPackId);
      if (selectedPack && selectedPack.sceneCategoryId === scene.id) {
        setSelectedTaskPack(null);
        setSelectedPrompt(null);
      }
      const parts = [
        r.removedTaskPacks > 0 ? `${r.removedTaskPacks} 子场景` : null,
        r.removedPrompts > 0 ? `${r.removedPrompts} Prompt` : null,
        r.touchedSecondary > 0 ? `调整 ${r.touchedSecondary} 处副归属` : null,
      ].filter(Boolean);
      toast.success(
        parts.length
          ? `已删除「${scene.title}」（清理 ${parts.join(" / ")}）`
          : `已删除「${scene.title}」`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  async function handlePackToTemplate(scene: Scenario) {
    const ids = await collectSceneSubtree(scene, allScenarios, packsByScene);
    if (
      ids.promptIds.length + ids.sceneIds.length + ids.taskPackIds.length ===
      0
    ) {
      toast.info(`「${scene.title}」下没有可打包的内容`);
      return;
    }
    navigate("/admin/templates/new", {
      state: {
        preselected: {
          promptIds: ids.promptIds,
          scenarioIds: ids.sceneIds,
          taskPackIds: ids.taskPackIds,
        },
        suggestedTitle: `${scene.title} · 完整工作包`,
        suggestedAudience: scene.title,
      },
    });
  }

  async function handleSceneMove(id: string, delta: -1 | 1) {
    const idx = firstLevel.findIndex((s) => s.id === id);
    const target = idx + delta;
    if (idx === -1 || target < 0 || target >= firstLevel.length) return;
    const reordered = [...firstLevel];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    await reorderSiblings(reordered.map((s) => s.id));
  }

  // 选中 TaskPack 的父场景首次出现时自动展开一次；之后无论用户在同父场景内切兄弟 pack、
  // 经 null 切回同一 pack、还是手动收起，都不再覆盖——ref 记忆"已自动展开的 sceneCategoryId"，
  // 切到不同父场景时才再次自动展开。
  // DO NOT 把 expandedSceneCategoryIds 加回依赖：会与用户手动收起形成 effect 自循环。
  const autoExpandedForSceneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedTaskPackId) return;
    const pack = taskPacks.find((p) => p.id === selectedTaskPackId);
    if (!pack) return;
    if (autoExpandedForSceneRef.current === pack.sceneCategoryId) return;
    setSceneCategoryExpanded(pack.sceneCategoryId, true);
    autoExpandedForSceneRef.current = pack.sceneCategoryId;
  }, [selectedTaskPackId, taskPacks, setSceneCategoryExpanded]);

  const packsByScene = useMemo(() => {
    const m = new Map<string, TaskPack[]>();
    for (const p of taskPacks) {
      const arr = m.get(p.sceneCategoryId) ?? [];
      arr.push(p);
      m.set(p.sceneCategoryId, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const ao = a.order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.title.localeCompare(b.title, "zh");
      });
    }
    return m;
  }, [taskPacks]);

  async function handlePackDelete(pack: TaskPack) {
    const ok = await confirm({
      title: "删除子场景？",
      message: `「${pack.title || "未命名子场景"}」会被删除，但其引用的 Prompt 不会被删除。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await deleteTaskPack(pack.id);
    if (selectedTaskPackId === pack.id) {
      setSelectedTaskPack(null);
      setSelectedPrompt(null);
    }
    toast.success("已删除子场景");
  }

  async function handlePackDrop(targetId: string, edge: DropEdge) {
    setPackDropTarget(null);
    if (!draggingPackId || draggingPackId === targetId) return;
    const source = taskPacks.find((p) => p.id === draggingPackId);
    const target = taskPacks.find((p) => p.id === targetId);
    setDraggingPackId(null);
    if (!source || !target) return;
    if (source.sceneCategoryId !== target.sceneCategoryId) {
      toast.info("只能在同一场景内调整顺序");
      return;
    }
    const siblings = packsByScene.get(target.sceneCategoryId) ?? [];
    const without = siblings.filter((p) => p.id !== source.id);
    const targetIdx = without.findIndex((p) => p.id === target.id);
    if (targetIdx === -1) return;
    const insertAt = edge === "before" ? targetIdx : targetIdx + 1;
    const reordered = [...without.slice(0, insertAt), source, ...without.slice(insertAt)];
    await reorderTaskPacks(reordered.map((p) => p.id));
  }

  const filteredPacks = useMemo(() => {
    let list = taskPacks;
    if (filterMode === "favorites") list = list.filter((p) => p.isFavorited);
    if (filterMode === "recent")
      list = list.filter((p) => p.lastUsedAt != null);
    if (query.trim()) {
      list = list.filter((p) => scoreTaskPack(p, query) > 0);
    }
    return new Set(list.map((p) => p.id));
  }, [taskPacks, filterMode, query]);

  // 搜索/筛选命中新场景时展开它；已经被自动展开过的场景即便仍在命中集合里也不再重复 set，
  // 用户在搜索过程中手动收起的命中场景不会被下一次按键覆盖。
  // DO NOT 把 expandedSceneCategoryIds 加回依赖：会与用户手动收起形成 effect 自循环。
  const lastSearchExpandedScenesRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!query.trim() && filterMode === "all") return;
    const sceneIdsToExpand = new Set<string>();
    for (const p of taskPacks) {
      if (filteredPacks.has(p.id)) sceneIdsToExpand.add(p.sceneCategoryId);
    }
    for (const id of sceneIdsToExpand) {
      if (!lastSearchExpandedScenesRef.current.has(id)) {
        setSceneCategoryExpanded(id, true);
      }
    }
    lastSearchExpandedScenesRef.current = sceneIdsToExpand;
  }, [query, filterMode, filteredPacks, taskPacks, setSceneCategoryExpanded]);

  const noActiveFilter = !query.trim() && filterMode === "all";

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2.5 border-b border-line px-3 py-3.5">
        <div className="flex items-center gap-2.5 rounded-lg border border-line bg-paper px-3 py-2">
          <Search size={15} strokeWidth={1.7} className="shrink-0 text-hint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索场景、子场景、Prompt"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-hint"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <FilterChip
            active={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            label="全部"
          />
          <FilterChip
            active={filterMode === "favorites"}
            onClick={() => setFilterMode("favorites")}
            icon={<Star size={12} strokeWidth={2} />}
            label="收藏"
          />
          <FilterChip
            active={filterMode === "recent"}
            onClick={() => setFilterMode("recent")}
            icon={<Clock size={12} strokeWidth={1.8} />}
            label="最近"
          />
          {isAdmin && (
            <button
              onClick={() => setBatchOpen(true)}
              title="批量打包多个场景为模板"
              aria-label="批量打包为模板"
              className="ml-auto rounded-md p-1.5 text-hint transition hover:bg-soft hover:text-moss"
            >
              <PackagePlus size={14} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2.5">
        {firstLevel.length === 0 ? (
          <div className="px-3 py-6 text-center text-[13.5px] text-hint">
            暂无场景，去下方「+ 新增场景大类」创建第一个
          </div>
        ) : (
          <ul className="space-y-1">
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
                    siblingCount={firstLevel.length}
                    siblingIndex={firstLevel.findIndex((s) => s.id === scene.id)}
                    isEditing={editingId === scene.id}
                    isMenuOpen={menuId === scene.id}
                    isDragging={draggingId === scene.id}
                    dropEdge={dropTarget?.id === scene.id ? dropTarget.edge : null}
                    onToggle={() => toggleSceneCategoryExpanded(scene.id)}
                    onAdd={() => beginCreateTaskPack(scene.id)}
                    onStartEdit={() => setEditingId(scene.id)}
                    onCommitEdit={(v) => handleSceneRename(scene.id, v)}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleMenu={() =>
                      setMenuId((cur) => (cur === scene.id ? null : scene.id))
                    }
                    onCloseMenu={() => setMenuId(null)}
                    onMoveUp={() => handleSceneMove(scene.id, -1)}
                    onMoveDown={() => handleSceneMove(scene.id, 1)}
                    onDelete={() => handleSceneDelete(scene)}
                    onPackToTemplate={() => handlePackToTemplate(scene)}
                    canPackToTemplate={isAdmin}
                    onDragStart={() => setDraggingId(scene.id)}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDropTarget(null);
                    }}
                    onDragOverEdge={(edge) => {
                      if (!draggingId || draggingId === scene.id) return;
                      if (
                        dropTarget?.id !== scene.id ||
                        dropTarget.edge !== edge
                      ) {
                        setDropTarget({ id: scene.id, edge });
                      }
                    }}
                    onDragLeave={() => {
                      if (dropTarget?.id === scene.id) setDropTarget(null);
                    }}
                    onDrop={(edge) => handleSceneDrop(scene.id, edge)}
                  />
                  {expanded && (
                    <ul className="mb-2 space-y-1 pl-8 pr-1">
                      {visible.length === 0 ? (
                        <li>
                          <button
                            onClick={() => beginCreateTaskPack(scene.id)}
                            className="w-full rounded-md px-2.5 py-1.5 text-left text-[13px] italic text-hint transition hover:bg-soft hover:text-moss"
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
                            isDragging={draggingPackId === pack.id}
                            dropEdge={
                              packDropTarget?.id === pack.id
                                ? packDropTarget.edge
                                : null
                            }
                            onSelect={() => setSelectedTaskPack(pack.id)}
                            onDragStart={() => setDraggingPackId(pack.id)}
                            onDragEnd={() => {
                              setDraggingPackId(null);
                              setPackDropTarget(null);
                            }}
                            onDragOverEdge={(edge) => {
                              if (!draggingPackId || draggingPackId === pack.id) return;
                              const src = taskPacks.find((p) => p.id === draggingPackId);
                              if (!src || src.sceneCategoryId !== pack.sceneCategoryId) return;
                              if (
                                packDropTarget?.id !== pack.id ||
                                packDropTarget.edge !== edge
                              ) {
                                setPackDropTarget({ id: pack.id, edge });
                              }
                            }}
                            onDragLeave={() => {
                              if (packDropTarget?.id === pack.id) setPackDropTarget(null);
                            }}
                            onDrop={(edge) => handlePackDrop(pack.id, edge)}
                            onDelete={() => handlePackDelete(pack)}
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

      <div className="border-t border-line p-3">
        <NewSceneRow
          onCreated={(scene) => {
            setSceneCategoryExpanded(scene.id, true);
            // 创建场景后立即引导用户建第一个子场景
            beginCreateTaskPack(scene.id);
          }}
        />
      </div>

      <BatchPackModal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        firstLevel={firstLevel}
        allScenarios={allScenarios}
        packsByScene={packsByScene}
      />
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
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
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
  siblingCount,
  siblingIndex,
  isEditing,
  isMenuOpen,
  isDragging,
  dropEdge,
  onToggle,
  onAdd,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onToggleMenu,
  onCloseMenu,
  onMoveUp,
  onMoveDown,
  onDelete,
  onPackToTemplate,
  canPackToTemplate,
  onDragStart,
  onDragEnd,
  onDragOverEdge,
  onDragLeave,
  onDrop,
}: {
  scene: Scenario;
  expanded: boolean;
  total: number;
  siblingCount: number;
  siblingIndex: number;
  isEditing: boolean;
  isMenuOpen: boolean;
  isDragging: boolean;
  dropEdge: DropEdge | null;
  onToggle: () => void;
  onAdd: () => void;
  onStartEdit: () => void;
  onCommitEdit: (v: string) => void;
  onCancelEdit: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onPackToTemplate: () => void;
  canPackToTemplate: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverEdge: (edge: DropEdge) => void;
  onDragLeave: () => void;
  onDrop: (edge: DropEdge) => void;
}) {
  return (
    <div
      className={`group relative flex items-center rounded-lg text-[14px] text-sub hover:bg-soft/60 hover:text-ink ${
        isDragging ? "opacity-40" : ""
      }`}
      draggable={!isEditing}
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", scene.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const edge: DropEdge = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
        onDragOverEdge(edge);
      }}
      onDragLeave={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next)) onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dropEdge) onDrop(dropEdge);
      }}
      onContextMenu={(e) => {
        if (isEditing) return;
        e.preventDefault();
        onToggleMenu();
      }}
    >
      {dropEdge === "before" && <DropIndicator position="top" insetLeft={4} />}
      {dropEdge === "after" && <DropIndicator position="bottom" insetLeft={4} />}

      {isEditing ? (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={`shrink-0 text-hint transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
          <InlineEdit
            defaultValue={scene.title}
            onCommit={onCommitEdit}
            onCancel={onCancelEdit}
            className="min-w-0 flex-1"
          />
        </div>
      ) : (
        <button
          onClick={onToggle}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-2 text-left"
        >
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={`shrink-0 text-hint transition-transform ${
              expanded ? "rotate-90" : ""
            }`}
          />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-tight">
            {scene.title}
          </span>
          {total > 0 && (
            <span className="mr-1 text-xs tabular-nums text-hint">
              {total}
            </span>
          )}
        </button>
      )}

      {!isEditing && (
        <>
          <NodeMenuButton
            isOpen={isMenuOpen}
            onToggle={onToggleMenu}
            onClose={onCloseMenu}
            items={[
              { label: "重命名", onClick: () => { onCloseMenu(); onStartEdit(); } },
              ...(canPackToTemplate
                ? [
                    {
                      label: "打包为模板",
                      onClick: () => { onCloseMenu(); onPackToTemplate(); },
                    },
                  ]
                : []),
              {
                label: "上移",
                disabled: siblingIndex <= 0,
                onClick: () => { onCloseMenu(); onMoveUp(); },
              },
              {
                label: "下移",
                disabled: siblingIndex < 0 || siblingIndex >= siblingCount - 1,
                onClick: () => { onCloseMenu(); onMoveDown(); },
              },
              {
                label: "删除大场景…",
                danger: true,
                onClick: () => { onCloseMenu(); onDelete(); },
              },
            ]}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            title={`在「${scene.title}」下新建子场景`}
            aria-label={`在「${scene.title}」下新建子场景`}
            className="mr-1 rounded-md p-1.5 text-hint/70 transition hover:bg-paper hover:text-moss"
          >
            <Plus size={14} strokeWidth={1.8} />
          </button>
        </>
      )}
    </div>
  );
}

function PackRow({
  pack,
  active,
  isDragging,
  dropEdge,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragOverEdge,
  onDragLeave,
  onDrop,
  onDelete,
}: {
  pack: TaskPack;
  active: boolean;
  isDragging: boolean;
  dropEdge: DropEdge | null;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOverEdge: (edge: DropEdge) => void;
  onDragLeave: () => void;
  onDrop: (edge: DropEdge) => void;
  onDelete: () => void;
}) {
  return (
    <li
      className={`group/pack relative ${isDragging ? "opacity-40" : ""}`}
      draggable
      onDragStart={(e) => {
        onDragStart();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", pack.id);
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const edge: DropEdge =
          e.clientY < rect.top + rect.height / 2 ? "before" : "after";
        onDragOverEdge(edge);
      }}
      onDragLeave={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!e.currentTarget.contains(next)) onDragLeave();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dropEdge) onDrop(dropEdge);
      }}
    >
      {dropEdge === "before" && <DropIndicator position="top" insetLeft={10} />}
      {dropEdge === "after" && <DropIndicator position="bottom" insetLeft={10} />}
      <button
        onClick={onSelect}
        className={`group relative flex w-full items-center gap-2 rounded-md py-1.5 pl-2.5 pr-9 text-left text-[13.5px] transition-colors ${
          active
            ? "bg-soft font-medium text-ink"
            : "text-sub hover:bg-soft/60 hover:text-ink"
        }`}
      >
        {active && (
          <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-moss" />
        )}
        <span className="text-hint">·</span>
        <span className="min-w-0 flex-1 truncate">
          {pack.title || (
            <span className="italic text-hint">未命名子场景</span>
          )}
        </span>
        {pack.isFavorited && (
          <Star size={12} strokeWidth={2} className="shrink-0 fill-amber text-amber" />
        )}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title={`删除「${pack.title || "未命名子场景"}」`}
        aria-label={`删除「${pack.title || "未命名子场景"}」`}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-hint/70 opacity-0 transition group-hover/pack:opacity-100 hover:bg-paper hover:text-red-500 focus:opacity-100"
      >
        <Trash2 size={13} strokeWidth={1.8} />
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
        className="group/new flex w-full items-center justify-center gap-2 rounded-lg border border-moss/30 bg-moss-soft/60 py-3 text-[14px] font-semibold text-moss shadow-sm transition hover:border-moss/60 hover:bg-moss-soft hover:shadow-md"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-moss/15 transition group-hover/new:bg-moss/25">
          <Plus size={13} strokeWidth={2.4} />
        </span>
        新增场景大类
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-moss/60 bg-paper px-2.5 py-1.5">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") cancel();
        }}
        placeholder="场景大类名称"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-hint"
      />
      <button
        onClick={commit}
        className="rounded-md p-1.5 text-moss hover:bg-moss-soft"
        title="确认 (Enter)"
      >
        <Check size={14} strokeWidth={2} />
      </button>
      <button
        onClick={cancel}
        className="rounded-md p-1.5 text-hint hover:bg-soft hover:text-ink"
        title="取消 (Esc)"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
