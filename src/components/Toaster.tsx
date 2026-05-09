import { Check, AlertCircle, Info, X } from "lucide-react";
import { useToast, type ToastLevel } from "@/store/toastStore";

const ICON: Record<ToastLevel, typeof Check> = {
  success: Check,
  error: AlertCircle,
  info: Info,
};

const ACCENT: Record<ToastLevel, string> = {
  success: "before:bg-moss text-moss",
  error: "before:bg-red-500 text-red-600",
  info: "before:bg-sub text-sub",
};

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON[t.level];
        return (
          <div
            key={t.id}
            className={`detail-enter pointer-events-auto relative flex items-start gap-2.5 overflow-hidden rounded-md border border-line bg-paper py-2.5 pl-4 pr-3 text-[13px] text-ink shadow-[0_2px_8px_-2px_rgba(20,20,18,0.08),0_8px_24px_-12px_rgba(20,20,18,0.12)] before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] ${ACCENT[t.level]}`}
            role="status"
          >
            <Icon size={14} strokeWidth={2} className="mt-[2px] shrink-0" />
            <span className="flex-1 leading-relaxed text-ink">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-hint/60 hover:bg-soft hover:text-ink"
              aria-label="关闭"
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
