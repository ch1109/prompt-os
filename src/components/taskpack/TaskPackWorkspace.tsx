import { useEffect, useMemo, useState } from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DraggableProvidedDragHandleProps,
  type DropResult,
} from "@hello-pangea/dnd";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import {
  Plus,
  Star,
  Trash2,
  X,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import {
  deleteTaskPack,
  toggleFavorite,
  updateTaskPack,
} from "@/db/repos/taskPackRepo";
import { confirm } from "@/store/confirmStore";
import type { Prompt, TaskStage } from "@/types";
import { InlineEditable } from "./InlineEditable";
import { AddPromptPopover } from "./AddPromptPopover";
import { TaskPackDraftForm } from "./TaskPackDraftForm";

const STAGE_DROPPABLE_ID = "task-pack-stages";
const PROMPT_DROPPABLE_PREFIX = "stage-prompts:";
const STAGE_TONES = [
  "flow-sky",
  "flow-mint",
  "flow-lilac",
  "flow-peach",
  "flow-lemon",
] as const;

function promptDroppableId(stageId: string): string {
  return `${PROMPT_DROPPABLE_PREFIX}${stageId}`;
}

function stageIdFromPromptDroppableId(droppableId: string): string | null {
  return droppableId.startsWith(PROMPT_DROPPABLE_PREFIX)
    ? droppableId.slice(PROMPT_DROPPABLE_PREFIX.length)
    : null;
}

function reorderList<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const next = Array.from(list);
  const [removed] = next.splice(startIndex, 1);
  next.splice(endIndex, 0, removed);
  return next;
}

