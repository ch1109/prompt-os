import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { Plus, Star, Trash2, X, ChevronDown, ChevronRight } from "lucide-react";
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
    <div className="page-enter mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-8">
      {/* 面包屑 */}
      <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-hint">
        {scene && (
          <>
            <span>{scene.title}</span>
            <span>/</span>
          </>
        )}
        <span className="text-sub">{pack.title || "未命名子场景"}</span>
      </div>

      {/* 标题 + hover 操作按钮 */}
      <div className="group mb-1.5 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <InlineEditable
            value={pack.title}
            onSubmit={handleTitleChange}
            placeholder="子场景名称"
            emptyHint="点击命名…"
            className="!px-2 !py-1 -ml-2 serif text-[26px] font-semibold leading-snug tracking-tight"
            inputClassName="!text-[26px] !font-semibold !leading-snug !py-1"
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5 pt-2 opacity-0 transition group-hover:opacity-100 [&_button]:rounded [&_button]:p-1.5 [&_button:hover]:bg-soft">
          <button
            onClick={() => toggleFavorite(pack.id)}
            title={pack.isFavorited ? "取消收藏" : "收藏"}
          >
            <Star
              size={15}
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
              size={15}
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
            <X size={15} strokeWidth={1.6} className="text-hint hover:text-ink" />
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
      <div className="-ml-2 mb-3">
        <InlineEditable
          value={pack.goal ?? ""}
          onSubmit={handleGoalChange}
          placeholder="一句话目标"
          emptyHint="点击补一句话目标，下次回来一眼就能想起做什么…"
          className="text-[14px] leading-relaxed text-sub"
        />
      </div>

      {/* 元信息 */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5 px-2 text-[11.5px] text-hint">
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
          className="ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] hover:bg-soft hover:text-sub"
        >
          {moreOpen ? (
            <>收起 <ChevronDown size={10} strokeWidth={2} /></>
          ) : (
            <>更多 <ChevronRight size={10} strokeWidth={2} /></>
          )}
        </button>
      </div>

      {/* 折叠：说明 / 标签 */}
      {moreOpen && (
        <div className="mb-6 space-y-3 border-l-2 border-line pl-3">
          <FieldBlock label="说明">
            <InlineEditable
              value={pack.description ?? ""}
              onSubmit={handleDescChange}
              placeholder="详细说明（选填）"
              emptyHint="补充更详细的说明…"
              multiline
              className="text-[13px] leading-relaxed"
            />
          </FieldBlock>
          <FieldBlock label="标签">
            <InlineEditable
              value={pack.tags.join(", ")}
              onSubmit={handleTagsChange}
              placeholder="逗号分隔，如：读书, 知识管理"
              emptyHint="点击添加标签…"
              className="text-[12.5px] mono"
            />
          </FieldBlock>
        </div>
      )}

      {/* 阶段列表 */}
      <div className="mt-6 space-y-4">
        {pack.stages.length === 0 ? (
          <div className="rounded border border-dashed border-line bg-canvas px-4 py-8 text-center text-[12.5px] text-hint">
            尚未添加阶段，点击下方按钮新建
          </div>
        ) : (
          pack.stages.map((stage, idx) => (
            <StageBlock
              key={stage.id}
              stage={stage}
              index={idx}
              packSceneTitle={scene?.title}
              selectedPromptId={selectedPromptId}
              forceOpenAdder={pendingAdderStageId === stage.id}
              onAdderConsumed={() => setPendingAdderStageId(null)}
              onClick={() => setSelectedStage(stage.id)}
              onPickPrompt={(promptId) => {
                setSelectedStage(stage.id);
                setSelectedPrompt(promptId);
              }}
              onRenameStage={(name) => updateStage(stage.id, { name })}
              onRemoveStage={() => removeStage(stage.id)}
              onRemovePrompt={(promptId) =>
                removePromptFromStage(stage.id, promptId)
              }
              onAddPrompt={(promptId) => addPromptToStage(stage.id, promptId)}
            />
          ))
        )}
        <button
          onClick={addStage}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-line py-2 text-[12.5px] text-hint transition hover:border-moss/50 hover:bg-soft/60 hover:text-moss"
        >
          <Plus size={13} strokeWidth={1.7} /> 添加阶段
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-[320px] px-6 text-center">
        <div className="serif mb-3 text-3xl text-ink/30">·</div>
        <p className="mb-1 text-[15px] font-medium text-ink">
          从左侧选择一个子场景
        </p>
        <p className="text-[13px] leading-relaxed text-sub">
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
      <div className="flex items-center gap-1 px-2 pb-0.5">
        {collapsible && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-hint hover:text-ink"
          >
            {collapsed ? (
              <ChevronRight size={11} strokeWidth={2} />
            ) : (
              <ChevronDown size={11} strokeWidth={2} />
            )}
          </button>
        )}
        <span className="mono text-[10.5px] font-medium uppercase tracking-wider2 text-hint">
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
      setAdderOpen(true);
      onAdderConsumed?.();
    }
  }, [forceOpenAdder, onAdderConsumed]);

  const promptsRaw = useLiveQuery(
    () => db.prompts.bulkGet(stage.promptIds),
    [stage.promptIds.join(",")]
  );
  const prompts = useMemo(() => promptsRaw ?? [], [promptsRaw]);

  return (
    <div onClick={onClick}>
      {/* 阶段标题行：圆数字徽章 + 大字阶段名 + hover 删除 */}
      <div className="group mb-2.5 flex items-center gap-2.5">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold tabular-nums text-paper">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <InlineEditable
            value={stage.name}
            onSubmit={onRenameStage}
            placeholder="阶段名"
            emptyHint="点击命名阶段…"
            autoEditOnMount={!stage.name}
            className="!py-0.5 -ml-2 text-[15px] font-medium"
            inputClassName="!text-[15px] !font-medium"
          />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveStage();
          }}
          title="删除阶段"
          className="rounded p-1 text-hint opacity-0 transition hover:bg-soft hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 size={12} strokeWidth={1.6} />
        </button>
      </div>

      {/* Prompt 卡片列表 */}
      <ul className="ml-8 space-y-1.5">
        {stage.promptIds.map((id, i) => {
          const p = prompts[i];
          if (!p) {
            return (
              <li
                key={id}
                className="group flex items-center gap-2 rounded border border-dashed border-line bg-canvas px-3 py-2 text-[12.5px] italic text-hint"
              >
                <span className="flex-1">该 Prompt 已被删除</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemovePrompt(id);
                  }}
                  title="移除引用"
                  className="rounded p-1 opacity-0 hover:bg-paper hover:text-red-500 group-hover:opacity-100"
                >
                  <X size={11} />
                </button>
              </li>
            );
          }
          const active = selectedPromptId === p.id;
          return (
            <PromptRow
              key={id}
              p={p}
              active={active}
              onPick={() => onPickPrompt(p.id)}
              onRemove={() => onRemovePrompt(p.id)}
            />
          );
        })}

        {/* 添加 Prompt 按钮（触发 popover） */}
        <li className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setAdderOpen(true);
            }}
            className="flex w-full items-center gap-1.5 rounded border border-dashed border-line bg-transparent px-3 py-2 text-left text-[12.5px] text-hint transition hover:border-moss/50 hover:bg-soft/60 hover:text-moss"
          >
            <Plus size={12} strokeWidth={1.7} /> 在这个阶段添加 Prompt
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
    </div>
  );
}

function PromptRow({
  p,
  active,
  onPick,
  onRemove,
}: {
  p: Prompt;
  active: boolean;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="group relative">
      <button
        onClick={onPick}
        className={`relative flex w-full flex-col items-start gap-0.5 overflow-hidden rounded-md border px-3 py-2 text-left transition-colors ${
          active
            ? "border-moss/50 bg-moss-soft text-ink"
            : "border-line bg-paper text-sub hover:border-line/80 hover:bg-soft/40 hover:text-ink"
        }`}
      >
        {active && (
          <span className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-moss" />
        )}
        <span className="block w-full truncate text-[13.5px] font-medium leading-snug text-ink">
          {p.title}
        </span>
        {p.summary && (
          <span className="block w-full truncate text-[11.5px] leading-relaxed text-hint">
            {p.summary}
          </span>
        )}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="从该阶段移除"
        className="absolute right-1.5 top-1.5 rounded p-1 text-hint opacity-0 transition hover:bg-canvas hover:text-red-500 group-hover:opacity-100"
      >
        <X size={11} />
      </button>
    </li>
  );
}
