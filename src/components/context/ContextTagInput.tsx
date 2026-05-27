import { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useAllTags } from "@/hooks/useAllTags";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function ContextTagInput({
  value,
  onChange,
  placeholder = "输入标签后按 Enter",
}: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const all = useAllTags();
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const exists = new Set(value.map((t) => t.toLowerCase()));
    return all
      .filter((t) => t.toLowerCase().includes(q) && !exists.has(t.toLowerCase()))
      .slice(0, 6);
  }, [draft, all, value]);

  function commit(raw: string) {
    const t = raw.trim();
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  }

  function remove(t: string) {
    onChange(value.filter((x) => x !== t));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit(draft);
      return;
    }
    if (e.key === "Backspace" && !draft && value.length > 0) {
      remove(value[value.length - 1]);
    }
  }

  return (
    <div className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-line bg-paper px-2 py-1.5 focus-within:border-moss focus-within:ring-1 focus-within:ring-moss/30"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-md bg-moss-soft px-2 py-0.5 text-xs text-moss"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(t);
              }}
              className="text-moss/70 hover:text-moss"
              aria-label={`移除标签 ${t}`}
            >
              <X size={11} strokeWidth={2.2} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // 失焦时若 draft 非空，自动提交一次
            window.setTimeout(() => setFocused(false), 150);
            if (draft.trim()) commit(draft);
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-hint"
        />
      </div>
      {focused && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-44 overflow-y-auto rounded-md border border-line bg-paper shadow-lg">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s);
                inputRef.current?.focus();
              }}
              className="block w-full px-2.5 py-1.5 text-left text-sm text-ink hover:bg-soft"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
