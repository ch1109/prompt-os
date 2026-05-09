import { useUI } from "@/store/uiStore";
import { ScenarioTree } from "./ScenarioTree";

const QUICK_ITEMS = [
  { id: "qs:all", label: "全部 Prompt" },
  { id: "qs:fav", label: "收藏" },
  { id: "qs:recent", label: "最近使用" },
  { id: "qs:pending", label: "待确认" },
];

const SMART_ITEMS = [
  { id: "smart:high-value", label: "高价值" },
  { id: "smart:strategic", label: "战略型" },
  { id: "smart:high-freq", label: "高频" },
];

export function Sidebar() {
  const { selectedScenarioId, setSelectedScenario } = useUI();

  return (
    <div className="space-y-5 px-3 py-4">
      <Section
        title="快捷"
        items={QUICK_ITEMS}
        active={selectedScenarioId}
        onSelect={setSelectedScenario}
      />
      <div>
        <SectionTitle>场景库</SectionTitle>
        <ScenarioTree />
      </div>
      <Section
        title="智能集合"
        items={SMART_ITEMS}
        active={selectedScenarioId}
        onSelect={setSelectedScenario}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono mb-2 px-2 text-[10.5px] font-medium uppercase tracking-wider2 text-hint">
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
      <ul className="space-y-px">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <li key={it.id}>
              <button
                onClick={() => onSelect(it.id)}
                className={`group flex w-full items-center rounded px-2 py-[5px] text-left text-[13px] transition-colors ${
                  isActive
                    ? "bg-soft font-medium text-ink"
                    : "text-sub hover:bg-soft/70 hover:text-ink"
                }`}
              >
                {it.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
