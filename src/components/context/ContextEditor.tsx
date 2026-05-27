import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  createContext,
  getContext,
  getTriggerStrategy,
  updateContext,
} from "@/db/repos/contextRepo";
import type {
  Context,
  ContextScope,
  ContextScopeRefs,
  ContextTriggerConditions,
  ContextTriggerStrategy as Strategy,
  ContextType,
} from "@/types";
import { ContextTypeSelect } from "./ContextTypeSelect";
import { ContextTagInput } from "./ContextTagInput";
import { ContextTriggerStrategy } from "./ContextTriggerStrategy";
import { ContextScopeSelector } from "./ContextScopeSelector";
import { ContextVariableChips } from "./ContextVariableChips";
import { ContextPreviewPanel } from "./ContextPreviewPanel";

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}

const EMPTY_STATE = {
  title: "",
  description: "",
  type: "角色人格" as ContextType,
  content: "",
  tags: [] as string[],
  strategy: "manual" as Strategy,
  conditions: undefined as ContextTriggerConditions | undefined,
  scope: "global" as ContextScope,
  scopeRefs: undefined as ContextScopeRefs | undefined,
  enabled: true,
};

export function ContextEditor({ open, editId, onClose }: Props) {
  const [state, setState] = useState(EMPTY_STATE);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // 响应 open/editId 变化加载数据；setLoading/setState 与项目内其它编辑器（PromptEditor）一致。
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    if (editId) {
      setLoading(true);
      getContext(editId).then((c) => {
        if (!c) {
          setLoading(false);
          return;
        }
        setState({
          title: c.title,
          description: c.description ?? "",
          type: c.type,
          content: c.content,
          tags: [...(c.tags ?? [])],
          strategy: getTriggerStrategy(c),
          conditions: c.triggerConditions,
          scope: c.scope ?? "global",
          scopeRefs: c.scopeRefs,
          enabled: c.enabled ?? true,
        });
        setUpdatedAt(c.updatedAt);
        setLoading(false);
      });
    } else {
      setState(EMPTY_STATE);
      setUpdatedAt(null);
    }
  }, [open, editId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function patch<K extends keyof typeof EMPTY_STATE>(
    key: K,
    value: (typeof EMPTY_STATE)[K]
  ) {
    setState((s) => ({ ...s, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.title.trim() || !state.content.trim()) return;
    const payload: Partial<Context> & { title: string; content: string } = {
      title: state.title.trim(),
      description: state.description.trim(),
      type: state.type,
      content: state.content,
      tags: state.tags,
      triggerStrategy: state.strategy,
      triggerConditions:
        state.strategy === "conditional" ? state.conditions : undefined,
      scope: state.scope,
      scopeRefs: state.scope === "global" ? undefined : state.scopeRefs,
      enabled: state.enabled,
      isDefault: state.strategy === "always",
    };
    if (editId) {
      await updateContext(editId, payload);
    } else {
      await createContext(payload);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 md:items-start md:p-4 md:pt-10">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-5xl flex-col bg-paper shadow-xl md:rounded-xl md:max-h-[88vh]"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="flex flex-col">
            <h2 className="font-medium text-ink">
              {editId ? "编辑上下文" : "新建上下文"}
            </h2>
            <p className="text-[11px] text-hint">
              配置类型、内容、标签与触发策略；右侧实时反馈使用效果
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-sub">
              <input
                type="checkbox"
                checked={state.enabled}
                onChange={(e) => patch("enabled", e.target.checked)}
              />
              启用
            </label>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-hint hover:bg-soft hover:text-ink"
              aria-label="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* 左栏：编辑区 */}
          <div className="min-h-0 flex-1 overflow-y-auto border-line p-4 max-md:border-b md:border-r">
            {loading ? (
              <p className="text-sm text-hint">加载中…</p>
            ) : (
              <div className="space-y-4">
                <Field label="标题" required>
                  <input
                    value={state.title}
                    onChange={(e) => patch("title", e.target.value)}
                    className="input"
                    required
                    placeholder="例如：项目背景 · 大众点评推荐系统"
                  />
                </Field>

                <Field label="说明（可选）">
                  <input
                    value={state.description}
                    onChange={(e) => patch("description", e.target.value)}
                    className="input"
                    placeholder="一句话描述这条上下文的用途，便于检索"
                  />
                </Field>

                <Field label="类型">
                  <ContextTypeSelect
                    value={state.type}
                    onChange={(t) => patch("type", t)}
                  />
                </Field>

                <Field label="内容" required>
                  <textarea
                    value={state.content}
                    onChange={(e) => patch("content", e.target.value)}
                    rows={14}
                    className="input min-h-[280px] resize-y font-normal leading-relaxed"
                    required
                    placeholder="支持 Markdown。提示：用 {{变量名}} 标注待替换字段，会自动识别到右侧。"
                  />
                </Field>

                <Field label="变量识别">
                  <ContextVariableChips content={state.content} />
                </Field>

                <Field label="标签">
                  <ContextTagInput
                    value={state.tags}
                    onChange={(t) => patch("tags", t)}
                  />
                </Field>

                <Field label="触发策略">
                  <ContextTriggerStrategy
                    strategy={state.strategy}
                    onStrategyChange={(s) => patch("strategy", s)}
                    conditions={state.conditions}
                    onConditionsChange={(c) => patch("conditions", c)}
                  />
                </Field>

                <Field label="作用域">
                  <ContextScopeSelector
                    scope={state.scope}
                    onScopeChange={(s) => patch("scope", s)}
                    refs={state.scopeRefs}
                    onRefsChange={(r) => patch("scopeRefs", r)}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* 右栏：元信息 + 预览 */}
          <div className="min-h-0 overflow-y-auto p-4 md:w-[360px] md:shrink-0">
            <ContextPreviewPanel
              contextId={editId}
              content={state.content}
              updatedAt={updatedAt}
            />
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-paper px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-line bg-paper px-3 py-1.5 text-sm text-sub hover:bg-soft hover:text-ink"
          >
            取消
          </button>
          <button
            type="submit"
            className="rounded bg-moss px-3 py-1.5 text-sm text-paper hover:bg-moss/90"
          >
            {editId ? "保存" : "创建"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-sub">
        {label}
        {required && <span className="text-amber"> *</span>}
      </label>
      {children}
    </div>
  );
}
