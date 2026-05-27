import { useMemo } from "react";
import { useScenarios } from "@/hooks/useScenarios";
import type { ContextScope, ContextScopeRefs } from "@/types";

interface Props {
  scope: ContextScope;
  onScopeChange: (s: ContextScope) => void;
  refs: ContextScopeRefs | undefined;
  onRefsChange: (r: ContextScopeRefs) => void;
}

const OPTIONS: Array<{ value: ContextScope; label: string; hint: string }> = [
  { value: "global", label: "全局", hint: "所有场景生效" },
  { value: "scene_category", label: "场景大类", hint: "仅指定的一级场景生效" },
  { value: "sub_scene", label: "子场景", hint: "仅指定的子场景生效" },
];

export function ContextScopeSelector({
  scope,
  onScopeChange,
  refs,
  onRefsChange,
}: Props) {
  const scenarios = useScenarios();
  const topScenes = useMemo(() => scenarios.filter((s) => s.level === 1), [scenarios]);
  const subScenes = useMemo(() => scenarios.filter((s) => s.level >= 2), [scenarios]);
  const r = refs ?? {};

  function toggle(key: keyof ContextScopeRefs, id: string) {
    const arr = (r[key] as string[] | undefined) ?? [];
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    onRefsChange({ ...r, [key]: next });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = scope === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onScopeChange(opt.value)}
              className={`rounded-md border px-2.5 py-2 text-left transition ${
                active
                  ? "border-moss bg-moss-soft/60 ring-1 ring-moss/30"
                  : "border-line bg-paper hover:border-moss/40 hover:bg-soft"
              }`}
            >
              <div className={`text-sm font-medium ${active ? "text-moss" : "text-ink"}`}>
                {opt.label}
              </div>
              <div className="mt-0.5 text-[11px] leading-tight text-hint">{opt.hint}</div>
            </button>
          );
        })}
      </div>

      {scope === "scene_category" && topScenes.length > 0 && (
        <ScopeMultiselect
          label="选择一级场景"
          options={topScenes.map((s) => ({ id: s.id, label: s.title }))}
          selected={r.scenarioIds ?? []}
          onToggle={(id) => toggle("scenarioIds", id)}
        />
      )}
      {scope === "sub_scene" && subScenes.length > 0 && (
        <ScopeMultiselect
          label="选择子场景"
          options={subScenes.map((s) => ({
            id: s.id,
            label: s.fullPath?.join(" › ") || s.title,
          }))}
          selected={r.subScenarioIds ?? []}
          onToggle={(id) => toggle("subScenarioIds", id)}
        />
      )}
    </div>
  );
}

function ScopeMultiselect({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ id: string; label: string }>;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-md border border-dashed border-line bg-soft/40 p-2.5">
      <div className="mb-1 text-[11px] font-medium text-sub">{label}</div>
      <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onToggle(o.id)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                on
                  ? "border-moss bg-moss text-paper"
                  : "border-line bg-paper text-sub hover:border-moss/40 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
