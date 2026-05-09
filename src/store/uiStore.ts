import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { IntentMatch } from "@/services/searcher";

export interface TaskPackDraft {
  title: string;
  goal: string;
  sceneCategoryId: string;
}

interface UIState {
  selectedScenarioId: string | null;
  selectedPromptId: string | null;
  searchQuery: string;
  detailOpen: boolean;
  filterTaskTypes: string[];
  filterDifficulties: string[];
  intentResultIds: string[] | null;
  intentMatch: IntentMatch | null;
  mobileSidebarOpen: boolean;
  mobileNavOpen: boolean;
  // 子场景工作台
  selectedTaskPackId: string | null;
  selectedStageId: string | null;
  expandedStageIds: Record<string, boolean>;
  expandedSceneCategoryIds: Record<string, boolean>; // v2: 左栏二级树展开状态
  /** 工作台侧栏底部上下文区折叠态（持久化） */
  contextSectionExpanded: boolean;
  /** 上下文编辑器弹窗状态（不持久化）；editId=null 表示新建 */
  contextEditor: { open: boolean; editId: string | null };
  /** 待提交态：v3 引入「先填后存」流程；非空时中栏渲染 TaskPackDraftForm */
  draftTaskPack: TaskPackDraft | null;
  runningPromptId: string | null;
  runningTaskPackId: string | null;
  setSelectedScenario: (id: string | null) => void;
  setSelectedPrompt: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setDetailOpen: (b: boolean) => void;
  setFilterTaskTypes: (types: string[]) => void;
  setFilterDifficulties: (diffs: string[]) => void;
  setIntentResultIds: (ids: string[] | null) => void;
  setIntentMatch: (m: IntentMatch | null) => void;
  setMobileSidebarOpen: (b: boolean) => void;
  setMobileNavOpen: (b: boolean) => void;
  setSelectedTaskPack: (id: string | null) => void;
  setSelectedStage: (id: string | null) => void;
  toggleStageExpanded: (stageId: string) => void;
  toggleSceneCategoryExpanded: (sceneId: string) => void;
  setSceneCategoryExpanded: (sceneId: string, expanded: boolean) => void;
  toggleContextSection: () => void;
  setContextSectionExpanded: (expanded: boolean) => void;
  openContextEditor: (editId?: string | null) => void;
  closeContextEditor: () => void;
  openRunner: (promptId: string, taskPackId?: string) => void;
  closeRunner: () => void;
  // v3 草稿态
  beginCreateTaskPack: (presetSceneId?: string) => void;
  updateDraftTaskPack: (patch: Partial<TaskPackDraft>) => void;
  cancelDraftTaskPack: () => void;
  setDraftTaskPack: (draft: TaskPackDraft | null) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      selectedScenarioId: null,
      selectedPromptId: null,
      searchQuery: "",
      detailOpen: false,
      filterTaskTypes: [],
      filterDifficulties: [],
      intentResultIds: null,
      intentMatch: null,
      mobileSidebarOpen: false,
      mobileNavOpen: false,
      selectedTaskPackId: null,
      selectedStageId: null,
      expandedStageIds: {},
      expandedSceneCategoryIds: {},
      contextSectionExpanded: false,
      contextEditor: { open: false, editId: null },
      draftTaskPack: null,
      runningPromptId: null,
      runningTaskPackId: null,
      setSelectedScenario: (id) =>
        set({ selectedScenarioId: id, mobileSidebarOpen: false }),
      setSelectedPrompt: (id) => set({ selectedPromptId: id, detailOpen: !!id }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setDetailOpen: (b) => set({ detailOpen: b }),
      setFilterTaskTypes: (filterTaskTypes) => set({ filterTaskTypes }),
      setFilterDifficulties: (filterDifficulties) => set({ filterDifficulties }),
      setIntentResultIds: (intentResultIds) => set({ intentResultIds }),
      setIntentMatch: (intentMatch) => set({ intentMatch }),
      setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
      setSelectedTaskPack: (id) =>
        set({
          selectedTaskPackId: id,
          selectedStageId: null,
          expandedStageIds: id ? {} : {},
          draftTaskPack: null,
        }),
      setSelectedStage: (id) => set({ selectedStageId: id }),
      toggleStageExpanded: (stageId) =>
        set((s) => ({
          expandedStageIds: {
            ...s.expandedStageIds,
            [stageId]: !s.expandedStageIds[stageId],
          },
        })),
      toggleSceneCategoryExpanded: (sceneId) =>
        set((s) => ({
          expandedSceneCategoryIds: {
            ...s.expandedSceneCategoryIds,
            [sceneId]: !s.expandedSceneCategoryIds[sceneId],
          },
        })),
      setSceneCategoryExpanded: (sceneId, expanded) =>
        set((s) => ({
          expandedSceneCategoryIds: {
            ...s.expandedSceneCategoryIds,
            [sceneId]: expanded,
          },
        })),
      toggleContextSection: () =>
        set((s) => ({ contextSectionExpanded: !s.contextSectionExpanded })),
      setContextSectionExpanded: (expanded) =>
        set({ contextSectionExpanded: expanded }),
      openContextEditor: (editId = null) =>
        set({
          contextEditor: { open: true, editId },
          contextSectionExpanded: true,
        }),
      closeContextEditor: () =>
        set((s) => ({ contextEditor: { ...s.contextEditor, open: false } })),
      openRunner: (promptId, taskPackId) =>
        set({
          runningPromptId: promptId,
          runningTaskPackId: taskPackId ?? null,
        }),
      closeRunner: () =>
        set({ runningPromptId: null, runningTaskPackId: null }),
      beginCreateTaskPack: (presetSceneId) =>
        set({
          draftTaskPack: {
            title: "",
            goal: "",
            sceneCategoryId: presetSceneId ?? "",
          },
          selectedTaskPackId: null,
          selectedStageId: null,
          selectedPromptId: null,
        }),
      updateDraftTaskPack: (patch) =>
        set((s) =>
          s.draftTaskPack
            ? { draftTaskPack: { ...s.draftTaskPack, ...patch } }
            : {}
        ),
      cancelDraftTaskPack: () => set({ draftTaskPack: null }),
      setDraftTaskPack: (draft) => set({ draftTaskPack: draft }),
    }),
    {
      name: "prompt-os-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        expandedSceneCategoryIds: s.expandedSceneCategoryIds,
        contextSectionExpanded: s.contextSectionExpanded,
      }),
    }
  )
);
