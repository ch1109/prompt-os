import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { db } from "@/db";
import { createPrompt, updatePrompt } from "@/db/repos/promptRepo";
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
      alert("标题和正文不能为空");
      return;
    }
    if (editId) {
      await updatePrompt(editId, form);
    } else {
      await createPrompt(form);
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{editId ? "编辑" : "新建"} Prompt</h3>
          <button onClick={onClose}>
            <X size={18} className="text-foreground/40 hover:text-foreground" />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <Field label="标题 *">
            <input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="动词 + 任务对象，如「生成会议纪要」"
              className="input"
            />
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
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-1.5 text-sm text-foreground/60 hover:bg-muted">
            取消
          </button>
          <button
            onClick={submit}
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90"
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
      <div className="mb-1 text-xs text-foreground/50">{label}</div>
      {children}
    </label>
  );
}
