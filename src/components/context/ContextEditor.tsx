import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { createContext, updateContext, getContext } from "@/db/repos/contextRepo";
import type { ContextType } from "@/types";

const CONTEXT_TYPES: ContextType[] = [
  "个人背景", "职业身份", "当前项目", "长期目标", "输出风格",
  "任务背景", "产品介绍", "用户画像", "品牌信息", "常用限制条件",
];

interface Props {
  open: boolean;
  editId: string | null;
  onClose: () => void;
}

export function ContextEditor({ open, editId, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ContextType>("个人背景");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editId) {
      getContext(editId).then((c) => {
        if (!c) return;
        setTitle(c.title);
        setType(c.type);
        setContent(c.content);
        setTags(c.tags.join(", "));
        setIsDefault(c.isDefault);
      });
    } else {
      setTitle("");
      setType("个人背景");
      setContent("");
      setTags("");
      setIsDefault(false);
    }
  }, [open, editId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const data = {
      title: title.trim(),
      type,
      content,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      isDefault,
    };
    if (editId) {
      await updateContext(editId, data);
    } else {
      await createContext(data);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16">
      <div className="w-full max-w-lg rounded-xl bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-medium">{editId ? "编辑上下文" : "新建上下文"}</h2>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-foreground/60">标题 *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/60">类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ContextType)}
              className="input"
            >
              {CONTEXT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/60">内容 *</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="input resize-none"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-foreground/60">标签（逗号分隔）</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            默认选中（调用 Prompt 时自动附加）
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded border px-3 py-1.5 text-sm hover:bg-muted">取消</button>
            <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90">
              {editId ? "保存" : "创建"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
