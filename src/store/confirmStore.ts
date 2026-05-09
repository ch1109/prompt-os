import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((ok: boolean) => void) | null;
  ask: (opts: ConfirmOptions) => Promise<boolean>;
  close: (ok: boolean) => void;
}

const DEFAULTS: ConfirmOptions = {
  title: "确认",
  confirmText: "确认",
  cancelText: "取消",
  danger: false,
};

export const useConfirm = create<ConfirmState>((set, get) => ({
  open: false,
  options: DEFAULTS,
  resolve: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      // 若已有未关闭的弹窗，先把它当作取消
      const prev = get().resolve;
      if (prev) prev(false);
      set({ open: true, options: { ...DEFAULTS, ...opts }, resolve });
    }),
  close: (ok) => {
    const { resolve } = get();
    if (resolve) resolve(ok);
    set({ open: false, resolve: null });
  },
}));

export const confirm = (opts: ConfirmOptions) => useConfirm.getState().ask(opts);
