import { create } from "zustand";
import { nanoid } from "nanoid";

export type ToastLevel = "success" | "error" | "info";

export interface Toast {
  id: string;
  level: ToastLevel;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (level: ToastLevel, message: string) => string;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (level, message) => {
    const id = nanoid(8);
    set((s) => ({ toasts: [...s.toasts, { id, level, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (msg: string) => useToast.getState().push("success", msg),
  error: (msg: string) => useToast.getState().push("error", msg),
  info: (msg: string) => useToast.getState().push("info", msg),
};
