import { useState, type ReactElement } from "react";
import { ChevronRight } from "lucide-react";
import { useScenarios } from "@/hooks/useScenarios";
import { useUI } from "@/store/uiStore";
import type { Scenario } from "@/types";

export function ScenarioTree() {
  const all = useScenarios();
  const selectedScenarioId = useUI((s) => s.selectedScenarioId);
  const setSelectedScenario = useUI((s) => s.setSelectedScenario);
  // 默认折叠所有；用户选中某个节点时其祖先链自动展开
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const roots = all.filter((s) => s.parentId === null);
  const childrenOf = (pid: string) => all.filter((s) => s.parentId === pid);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const renderNode = (s: Scenario, depth = 0): ReactElement => {
    const kids = childrenOf(s.id);
    const isExpanded = expanded.has(s.id);
    const isActive = selectedScenarioId === s.id;
    const hasChildren = kids.length > 0;

    return (
      <li key={s.id}>
        <div
          className={`group flex items-center rounded text-[13px] transition-colors ${
            isActive ? "bg-soft font-medium text-ink" : "text-sub hover:bg-soft/70 hover:text-ink"
          }`}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          <button
            onClick={() => hasChildren && toggle(s.id)}
            className="flex h-6 w-5 shrink-0 items-center justify-center text-hint hover:text-ink"
            aria-label={isExpanded ? "折叠" : "展开"}
          >
            {hasChildren ? (
              <ChevronRight
                size={12}
                strokeWidth={2}
                className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
            ) : null}
          </button>
          <button
            onClick={() => setSelectedScenario(s.id)}
            className={`flex-1 truncate py-[5px] pr-2 text-left ${
              depth === 0 ? "font-medium tracking-tight" : ""
            }`}
            title={s.title}
          >
            {s.title}
          </button>
        </div>
        {hasChildren && isExpanded && (
          <ul className="space-y-px">{kids.map((c) => renderNode(c, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return <ul className="space-y-px">{roots.map((r) => renderNode(r))}</ul>;
}
