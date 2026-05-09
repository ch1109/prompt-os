import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Sparkles, X } from "lucide-react";
import { db } from "@/db";
import { createPrompt, updatePrompt } from "@/db/repos/promptRepo";
import { suggestTitle } from "@/services/titleSuggester";
import { toast } from "@/store/toastStore";
import type { Difficulty, Prompt, TaskType, ValueLevel } from "@/types";

const TASK_TYPES: TaskType[] = ["分析", "生成", "改写", "总结", "规划", "决策", "复盘"];
const DIFFS: Difficulty[] = ["初级", "中级", "高级"];
const VALUES: ValueLevel[] = ["高频", "高价值", "战略型", "辅助型"];

type FormState = Partial<Prompt> & { title: string; body: string };

const DEFAULT_FORM: FormState = {
  title: "",
  body: "",
  summary: "",
  taskType: "生成",
  difficulty: "初级",
  valueLevel: "高频",
  primaryScenario: [],
  tags: [],
  inputRequirements: "",
  outputFormat: "",
  boundaries: "",
  shareable: true,
};

interface Props {
  open: boolean;
  editId?: string | null;
  onClose: () => void;
}

export function PromptEditor({ open, editId, onClose }: Props) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [naming, setNaming] = useState(false);
  const allContexts = useLiveQuery(() => db.contexts.toArray()) ?? [];

  useEffect(() => {
    if (!open) return;
    if (editId) {
      db.prompts.get(editId).then((p) => {
        if (p) setForm(p as FormState);
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [open, editId]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("标题和正文不能为空");
      return;
    }
    if (editId) {
      await updatePrompt(editId, form);
    } else {
      await createPrompt(form);
    }
    onClose();
  }

  async function handleAINaming() {
    if (!form.body.trim()) {
      toast.error("请先填写正文");
      return;
    }
    setNaming(true);
    try {
      const r = await suggestTitle(form.body);
      setForm((f) => ({
        ...f,
        title: r.title || f.title,
        summary: f.summary?.trim() ? f.summary : r.summary || f.summary,
      }));
      toast.success("已为你生成标题与摘要");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI 起名失败");
    } finally {
      setNaming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 md:items-center md:p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden bg-paper shadow-2xl md:max-h-[90vh] md:rounded-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line p-4 md:border-0 md:px-6 md:py-5">
          <h3 className="text-lg font-semibold text-ink">{editId ? "编辑" : "新建"} Prompt</h3>
          <button onClick={onClose} className="rounded p-1 hover:bg-soft" aria-label="关闭">
            <X size={18} className="text-hint hover:text-ink" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 md:px-6 md:pt-2">
        <div className="space-y-3 text-sm">
          <Field label="标题 *">
            <div className="flex gap-2">
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="动词 + 任务对象，如「生成会议纪要」"
                className="input flex-1"
              />
              <button
                type="button"
                onClick={handleAINaming}
                disabled={naming}
                title="根据正文调用 AI 生成标题与摘要"
                className="inline-flex items-center gap-1 rounded border border-accent/40 bg-accent/[0.06] px-2.5 text-xs font-medium text-accent hover:bg-accent/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles size={12} />
                {naming ? "生成中…" : "AI 起名"}
              </button>
            </div>
          </Field>

          <Field label="正文 *（复制时只复制此内容）">
            <textarea
              rows={6}
              value={form.body}
              onChange={(e) => set("body", e.target.value)}
              placeholder="输入 Prompt 正文内容…"
              className="input resize-y"
            />
          </Field>

          <Field label="摘要">
            <input
              value={form.summary ?? ""}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="一句话描述用途"
              className="input"
            />
          </Field>

          <Field label="任务意图">
            <input
              value={form.taskIntent ?? ""}
              onChange={(e) => set("taskIntent", e.target.value)}
              placeholder="该 Prompt 解决的真实问题（一句话）"
              className="input"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="任务类型">
              <select value={form.taskType} onChange={(e) => set("taskType", e.target.value as TaskType)} className="input">
                {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="难度">
              <select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value as Difficulty)} className="input">
                {DIFFS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="价值等级">
              <select value={form.valueLevel} onChange={(e) => set("valueLevel", e.target.value as ValueLevel)} className="input">
                {VALUES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </Field>
          </div>

          <Field label="主场景路径（逗号分隔，如：工作场景,汇报,周报）">
            <input
              value={(form.primaryScenario ?? []).join(",")}
              onChange={(e) =>
                set("primaryScenario", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))
              }
              className="input"
            />
          </Field>

          <Field label="标签（逗号分隔）">
            <input
              value={(form.tags ?? []).join(",")}
              onChange={(e) =>
                set("tags", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))
              }
              placeholder="写作, 分析, 学习…"
              className="input"
            />
          </Field>

          <Field label="输入要求">
            <textarea
              rows={2}
              value={form.inputRequirements ?? ""}
              onChange={(e) => set("inputRequirements", e.target.value)}
              className="input resize-none"
            />
          </Field>

          <Field label="输出格式">
            <textarea
              rows={2}
              value={form.outputFormat ?? ""}
              onChange={(e) => set("outputFormat", e.target.value)}
              className="input resize-none"
            />
          </Field>

          <Field label="适用边界">
            <textarea
              rows={2}
              value={form.boundaries ?? ""}
              onChange={(e) => set("boundaries", e.target.value)}
              className="input resize-none"
            />
          </Field>

          {allContexts.length > 0 && (
            <Field label="绑定上下文（调用此 Prompt 时自动勾选）">
              <div className="max-h-32 overflow-y-auto space-y-0.5 rounded border border-border/60 p-1">
                {allContexts.map((c) => {
                  const ids = form.boundContextIds ?? [];
                  const checked = ids.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded px-1.5 py-1 hover:bg-muted cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? ids.filter((x) => x !== c.id)
                            : [...ids, c.id];
                          set("boundContextIds", next);
                        }}
                      />
                      <span className="text-xs">
                        {c.title} <span className="text-foreground/40">· {c.type}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </Field>
          )}
        </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-paper p-4 md:px-6 md:py-4">
          <button onClick={onClose} className="rounded px-4 py-1.5 text-sm text-sub hover:bg-soft">
            取消
          </button>
          <button
            onClick={submit}
            className="rounded bg-moss px-4 py-1.5 text-sm font-medium text-paper hover:bg-moss/90"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-hint">{label}</div>
      {children}
    </label>
  );
}
