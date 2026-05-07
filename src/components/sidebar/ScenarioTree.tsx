import { useScenarios } from "@/hooks/useScenarios";
import { useUI } from "@/store/uiStore";
import type { Scenario } from "@/types";

export function ScenarioTree() {
  const all = useScenarios();
  const { selectedScenarioId, setSelectedScenario } = useUI();

  const roots = all.filter((s) => s.parentId === null);
  const childrenOf = (pid: string) => all.filter((s) => s.parentId === pid);

  const renderNode = (s: Scenario, depth = 0): JSX.Element => (
    <li key={s.id}>
      <button
        onClick={() => setSelectedScenario(s.id)}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`w-full rounded py-1 pr-2 text-left text-sm transition-colors ${
          selectedScenarioId === s.id
            ? "bg-muted font-medium text-foreground"
            : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
        }`}
      >
        {s.title}
      </button>
      {childrenOf(s.id).length > 0 && (
        <ul>{childrenOf(s.id).map((c) => renderNode(c, depth + 1))}</ul>
      )}
    </li>
  );

  return <ul className="py-1">{roots.map((r) => renderNode(r))}</ul>;
}