export function TaskPackWorkspace() {
  const {
    selectedTaskPackId,
    setSelectedTaskPack,
    selectedPromptId,
    setSelectedPrompt,
    draftTaskPack,
    setSelectedStage,
  } = useUI();
  // 顶栏「+ 新增 Prompt」通过 dispatchEvent 触发；这里监听事件、记录目标阶段 id
  const [pendingAdderStageId, setPendingAdderStageId] = useState<string | null>(
    null
  );
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    function handler(e: Event) {
      const ce = e as CustomEvent<{ stageId: string }>;
      setPendingAdderStageId(ce.detail?.stageId ?? null);
    }
    window.addEventListener("workbench:open-add-prompt", handler);
    return () =>
      window.removeEventListener("workbench:open-add-prompt", handler);
  }, []);

  const pack = useLiveQuery(
    () => (selectedTaskPackId ? db.taskPacks.get(selectedTaskPackId) : undefined),
    [selectedTaskPackId]
  );
  const scene = useLiveQuery(
    () => (pack ? db.scenarios.get(pack.sceneCategoryId) : undefined),
    [pack?.sceneCategoryId]
  );

  if (draftTaskPack) {
    return <TaskPackDraftForm />;
  }

  if (!selectedTaskPackId || !pack) {
    return <EmptyState />;
  }

  const promptCount = pack.stages.reduce(
    (sum, s) => sum + s.promptIds.length,
    0
  );

  async function handleTitleChange(next: string) {
    if (!pack) return;
    await updateTaskPack(pack.id, {
      title: next.trim() || "未命名子场景",
    });
  }

  async function handleGoalChange(next: string) {
    if (!pack) return;
    await updateTaskPack(pack.id, { goal: next });
  }

  async function handleDescChange(next: string) {
    if (!pack) return;
    await updateTaskPack(pack.id, { description: next });
  }

  async function handleTagsChange(next: string) {
    if (!pack) return;
    const tags = next
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    await updateTaskPack(pack.id, { tags });
  }

  async function addStage() {
    if (!pack) return;
    const stage: TaskStage = {
      id: nanoid(),
      name: "",
      description: "",
      promptIds: [],
      order: pack.stages.length,
    };
    await updateTaskPack(pack.id, { stages: [...pack.stages, stage] });
  }

  async function updateStage(stageId: string, patch: Partial<TaskStage>) {
    if (!pack) return;
    const next = pack.stages.map((s) =>
      s.id === stageId ? { ...s, ...patch } : s
    );
    await updateTaskPack(pack.id, { stages: next });
  }

  async function removeStage(stageId: string) {
    if (!pack) return;
    const stage = pack.stages.find((s) => s.id === stageId);
    const ok = await confirm({
      title: "删除该阶段？",
      message: `阶段「${stage?.name || "未命名"}」及其下 ${
        stage?.promptIds.length ?? 0
      } 条 Prompt 引用将被移除（Prompt 本身不会被删除）。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await updateTaskPack(pack.id, {
      stages: pack.stages.filter((s) => s.id !== stageId),
    });
  }

  async function removePromptFromStage(stageId: string, promptId: string) {
    if (!pack) return;
    const next = pack.stages.map((s) =>
      s.id === stageId
        ? { ...s, promptIds: s.promptIds.filter((id) => id !== promptId) }
        : s
    );
    await updateTaskPack(pack.id, { stages: next });
    if (selectedPromptId === promptId) setSelectedPrompt(null);
  }

  async function addPromptToStage(stageId: string, promptId: string) {
    if (!pack) return;
    const next = pack.stages.map((s) =>
      s.id === stageId && !s.promptIds.includes(promptId)
        ? { ...s, promptIds: [...s.promptIds, promptId] }
        : s
    );
    await updateTaskPack(pack.id, { stages: next });
    setSelectedPrompt(promptId);
  }

  async function handleDragEnd(result: DropResult) {
    if (!pack || !result.destination) return;

    const { source, destination, type } = result;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (type === "STAGE") {
      await updateTaskPack(pack.id, {
        stages: reorderList(pack.stages, source.index, destination.index),
      });
      return;
    }

    const sourceStageId = stageIdFromPromptDroppableId(source.droppableId);
    const destinationStageId = stageIdFromPromptDroppableId(
      destination.droppableId
    );
    if (!sourceStageId || !destinationStageId) return;

    const sourceStage = pack.stages.find((s) => s.id === sourceStageId);
    const destinationStage = pack.stages.find((s) => s.id === destinationStageId);
    const promptId = sourceStage?.promptIds[source.index];
    if (!sourceStage || !destinationStage || !promptId) return;
    if (
      sourceStageId !== destinationStageId &&
      destinationStage.promptIds.includes(promptId)
    ) {
      return;
    }

    const next = pack.stages.map((stage) => ({
      ...stage,
      promptIds: [...stage.promptIds],
    }));
    const nextSourceStage = next.find((s) => s.id === sourceStageId);
    const nextDestinationStage = next.find((s) => s.id === destinationStageId);
    if (!nextSourceStage || !nextDestinationStage) return;

    const [movedPromptId] = nextSourceStage.promptIds.splice(source.index, 1);
    nextDestinationStage.promptIds.splice(destination.index, 0, movedPromptId);
    await updateTaskPack(pack.id, { stages: next });
    setSelectedStage(destinationStageId);
  }

  async function handleDelete() {
    if (!pack) return;
    const ok = await confirm({
      title: "删除子场景？",
      message: `「${pack.title}」会被删除，但其引用的 Prompt 不会被删除。`,
      confirmText: "删除",
      danger: true,
    });
    if (!ok) return;
    await deleteTaskPack(pack.id);
    setSelectedTaskPack(null);
    setSelectedPrompt(null);
  }

  return (
    <div className="page-enter mx-auto w-full max-w-5xl px-4 pt-6 pb-[50vh] md:px-5 md:pt-8 xl:px-10">
      {/* 面包屑 */}
      <div className="mb-3 flex min-w-0 items-center gap-1.5 text-[13px] text-hint">
        {scene && (
          <>
            <span className="min-w-0 truncate">{scene.title}</span>
            <span className="shrink-0">/</span>
          </>
        )}
        <span className="min-w-0 truncate text-sub">
          {pack.title || "未命名子场景"}
        </span>
      </div>

      {/* 标题 + hover 操作按钮 */}
      <div className="group mb-2 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <InlineEditable
            value={pack.title}
            onSubmit={handleTitleChange}
            placeholder="子场景名称"
            emptyHint="点击命名…"
            className="!px-2 !py-1 -ml-2 serif text-[28px] font-semibold leading-snug tracking-tight lg:text-[32px]"
            inputClassName="!text-[28px] !font-semibold !leading-snug !py-1 lg:!text-[32px]"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pt-2 opacity-0 transition group-hover:opacity-100 [&_button]:rounded-md [&_button]:p-2 [&_button:hover]:bg-soft">
          <button
            onClick={() => toggleFavorite(pack.id)}
            title={pack.isFavorited ? "取消收藏" : "收藏"}
          >
            <Star
              size={17}
              strokeWidth={1.6}
              className={
                pack.isFavorited
                  ? "fill-amber text-amber opacity-100"
                  : "text-hint hover:text-amber"
              }
            />
          </button>
          <button onClick={handleDelete} title="删除子场景">
            <Trash2
              size={17}
              strokeWidth={1.6}
              className="text-hint hover:text-red-500"
            />
          </button>
          <button
            onClick={() => {
              setSelectedTaskPack(null);
              setSelectedPrompt(null);
            }}
            title="关闭"
          >
            <X size={17} strokeWidth={1.6} className="text-hint hover:text-ink" />
          </button>
        </div>
        {/* 收藏星即使非 hover 也常显（如已收藏） */}
        {pack.isFavorited && (
          <button
            onClick={() => toggleFavorite(pack.id)}
            title="取消收藏"
            className="absolute hidden"
            aria-hidden
          />
        )}
      </div>

      {/* 目标副标题（inline edit） */}
      <div className="-ml-2 mb-4">
        <InlineEditable
          value={pack.goal ?? ""}
          onSubmit={handleGoalChange}
          placeholder="一句话目标"
          emptyHint="点击补一句话目标，下次回来一眼就能想起做什么…"
          className="text-[16px] leading-relaxed text-sub"
        />
      </div>

      {/* 元信息 */}
      <div className="mb-6 flex flex-wrap items-center gap-2 px-2 text-[13px] text-hint">
        <span>{pack.stages.length} 阶段</span>
        <span>·</span>
        <span>{promptCount} Prompt</span>
        {pack.useCount > 0 && (
          <>
            <span>·</span>
            <span>使用 {pack.useCount} 次</span>
          </>
        )}
        <button
          onClick={() => setMoreOpen((o) => !o)}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-soft hover:text-sub"
        >
          {moreOpen ? (
            <>收起 <ChevronDown size={12} strokeWidth={2} /></>
          ) : (
            <>更多 <ChevronRight size={12} strokeWidth={2} /></>
          )}
        </button>
      </div>

      {/* 折叠：说明 / 标签 */}
      {moreOpen && (
        <div className="mb-7 space-y-4 border-l-2 border-line pl-4">
          <FieldBlock label="说明">
            <InlineEditable
              value={pack.description ?? ""}
              onSubmit={handleDescChange}
              placeholder="详细说明（选填）"
              emptyHint="补充更详细的说明…"
              multiline
              className="text-[15px] leading-relaxed"
            />
          </FieldBlock>
          <FieldBlock label="标签">
            <InlineEditable
              value={pack.tags.join(", ")}
              onSubmit={handleTagsChange}
              placeholder="逗号分隔，如：读书, 知识管理"
              emptyHint="点击添加标签…"
              className="mono text-[13.5px]"
            />
          </FieldBlock>
        </div>
      )}

      {/* 阶段列表 */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId={STAGE_DROPPABLE_ID} type="STAGE">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="mt-7 space-y-5"
            >
              {pack.stages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-canvas px-5 py-10 text-center text-[14px] text-hint">
                  尚未添加阶段，点击下方按钮新建
                </div>
              ) : (
                pack.stages.map((stage, idx) => (
                  <Draggable
                    key={stage.id}
                    draggableId={`stage:${stage.id}`}
                    index={idx}
                  >
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        style={dragProvided.draggableProps.style}
                        className={snapshot.isDragging ? "relative z-20" : undefined}
                      >
                        <StageBlock
                          stage={stage}
                          index={idx}
                          packSceneTitle={scene?.title}
                          selectedPromptId={selectedPromptId}
                          dragHandleProps={dragProvided.dragHandleProps}
                          isDragging={snapshot.isDragging}
                          forceOpenAdder={pendingAdderStageId === stage.id}
                          onAdderConsumed={() => setPendingAdderStageId(null)}
                          onClick={() => setSelectedStage(stage.id)}
                          onPickPrompt={(promptId) => {
                            setSelectedStage(stage.id);
                            setSelectedPrompt(promptId);
                          }}
                          onRenameStage={(name) =>
                            updateStage(stage.id, { name })
                          }
                          onRemoveStage={() => removeStage(stage.id)}
                          onRemovePrompt={(promptId) =>
                            removePromptFromStage(stage.id, promptId)
                          }
                          onAddPrompt={(promptId) =>
                            addPromptToStage(stage.id, promptId)
                          }
                        />
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
              <button
                onClick={addStage}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-[14px] font-medium text-hint transition hover:border-moss/50 hover:bg-soft/60 hover:text-moss"
              >
                <Plus size={15} strokeWidth={1.7} /> 添加阶段
              </button>
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-[380px] px-6 text-center">
        <div className="serif mb-3 text-[40px] leading-none text-ink/30">·</div>
        <p className="mb-2 text-[18px] font-semibold text-ink">
          从左侧选择一个子场景
        </p>
        <p className="text-[15px] leading-relaxed text-sub">
          或在某个场景行 hover 时点击「+」<br />
          快速创建一个新子场景
        </p>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  children,
  collapsible = false,
  defaultCollapsed = false,
}: {
  label: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className="mb-2">
      <div className="flex items-center gap-1.5 px-2 pb-1">
        {collapsible && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-hint hover:text-ink"
          >
            {collapsed ? (
              <ChevronRight size={13} strokeWidth={2} />
            ) : (
              <ChevronDown size={13} strokeWidth={2} />
            )}
          </button>
        )}
        <span className="mono text-xs font-semibold uppercase tracking-wider2 text-hint">
          {label}
        </span>
      </div>
      {!collapsed && children}
    </div>
  );
}

interface StageBlockProps {
  stage: TaskStage;
  index: number;
  packSceneTitle?: string;
  selectedPromptId: string | null;
  forceOpenAdder?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
  onAdderConsumed?: () => void;
  onClick?: () => void;
  onPickPrompt: (promptId: string) => void;
  onRenameStage: (name: string) => void;
  onRemoveStage: () => void;
  onRemovePrompt: (promptId: string) => void;
  onAddPrompt: (promptId: string) => void;
}

function StageBlock({
  stage,
  index,
  packSceneTitle,
  selectedPromptId,
  forceOpenAdder,
  dragHandleProps,
  isDragging = false,
  onAdderConsumed,
  onClick,
  onPickPrompt,
  onRenameStage,
  onRemoveStage,
  onRemovePrompt,
  onAddPrompt,
}: StageBlockProps) {
  const [adderOpen, setAdderOpen] = useState(false);

  useEffect(() => {
    if (forceOpenAdder) {
      queueMicrotask(() => {
        setAdderOpen(true);
        onAdderConsumed?.();
      });
    }
  }, [forceOpenAdder, onAdderConsumed]);

  const promptsRaw = useLiveQuery(
    () => db.prompts.bulkGet(stage.promptIds),
    [stage.promptIds.join(",")]
  );
  const prompts = useMemo(() => promptsRaw ?? [], [promptsRaw]);
  const toneClass = STAGE_TONES[index % STAGE_TONES.length];

  return (
    <div
      onClick={onClick}
      className={`flow-stage-card ${toneClass} rounded-2xl px-3.5 py-3.5 transition ${
        isDragging ? "shadow-lg ring-1 ring-moss/20" : ""
      }`}
    >
      {/* 阶段标题行：圆数字徽章 + 大字阶段名 + hover 删除 */}
      <div className="group mb-3 flex items-center gap-3">
        <button
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          title="拖拽调整阶段位置"
          className="rounded-md p-1 text-hint opacity-0 transition hover:bg-soft hover:text-ink active:cursor-grabbing group-hover:opacity-100"
        >
          <GripVertical size={15} strokeWidth={1.7} />
        </button>
        <span className="flow-stage-index inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <InlineEditable
            value={stage.name}
            onSubmit={onRenameStage}
            placeholder="阶段名"
            emptyHint="点击命名阶段…"
            autoEditOnMount={!stage.name}
            className="!py-1 -ml-2 text-[17px] font-semibold"
            inputClassName="!text-[17px] !font-semibold"
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveStage();
          }}
          title="删除阶段"
          className="rounded-md p-1.5 text-hint opacity-0 transition hover:bg-soft hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 size={14} strokeWidth={1.6} />
        </button>
      </div>

      {/* Prompt 卡片列表 */}
      <Droppable droppableId={promptDroppableId(stage.id)} type="PROMPT">
        {(provided, snapshot) => (
          <ul
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`ml-10 space-y-2 rounded-xl transition ${
              snapshot.isDraggingOver ? "bg-soft/60 ring-1 ring-moss/20" : ""
            }`}
          >
            {stage.promptIds.map((id, i) => {
              const p = prompts[i];
              return (
                <Draggable
                  key={`${stage.id}:${id}`}
                  draggableId={`prompt:${stage.id}:${id}`}
                  index={i}
                >
                  {(dragProvided, dragSnapshot) => (
                    <li
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      style={dragProvided.draggableProps.style}
                      className={`group relative ${
                        dragSnapshot.isDragging ? "z-20" : ""
                      }`}
                    >
                      {p ? (
                        <PromptRow
                          p={p}
                          active={selectedPromptId === p.id}
                          toneClass={toneClass}
                          dragHandleProps={dragProvided.dragHandleProps}
                          isDragging={dragSnapshot.isDragging}
                          onPick={() => onPickPrompt(p.id)}
                          onRemove={() => onRemovePrompt(p.id)}
                        />
                      ) : (
                        <MissingPromptRow
                          dragHandleProps={dragProvided.dragHandleProps}
                          onRemove={() => onRemovePrompt(id)}
                        />
                      )}
                    </li>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}

            {/* 添加 Prompt 按钮（触发 popover） */}
            <li className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAdderOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line bg-transparent px-3.5 py-2.5 text-left text-[13.5px] text-hint transition hover:border-moss/50 hover:bg-soft/60 hover:text-moss"
              >
                <Plus size={14} strokeWidth={1.7} /> 在这个阶段添加 Prompt
              </button>
              {adderOpen && (
                <AddPromptPopover
                  existingPromptIds={stage.promptIds}
                  preferredSceneTitle={packSceneTitle}
                  onPick={(id) => {
                    onAddPrompt(id);
                    setAdderOpen(false);
                  }}
                  onClose={() => setAdderOpen(false)}
                />
              )}
            </li>
          </ul>
        )}
      </Droppable>
    </div>
  );
}

function MissingPromptRow({
  dragHandleProps,
  onRemove,
}: {
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-canvas px-2.5 py-2.5 text-[13.5px] italic text-hint">
      <button
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        title="拖拽调整 Prompt 位置"
        className="rounded-md p-1 text-hint hover:bg-paper hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={14} strokeWidth={1.7} />
      </button>
      <span className="min-w-0 flex-1">该 Prompt 已被删除</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="移除引用"
        className="rounded-md p-1.5 opacity-0 hover:bg-paper hover:text-red-500 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  );
}

function PromptRow({
  p,
  active,
  toneClass,
  dragHandleProps,
  isDragging = false,
  onPick,
  onRemove,
}: {
  p: Prompt;
  active: boolean;
  toneClass: string;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  isDragging?: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <button
        onClick={onPick}
        className={`flow-prompt-card ${toneClass} ${
          active ? "is-active" : ""
        } relative flex w-full flex-col items-start gap-1.5 overflow-hidden rounded-xl border py-3 pl-11 pr-10 text-left transition ${
          isDragging ? "shadow-lg ring-1 ring-moss/20" : ""
        }`}
      >
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="block min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug text-ink">
            {p.title}
          </span>
          {p.pendingReview && (
            <span className="chip-mono shrink-0 rounded-full border border-lilac/40 bg-lilac-soft px-2 py-0.5 text-[11px] font-semibold text-lilac">
              待优化
            </span>
          )}
        </span>
        {p.summary && (
          <span className="block w-full truncate text-[13px] leading-relaxed text-sub/75">
            {p.summary}
          </span>
        )}
      </button>
      <button
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        title="拖拽调整 Prompt 位置"
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-hint opacity-0 transition hover:bg-canvas hover:text-ink active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical size={14} strokeWidth={1.7} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="从该阶段移除"
        className="absolute right-2 top-2 rounded-md p-1.5 text-hint opacity-0 transition hover:bg-canvas hover:text-red-500 group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </>
  );
}
