import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "system" | "light" | "dark";

interface SettingsState {
  apiKey: string;
  model: string;
  theme: ThemeMode;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
  setTheme: (t: ThemeMode) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      model: "claude-sonnet-4-6",
      theme: "system",
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "prompt-os-settings" }
  )
);
