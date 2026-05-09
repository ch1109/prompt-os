import { useEffect, useRef } from "react";
import { useConfirm } from "@/store/confirmStore";

export function ConfirmDialog() {
  const open = useConfirm((s) => s.open);
  const options = useConfirm((s) => s.options);
  const close = useConfirm((s) => s.close);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmBtnRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const danger = options.danger ?? false;
  const confirmCls = danger
    ? "bg-red-600 text-paper hover:bg-red-700"
    : "bg-moss text-paper hover:bg-moss/90";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-ink/30 p-4 page-enter"
      onClick={() => close(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-sm rounded-md border border-line bg-paper p-5 shadow-[0_8px_32px_-8px_rgba(20,20,18,0.18)] detail-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-medium leading-snug text-ink">{options.title}</div>
        {options.message && (
          <div className="mt-2 text-[13px] leading-relaxed text-sub">{options.message}</div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => close(false)}
            className="rounded px-3.5 py-1.5 text-[13px] text-sub hover:bg-soft"
          >
            {options.cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={() => close(true)}
            className={`rounded px-3.5 py-1.5 text-[13px] font-medium transition ${confirmCls}`}
          >
            {options.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
