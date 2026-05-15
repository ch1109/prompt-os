import { useEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";

export type DropEdge = "before" | "after";

export function DropIndicator({
  position,
  insetLeft,
}: {
  position: "top" | "bottom";
  insetLeft: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute right-2 h-[2px] rounded-full bg-moss ${
        position === "top" ? "-top-px" : "-bottom-px"
      }`}
      style={{ left: insetLeft }}
    />
  );
}

export function InlineEdit({
  defaultValue,
  onCommit,
  onCancel,
  className = "",
}: {
  defaultValue: string;
  onCommit: (v: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  // 防止 commit 在 keydown 与 blur 之间各跑一次
  const committed = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const commit = (v: string) => {
    if (committed.current) return;
    committed.current = true;
    onCommit(v);
  };

  return (
    <input
      ref={ref}
      defaultValue={defaultValue}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
        else if (e.key === "Escape") {
          committed.current = true;
          onCancel();
        }
        e.stopPropagation();
      }}
      onBlur={(e) => commit(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`rounded border border-line bg-paper px-1.5 py-[2px] text-[13px] text-ink outline-none focus:border-moss ${className}`}
    />
  );
}

export interface NodeMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function NodeMenuButton({
  isOpen,
  onToggle,
  onClose,
  items,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  items: NodeMenuItem[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", esc);
    };
  }, [isOpen, onClose]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        aria-label="更多操作"
        className={`mr-1 flex h-6 w-6 items-center justify-center rounded text-hint hover:bg-paper hover:text-ink ${
          isOpen ? "bg-paper text-ink opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <MoreVertical size={13} strokeWidth={2} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-7 z-30 w-32 overflow-hidden rounded-md border border-line bg-paper shadow-lg">
          {items.map((it, i) => (
            <button
              type="button"
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                if (!it.disabled) it.onClick();
              }}
              disabled={it.disabled}
              className={`block w-full px-3 py-1.5 text-left text-[12.5px] hover:bg-soft disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                it.danger ? "text-red-600" : "text-ink"
              } ${it.disabled ? "text-hint" : ""}`}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
