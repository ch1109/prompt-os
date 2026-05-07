import { useUI } from "@/store/uiStore";
import { ScenarioTree } from "./ScenarioTree";

const QUICK_ITEMS = [
  { id: "qs:all", label: "全部 Prompt" },
  { id: "qs:fav", label: "⭐ 收藏" },
  { id: "qs:recent", label: "🕐 最近使用" },
  { id: "qs:pending", label: "⏳ 待确认" },
];

const SMART_ITEMS = [
  { id: "smart:high-value", label: "高价值" },
  { id: "smart:strategic", label: "战略型" },
  { id: "smart:high-freq", label: "高频" },
];

export function Sidebar() {
  const { selectedScenarioId, setSelectedScenario } = useUI();

  return (
    <div className="space-y-1 p-2">
      <Section
        title="快捷入口"
        items={QUICK_ITEMS}
        active={selectedScenarioId}
        onSelect={setSelectedScenario}
      />
      <div className="pt-2">
        <SectionTitle>场景库</SectionTitle>
        <ScenarioTree />
      </div>
      <div className="pt-2">
        <Section
          title="智能集合"
          items={SMART_ITEMS}
          active={selectedScenarioId}
          onSelect={setSelectedScenario}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-foreground/40">
      {children}
    </div>
  );
}

function Section({
  title,
  items,
  active,
  onSelect,
}: {
  title: string;
  items: { id: string; label: string }[];
  active: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <button
              onClick={() => onSelect(it.id)}
              className={`w-full rounded px-2 py-1 text-left text-sm transition-colors ${
                active === it.id
                  ? "bg-muted font-medium text-foreground"
                  : "text-foreground/70 hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
