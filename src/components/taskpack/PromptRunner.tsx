import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Check, Copy, Pencil, X } from "lucide-react";
import { db } from "@/db";
import { incrementUseCount as bumpPromptUse } from "@/db/repos/promptRepo";
import { incrementUseCount as bumpTaskPackUse } from "@/db/repos/taskPackRepo";
import { useUI } from "@/store/uiStore";
import { MarkdownView } from "@/components/MarkdownView";
import { toast } from "@/store/toastStore";
import {
  extractVariables,
  isLongValue,
  renderTemplate,
} from "@/services/templateVariables";
import { PromptEditor } from "@/components/prompt/PromptEditor";

interface Props {
  /** 显式传入则用 props，否则从 useUI().selectedPromptId 取 */
  promptId?: string | null;
  /** 显式传入则用 props，否则从 useUI().selectedTaskPackId 取（用于 incrementUseCount） */
  taskPackId?: string | null;
  /** 提供则在标题旁显示 ✕；常驻面板模式可不传 */
  onClose?: () => void;
  /** 弹窗内 vs 嵌入面板：影响 padding/min-height */
  mode?: "panel" | "dialog";
}

export function PromptRunner({
  promptId: promptIdProp,
  taskPackId: taskPackIdProp,
  onClose,
  mode = "panel",
}: Props) {
  const ctx = useUI();
  const promptId = promptIdProp !== undefined ? promptIdProp : ctx.selectedPromptId;
  const taskPackId =
    taskPackIdProp !== undefined ? taskPackIdProp : ctx.selectedTaskPackId;

  const prompt = useLiveQuery(
    () => (promptId ? db.prompts.get(promptId) : undefined),
    [promptId]
  );
  const taskPack = useLiveQuery(
    () => (taskPackId ? db.taskPacks.get(taskPackId) : undefined),
    [taskPackId]
  );

  const variables = useMemo(
    () => extractVariables(prompt?.body ?? ""),
    [prompt?.body]
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<"raw" | "filled" | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setValues({});
      setCopied(null);
    });
  }, [promptId]);

  const stageOfPrompt = useMemo(() => {
    if (!taskPack || !promptId) return null;
    const idx = taskPack.stages.findIndex((s) => s.promptIds.includes(promptId));
    if (idx < 0) return null;
    return { stage: taskPack.stages[idx], index: idx };
  }, [taskPack, promptId]);

  if (!promptId) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <div className="max-w-[320px]">
          <div className="serif mb-3 text-[40px] leading-none text-ink/30">·</div>
          <p className="mb-2 text-[17px] font-semibold text-ink">
            选中一个 Prompt 开始执行
          </p>
          <p className="text-[14.5px] leading-relaxed text-sub">
            点击中间区域阶段下的 Prompt，<br />
            自动识别变量并生成可复制的完整 Prompt
          </p>
        </div>
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-hint">
        Prompt 不存在或已被删除
      </div>
    );
  }

  const filled = renderTemplate(prompt.body, values);
  const noVariables = variables.length === 0;
  const filledCount = variables.filter((name) => (values[name] ?? "").trim()).length;
  const hasUnfilledVariables = !noVariables && filledCount < variables.length;

  async function copyText(text: string, kind: "raw" | "filled") {
    if (!prompt) return;
    await navigator.clipboard.writeText(text);
    await bumpPromptUse(prompt.id);
    if (taskPackId) await bumpTaskPackUse(taskPackId);
    setCopied(kind);
    toast.success("已复制 ✓");
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <>
      <div
        className={`flex h-full flex-col ${
          mode === "dialog" ? "" : "min-h-0"
        }`}
      >
        {/* 顶部 */}
        <div className="flex items-start gap-3 border-b border-line px-5 py-5">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs uppercase tracking-wider2 text-hint">
              当前 Prompt
            </p>
            <h2 className="serif truncate text-[22px] font-semibold leading-tight text-ink">
              {prompt.title}
            </h2>
            <p className="mt-2 text-[13.5px] text-sub">
              阶段：
              {stageOfPrompt
                ? stageOfPrompt.stage.name || `阶段 ${stageOfPrompt.index + 1}`
                : "独立 Prompt"}
            </p>
          </div>
          <button
            onClick={() => setEditorOpen(true)}
            title="编辑 Prompt"
            className="rounded-md p-2 text-hint hover:bg-soft hover:text-moss"
          >
            <Pencil size={17} strokeWidth={1.6} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              title="关闭"
              className="rounded-md p-2 text-hint hover:bg-soft hover:text-ink"
            >
              <X size={17} strokeWidth={1.6} />
            </button>
          )}
        </div>

        {/* 滚动区：无变量时仅 1 块，有变量时只展示原文和填空区 */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {noVariables ? (
            <Section
              title="Prompt"
              hint={prompt.body ? `${prompt.body.length} 字` : undefined}
            >
              <div className="rounded-2xl border border-line bg-canvas px-4 py-3.5">
                {prompt.body ? (
                  <MarkdownView text={prompt.body} />
                ) : (
                  <p className="text-[14px] italic text-hint">
                    Prompt 内容为空，点击右上角铅笔图标编辑
                  </p>
                )}
              </div>
            </Section>
          ) : (
            <>
              <Section title="原始 Prompt" hint={`${prompt.body.length} 字`}>
                <div className="rounded-2xl border border-line bg-canvas px-4 py-3.5">
                  <MarkdownView text={prompt.body} />
                </div>
              </Section>

              <Section
                title="变量填空区"
                hint={
                  <>
                    {filledCount}/{variables.length}
                    {hasUnfilledVariables && (
                      <span className="ml-2 text-amber">
                        未填变量保留原样
                      </span>
                    )}
                  </>
                }
              >
                <div className="space-y-3">
                  {variables.map((name) => {
                    const value = values[name] ?? "";
                    return (
                      <label key={name} className="block">
                        <span className="mono mb-1.5 block text-xs font-semibold text-sub">
                          {name}
                        </span>
                        <textarea
                          value={value}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              [name]: e.target.value,
                            }))
                          }
                          rows={isLongValue(value) ? 4 : 2}
                          placeholder={`填写 ${name}`}
                          className="input w-full resize-y text-[14.5px] leading-relaxed"
                        />
                      </label>
                    );
                  })}
                </div>
              </Section>
            </>
          )}
        </div>

        {/* 底部复制按钮 */}
        <div className="flex shrink-0 gap-2.5 border-t border-line bg-paper px-5 py-4">
          {noVariables ? (
            <button
              onClick={() => copyText(prompt.body, "filled")}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-moss py-2.5 text-[14px] font-semibold text-paper transition hover:bg-moss/90"
            >
              {copied === "filled" ? (
                <Check size={15} strokeWidth={2} />
              ) : (
                <Copy size={15} strokeWidth={1.7} />
              )}
              复制 Prompt
            </button>
          ) : (
            <>
              <button
                onClick={() => copyText(filled, "filled")}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-moss py-2.5 text-[14px] font-semibold text-paper transition hover:bg-moss/90"
              >
                {copied === "filled" ? (
                  <Check size={15} strokeWidth={2} />
                ) : (
                  <Copy size={15} strokeWidth={1.7} />
                )}
                复制完整 Prompt
              </button>
              <button
                onClick={() => copyText(prompt.body, "raw")}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-canvas py-2.5 text-[14px] font-semibold text-sub transition hover:bg-soft hover:text-ink"
              >
                {copied === "raw" ? (
                  <Check size={15} strokeWidth={2} className="text-moss" />
                ) : (
                  <Copy size={15} strokeWidth={1.7} />
                )}
                复制原 Prompt
              </button>
            </>
          )}
        </div>
      </div>
      <PromptEditor
        open={editorOpen}
        editId={prompt.id}
        onClose={() => setEditorOpen(false)}
      />
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-line/70 px-5 py-5 last:border-b-0">
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          {title}
        </span>
        {hint && (
          <span className="text-xs tabular-nums text-hint">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}
