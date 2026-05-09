import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { ArrowRight, X } from "lucide-react";
import { db } from "@/db";
import { createTaskPack } from "@/db/repos/taskPackRepo";
import { useUI } from "@/store/uiStore";
import { toast } from "@/store/toastStore";

/**
 * 待提交态：新建子场景的引导式表单
 * 取消时不写 db；提交时写入并 setSelectedTaskPack 切换到工作区
 */
export function TaskPackDraftForm() {
  const {
    draftTaskPack,
    updateDraftTaskPack,
    cancelDraftTaskPack,
    setSelectedTaskPack,
    setSceneCategoryExpanded,
  } = useUI();

  const allScenariosRaw = useLiveQuery(() => db.scenarios.toArray());
  const allScenarios = useMemo(
    () => allScenariosRaw ?? [],
    [allScenariosRaw]
  );
  const firstLevel = useMemo(
    () => allScenarios.filter((s) => s.level === 1),
    [allScenarios]
  );

  const titleRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<{ title?: boolean; scene?: boolean }>(
    {}
  );

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // 自动选第一个场景作为默认值（如果未预设）
  useEffect(() => {
    if (!draftTaskPack) return;
    if (!draftTaskPack.sceneCategoryId && firstLevel.length > 0) {
      updateDraftTaskPack({ sceneCategoryId: firstLevel[0].id });
    }
  }, [draftTaskPack, firstLevel, updateDraftTaskPack]);

  if (!draftTaskPack) return null;

  const titleValid = draftTaskPack.title.trim().length > 0;
  const sceneValid = draftTaskPack.sceneCategoryId.length > 0;
  const canSubmit = titleValid && sceneValid; // goal 选填，不参与校验

  const selectedSceneTitle = firstLevel.find(
    (s) => s.id === draftTaskPack.sceneCategoryId
  )?.title;
  const goalPlaceholder = getGoalPlaceholder(selectedSceneTitle);

  async function submit() {
    if (!draftTaskPack || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const pack = await createTaskPack({
        title: draftTaskPack.title.trim(),
        goal: draftTaskPack.goal.trim(),
        description: "",
        sceneCategoryId: draftTaskPack.sceneCategoryId,
        stages: [
          {
            id: nanoid(),
            name: "",
            description: "",
            promptIds: [],
            order: 0,
          },
        ],
        tags: [],
      });
      setSceneCategoryExpanded(pack.sceneCategoryId, true);
      setSelectedTaskPack(pack.id);
      toast.success("已创建，开始填充阶段");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
      setSubmitting(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelDraftTaskPack();
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <div
      className="page-enter mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-10"
      onKeyDown={onKeyDown}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="mono rounded bg-amber-soft px-1.5 py-0.5 text-[10.5px] uppercase tracking-wider2 text-amber">
          草稿
        </span>
        <span className="text-[12px] text-hint">尚未保存</span>
        <button
          onClick={cancelDraftTaskPack}
          title="放弃草稿"
          className="ml-auto rounded p-1 text-hint hover:bg-soft hover:text-red-500"
        >
          <X size={14} strokeWidth={1.6} />
        </button>
      </div>

      <h1 className="serif mb-1 text-[26px] font-semibold leading-snug tracking-tight text-ink">
        新建子场景
      </h1>
      <p className="mb-8 text-[13px] leading-relaxed text-sub">
        起个名字、选一个场景就可以创建。目标和阶段都可以稍后再补。
      </p>

      <div className="space-y-5">
        <Field
          label="子场景名称"
          required
          error={touched.title && !titleValid ? "名称不能为空" : undefined}
        >
          <input
            ref={titleRef}
            value={draftTaskPack.title}
            onChange={(e) => updateDraftTaskPack({ title: e.target.value })}
            onBlur={() => setTouched((t) => ({ ...t, title: true }))}
            placeholder="如「深度读完一本书」"
            className="input text-[15px]"
          />
        </Field>

        <Field
          label="一句话目标"
          hint="选填，可创建后再补"
        >
          <input
            value={draftTaskPack.goal}
            onChange={(e) => updateDraftTaskPack({ goal: e.target.value })}
            placeholder={goalPlaceholder}
            className="input"
          />
        </Field>

        <Field
          label="所属场景大类"
          required
          error={
            touched.scene && !sceneValid ? "请选择一个场景或先去左栏底部新建" : undefined
          }
        >
          {firstLevel.length === 0 ? (
            <div className="rounded border border-dashed border-line bg-canvas px-3 py-3 text-[12.5px] text-hint">
              还没有场景大类，去左栏底部点击「+ 新增场景大类」创建
            </div>
          ) : (
            <select
              value={draftTaskPack.sceneCategoryId}
              onChange={(e) =>
                updateDraftTaskPack({ sceneCategoryId: e.target.value })
              }
              onBlur={() => setTouched((t) => ({ ...t, scene: true }))}
              className="input"
            >
              <option value="">请选择…</option>
              {firstLevel.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-1.5 rounded bg-moss px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "创建中…" : "创建并开始"}
          <ArrowRight size={13} strokeWidth={2} />
        </button>
        <button
          onClick={cancelDraftTaskPack}
          className="rounded px-3 py-2 text-[13px] text-sub hover:bg-soft hover:text-ink"
        >
          取消
        </button>
        <span className="ml-auto text-[11px] text-hint">
          <kbd className="mono rounded border border-line bg-canvas px-1">⌘↵</kbd> 提交 ·
          <kbd className="mono ml-1 rounded border border-line bg-canvas px-1">esc</kbd>{" "}
          取消
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12.5px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
        {error ? (
          <span className="text-[11px] text-red-500">{error}</span>
        ) : hint ? (
          <span className="text-[11px] text-hint">{hint}</span>
        ) : null}
      </div>
      {children}
    </label>
  );
}

const GOAL_PLACEHOLDER_BY_SCENE: Record<string, string> = {
  读书场景: "如「从理解一本到输出文章」",
  写作场景: "如「把一个想法打磨成可发表文章」",
  商业场景: "如「拆解商业现象提炼可迁移结论」",
  工作场景: "如「把方案整理成可评审的完整文档」",
  学习场景: "如「把陌生知识转化为自己的体系」",
  个人成长场景: "如「复盘一次项目提炼可复用经验」",
  自媒体场景: "如「把灵感打磨成可发布的内容」",
  AI工具场景: "如「定义并优化一类 Prompt 工作流」",
};

function getGoalPlaceholder(sceneTitle: string | undefined): string {
  if (sceneTitle && GOAL_PLACEHOLDER_BY_SCENE[sceneTitle]) {
    return GOAL_PLACEHOLDER_BY_SCENE[sceneTitle];
  }
  return "一句话说明这个子场景要解决什么问题（选填）";
}
