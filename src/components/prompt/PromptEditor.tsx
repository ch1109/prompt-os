import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { db } from "@/db";
import { createPrompt, updatePrompt } from "@/db/repos/promptRepo";
import { suggestTitle } from "@/services/titleSuggester";
import { toast } from "@/store/toastStore";
import type { Prompt } from "@/types";

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

  useEffect(() => {
    if (!open) return;
    if (editId) {
      db.prompts.get(editId).then((p) => {
        if (p) setForm(p as FormState);
      });
    } else {
      queueMicrotask(() => setForm(DEFAULT_FORM));
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
