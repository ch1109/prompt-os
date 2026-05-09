import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  onSubmit: (next: string) => void;
  placeholder?: string;
  emptyHint?: string;
  multiline?: boolean;
  className?: string;        // 显示态外层
  inputClassName?: string;   // 编辑态 input/textarea
  /** 是否在挂载时自动进入编辑态（用于"创建后立即重命名"） */
  autoEditOnMount?: boolean;
  /** 自定义校验：返回 false 则不提交（保持编辑态），用于阻止空值 */
  validate?: (next: string) => boolean;
}

export function InlineEditable({
  value,
  onSubmit,
  placeholder,
  emptyHint,
  multiline = false,
  className = "",
  inputClassName = "",
  autoEditOnMount = false,
  validate,
}: Props) {
  const [editing, setEditing] = useState(autoEditOnMount);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // 非编辑态时，外部 value 变化要同步到 draft
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      } else {
        inputRef.current.setSelectionRange(
          inputRef.current.value.length,
          inputRef.current.value.length
        );
      }
    }
  }, [editing]);

  function commit() {
    const trimmed = draft;
    if (validate && !validate(trimmed)) {
      // 校验失败保留编辑态
      return;
    }
    if (trimmed !== value) onSubmit(trimmed);
    setEditing(false);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (multiline) {
      // 多行用 Cmd/Ctrl+Enter 提交
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        commit();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={(el) => {
            inputRef.current = el;
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          className={`w-full resize-y rounded border border-moss/40 bg-paper px-2 py-1 text-[13.5px] leading-relaxed text-ink outline-none focus:border-moss ${inputClassName}`}
        />
      );
    }
    return (
      <input
        ref={(el) => {
          inputRef.current = el;
        }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`w-full rounded border border-moss/40 bg-paper px-2 py-1 text-[13.5px] text-ink outline-none focus:border-moss ${inputClassName}`}
      />
    );
  }

  const isEmpty = !value.trim();

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`group block w-full cursor-text rounded px-2 py-1 text-left transition-colors hover:bg-soft/60 ${
        isEmpty ? "italic text-hint" : "text-ink"
      } ${className}`}
      title="点击编辑"
    >
      {isEmpty ? emptyHint || placeholder || "点击编辑…" : value}
    </button>
  );
}
