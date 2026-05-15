import { useState, type ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { useScenarios } from "@/hooks/useScenarios";
import { useUI } from "@/store/uiStore";
import { renameScenario, reorderSiblings } from "@/db/repos/scenarioRepo";
import { toast } from "@/store/toastStore";
import type { Scenario } from "@/types";
import {
  DropIndicator,
  InlineEdit,
  NodeMenuButton,
  type DropEdge,
} from "./scenarioControls";

const TREE_NODE_BASE = "group relative flex items-center rounded-lg text-[14px] transition";
const TREE_NODE_ACTIVE =
  "bg-paper font-semibold text-ink shadow-[inset_0_0_0_1px_rgb(var(--line)/0.65),0_8px_18px_-18px_rgb(var(--ink)/0.6)]";
const TREE_NODE_IDLE = "text-sub hover:bg-paper/70 hover:text-ink";

function getTreeNodeClass(isActive: boolean, isDragging: boolean): string {
  return `${TREE_NODE_BASE} ${isActive ? TREE_NODE_ACTIVE : TREE_NODE_IDLE}${
    isDragging ? " opacity-40" : ""
  }`;
}

export function ScenarioTree() {
  const all = useScenarios();
  const selectedScenarioId = useUI((s) => s.selectedScenarioId);
  const setSelectedScenario = useUI((s) => s.setSelectedScenario);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; edge: DropEdge } | null>(null);

  const childrenByParent = groupAndSortByParent(all);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function handleDrop(targetId: string, edge: DropEdge) {
    setDropTarget(null);
    if (!draggingId || draggingId === targetId) return;
    const source = all.find((s) => s.id === draggingId);
    const target = all.find((s) => s.id === targetId);
    setDraggingId(null);
    if (!source || !target) return;
    if (source.parentId !== target.parentId) {
      toast.info("只能在同一层级内调整顺序");
      return;
    }
    const siblings = childrenByParent.get(target.parentId) ?? [];
    const without = siblings.filter((s) => s.id !== source.id);
    const targetIdx = without.findIndex((s) => s.id === target.id);
    if (targetIdx === -1) return;
    const insertAt = edge === "before" ? targetIdx : targetIdx + 1;
    const reordered = [...without.slice(0, insertAt), source, ...without.slice(insertAt)];
    await reorderSiblings(reordered.map((s) => s.id));
  }

  async function handleRename(id: string, nextTitle: string) {
    const scn = all.find((s) => s.id === id);
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

  async function moveBy(id: string, delta: -1 | 1) {
    const scn = all.find((s) => s.id === id);
    if (!scn) return;
    const siblings = childrenByParent.get(scn.parentId) ?? [];
    const idx = siblings.findIndex((s) => s.id === id);
    const target = idx + delta;
    if (idx === -1 || target < 0 || target >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    await reorderSiblings(reordered.map((s) => s.id));
  }

  const renderNode = (s: Scenario, depth = 0): ReactElement => {
    const kids = childrenByParent.get(s.id) ?? [];
    const isExpanded = expanded.has(s.id);
    const isActive = selectedScenarioId === s.id;
    const hasChildren = kids.length > 0;
    const isEditing = editingId === s.id;
    const isMenuOpen = menuId === s.id;
    const isDragging = draggingId === s.id;
    const dropEdge = dropTarget?.id === s.id ? dropTarget.edge : null;
    const siblings = childrenByParent.get(s.parentId) ?? [];
    const idx = siblings.findIndex((x) => x.id === s.id);
    const insetLeft = 6 + depth * 14;

    return (
      <li key={s.id}>
        <div
          className={getTreeNodeClass(isActive, isDragging)}
          style={{ paddingLeft: insetLeft }}
          draggable={!isEditing}
          onDragStart={(e) => {
            setDraggingId(s.id);
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", s.id);
          }}
          onDragEnd={() => {
            setDraggingId(null);
            setDropTarget(null);
          }}
          onDragOver={(e) => {
            if (!draggingId || draggingId === s.id) return;
            const src = all.find((x) => x.id === draggingId);
            if (!src || src.parentId !== s.parentId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const rect = e.currentTarget.getBoundingClientRect();
            const edge: DropEdge = e.clientY < rect.top + rect.height / 2 ? "before" : "after";
            if (dropTarget?.id !== s.id || dropTarget.edge !== edge) {
              setDropTarget({ id: s.id, edge });
            }
          }}
          onDragLeave={(e) => {
            const next = e.relatedTarget as Node | null;
            if (!e.currentTarget.contains(next)) {
              if (dropTarget?.id === s.id) setDropTarget(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dropEdge) handleDrop(s.id, dropEdge);
          }}
          onContextMenu={(e) => {
            if (isEditing) return;
            e.preventDefault();
            setMenuId((cur) => (cur === s.id ? null : s.id));
          }}
        >
          {isActive && <span className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-moss" />}
          {dropEdge === "before" && <DropIndicator position="top" insetLeft={insetLeft} />}
          {dropEdge === "after" && <DropIndicator position="bottom" insetLeft={insetLeft} />}

          <button
            onClick={() => hasChildren && toggle(s.id)}
            className="flex h-8 w-6 shrink-0 items-center justify-center text-hint transition hover:text-ink"
            aria-label={isExpanded ? "折叠" : "展开"}
          >
            {hasChildren ? (
              <ChevronRight
                size={13}
                strokeWidth={2}
                className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            ) : null}
          </button>

          {isEditing ? (
            <InlineEdit
              defaultValue={s.title}
              onCommit={(v) => handleRename(s.id, v)}
              onCancel={() => setEditingId(null)}
              className="my-0.5 mr-1 flex-1"
            />
          ) : (
            <button
              onClick={() => setSelectedScenario(s.id)}
              onDoubleClick={() => setEditingId(s.id)}
              className={`flex-1 truncate py-2 pr-1.5 text-left ${
                depth === 0 ? "font-medium tracking-tight" : ""
              }`}
              title={s.title}
            >
              {s.title}
            </button>
          )}

          {!isEditing && (
            <NodeMenuButton
              isOpen={isMenuOpen}
              onToggle={() => setMenuId((cur) => (cur === s.id ? null : s.id))}
              onClose={() => setMenuId(null)}
              items={[
                {
                  label: "重命名",
                  onClick: () => {
                    setMenuId(null);
                    setEditingId(s.id);
                  },
                },
                {
                  label: "上移",
                  disabled: idx <= 0,
                  onClick: () => {
                    setMenuId(null);
                    moveBy(s.id, -1);
                  },
                },
                {
                  label: "下移",
                  disabled: idx < 0 || idx >= siblings.length - 1,
                  onClick: () => {
                    setMenuId(null);
                    moveBy(s.id, 1);
                  },
                },
              ]}
            />
          )}
        </div>
        {hasChildren && isExpanded && (
          <ul className="mt-1.5 space-y-1">{kids.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const roots = childrenByParent.get(null) ?? [];
  return <ul className="space-y-1.5">{roots.map((r) => renderNode(r))}</ul>;
}

function groupAndSortByParent(all: Scenario[]): Map<string | null, Scenario[]> {
  const map = new Map<string | null, Scenario[]>();
  for (const s of all) {
    const arr = map.get(s.parentId) ?? [];
    arr.push(s);
    map.set(s.parentId, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      const ao = a.order ?? Number.MAX_SAFE_INTEGER;
      const bo = b.order ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title, "zh");
    });
  }
  return map;
}
