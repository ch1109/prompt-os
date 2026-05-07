import { create } from "zustand";

interface UIState {
  selectedScenarioId: string | null;
  selectedPromptId: string | null;
  searchQuery: string;
  detailOpen: boolean;
  filterTaskTypes: string[];
  filterDifficulties: string[];
  intentResultIds: string[] | null;
  setSelectedScenario: (id: string | null) => void;
  setSelectedPrompt: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setDetailOpen: (b: boolean) => void;
  setFilterTaskTypes: (types: string[]) => void;
  setFilterDifficulties: (diffs: string[]) => void;
  setIntentResultIds: (ids: string[] | null) => void;
}

export const useUI = create<UIState>((set) => ({
  selectedScenarioId: null,
  selectedPromptId: null,
  searchQuery: "",
  detailOpen: false,
  filterTaskTypes: [],
  filterDifficulties: [],
  intentResultIds: null,
  setSelectedScenario: (id) => set({ selectedScenarioId: id }),
  setSelectedPrompt: (id) => set({ selectedPromptId: id, detailOpen: !!id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setDetailOpen: (b) => set({ detailOpen: b }),
  setFilterTaskTypes: (filterTaskTypes) => set({ filterTaskTypes }),
  setFilterDifficulties: (filterDifficulties) => set({ filterDifficulties }),
  setIntentResultIds: (intentResultIds) => set({ intentResultIds }),
}));
