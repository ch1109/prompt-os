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
const NAV_ITEM_BASE =
  "group flex w-full items-center rounded-lg px-3 py-2 text-left text-[14px] transition";
const NAV_ITEM_ACTIVE =
  "bg-paper font-semibold text-ink shadow-[inset_0_0_0_1px_rgb(var(--line)/0.65),0_8px_18px_-18px_rgb(var(--ink)/0.6)]";
const NAV_ITEM_IDLE = "text-sub hover:bg-paper/70 hover:text-ink";

function getNavItemClass(isActive: boolean): string {
  return `${NAV_ITEM_BASE} ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`;
}

export function Sidebar() {
  const { selectedScenarioId, setSelectedScenario } = useUI();

  return (
    <div className="space-y-[18px] px-3 py-4">
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
    <div className="mono mb-2.5 px-2 text-xs font-semibold uppercase tracking-wider2 text-hint">
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
      <ul className="space-y-1.5">
        {items.map((it) => {
          const isActive = active === it.id;
          return (
            <li key={it.id}>
              <button
                onClick={() => onSelect(it.id)}
                className={getNavItemClass(isActive)}
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
