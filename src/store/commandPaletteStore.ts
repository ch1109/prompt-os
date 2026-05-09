import { create } from "zustand";

interface CommandPaletteState {
  open: boolean;
  setOpen: (b: boolean) => void;
  toggle: () => void;
}

export const useCommandPalette = create<CommandPaletteState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));
