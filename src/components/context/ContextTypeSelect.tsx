import type { ContextType } from "@/types";
import { CONTEXT_TYPE_OPTIONS } from "./contextTypes";

interface Props {
  value: ContextType;
  onChange: (next: ContextType) => void;
}

export function ContextTypeSelect({ value, onChange }: Props) {
  const isUnknown = !CONTEXT_TYPE_OPTIONS.includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ContextType)}
      className="input"
    >
      {CONTEXT_TYPE_OPTIONS.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
      {isUnknown && (
        <option key={value} value={value}>
          {value}（历史值）
        </option>
      )}
    </select>
  );
}
