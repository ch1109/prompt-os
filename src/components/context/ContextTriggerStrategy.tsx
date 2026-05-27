import { useMemo } from "react";
import { useScenarios } from "@/hooks/useScenarios";
import type {
  ContextTriggerConditions,
  ContextTriggerStrategy as Strategy,
} from "@/types";

interface Props {
  strategy: Strategy;
  onStrategyChange: (s: Strategy) => void;
  conditions: ContextTriggerConditions | undefined;
  onConditionsChange: (c: ContextTriggerConditions) => void;
}

const OPTIONS: Array<{
  value: Strategy;
  label: string;
  hint: string;
}> = [
  {
    value: "always",
    label: "默认启用",
    hint: "调用相关 Prompt 时自动附加",
  },
  {
    value: "manual",
    label: "手动选择",
    hint: "每次由用户在调用时勾选",
  },
  {
    value: "conditional",
    label: "条件触发",
    hint: "命中场景 / 标签 / 关键词时自动附加",
  },
];

export function ContextTriggerStrategy({
  strategy,
  onStrategyChange,
  conditions,
  onConditionsChange,
}: Props) {
  const scenarios = useScenarios();
  const topScenes = useMemo(() => scenarios.filter((s) => s.level === 1), [scenarios]);
  const subScenes = useMemo(() => scenarios.filter((s) => s.level >= 2), [scenarios]);
  const c = conditions ?? {};

  function patch(p: Partial<ContextTriggerConditions>) {
    onConditionsChange({ ...c, ...p });
  }

  function toggleArr(key: keyof ContextTriggerConditions, id: string) {
    const arr = (c[key] as string[] | undefined) ?? [];
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    patch({ [key]: next });
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-1.5 sm:grid-cols-3">
        {OPTIONS.map((opt) => {
          const active = strategy === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStrategyChange(opt.value)}
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

      {strategy === "conditional" && (
        <div className="space-y-2 rounded-md border border-dashed border-line bg-soft/40 p-2.5">
          <ConditionMultiselect
            label="命中一级场景"
            options={topScenes.map((s) => ({ id: s.id, label: s.title }))}
            selected={c.scenarioIds ?? []}
            onToggle={(id) => toggleArr("scenarioIds", id)}
          />
          <ConditionMultiselect
            label="命中子场景"
            options={subScenes.map((s) => ({
              id: s.id,
              label: s.fullPath?.join(" › ") || s.title,
            }))}
            selected={c.subScenarioIds ?? []}
            onToggle={(id) => toggleArr("subScenarioIds", id)}
          />
          <ChipInput
            label="命中 Prompt 标签"
            values={c.promptTags ?? []}
            onChange={(next) => patch({ promptTags: next })}
            placeholder="输入标签后按 Enter"
          />
          <ChipInput
            label="命中关键词"
            values={c.keywords ?? []}
            onChange={(next) => patch({ keywords: next })}
            placeholder="出现在 Prompt 标题/正文则命中"
          />
          <p className="text-[11px] leading-tight text-hint">
            条件触发当前仅保存规则配置，自动附加执行将在后续版本接入。
          </p>
        </div>
      )}
    </div>
  );
}

function ConditionMultiselect({
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
  if (options.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-sub">{label}</div>
      <div className="flex flex-wrap gap-1.5">
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

function ChipInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-sub">{label}</div>
      <SimpleChipInput
        value={values}
        onChange={onChange}
        placeholder={placeholder}
      />
    </div>
  );
}

function SimpleChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  // 简化版 chip 输入：用于条件配置内，避免依赖 useAllTags
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const t = (e.target as HTMLInputElement).value.trim();
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      (e.target as HTMLInputElement).value = "";
      return;
    }
    onChange([...value, t]);
    (e.target as HTMLInputElement).value = "";
  };
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-paper px-2 py-1">
      {value.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded bg-soft px-1.5 py-0.5 text-[11px] text-ink"
        >
          {t}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="text-hint hover:text-amber"
            aria-label={`移除 ${t}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        onKeyDown={onKey}
        placeholder={value.length === 0 ? placeholder : ""}
        className="min-w-[120px] flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-hint"
      />
    </div>
  );
}
