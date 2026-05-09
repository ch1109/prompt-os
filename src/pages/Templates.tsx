import { useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Upload, Share2, Info } from "lucide-react";
import { db } from "@/db";
import {
  exportTemplate,
  importTemplateFromFile,
  type TemplateMeta,
} from "@/services/templateExport";
import { publishTemplate } from "@/services/share";
import { isSupabaseConfigured } from "@/services/supabase";
import { toast } from "@/store/toastStore";

type Tab = "prompts" | "contexts" | "scenarios";

const TABS: { key: Tab; label: string }[] = [
  { key: "prompts", label: "Prompt" },
  { key: "contexts", label: "上下文" },
  { key: "scenarios", label: "场景" },
];

const EMPTY_META: TemplateMeta = {
  title: "",
  description: "",
  audience: "",
  recommendedPath: "",
  boundaries: "",
};

export default function Templates() {
  const prompts = useLiveQuery(() => db.prompts.toArray()) ?? [];
  const contexts = useLiveQuery(() => db.contexts.toArray()) ?? [];
  const scenarios = useLiveQuery(() => db.scenarios.toArray()) ?? [];

  const [tab, setTab] = useState<Tab>("prompts");
  const [meta, setMeta] = useState<TemplateMeta>(EMPTY_META);
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [selectedContextIds, setSelectedContextIds] = useState<Set<string>>(new Set());
  const [selectedScenarioIds, setSelectedScenarioIds] = useState<Set<string>>(new Set());

  const [importMsg, setImportMsg] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [publishing, setPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(
    () => ({
      prompts: selectedPromptIds.size || prompts.length,
      contexts: selectedContextIds.size,
      scenarios: selectedScenarioIds.size,
    }),
    [selectedPromptIds, selectedContextIds, selectedScenarioIds, prompts.length]
  );

  function buildSelection() {
    return {
      promptIds: selectedPromptIds.size > 0 ? [...selectedPromptIds] : prompts.map((p) => p.id),
      workflowIds: [],
      contextIds: [...selectedContextIds],
      scenarioIds: [...selectedScenarioIds],
      meta: meta.title.trim() ? meta : undefined,
    };
  }

  async function handleExport() {
    await exportTemplate(buildSelection());
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const r = await importTemplateFromFile(file);
      const parts: string[] = [];
      if (r.meta?.title) parts.push(`模板「${r.meta.title}」`);
      const counts: string[] = [];
      if (r.prompts) counts.push(`${r.prompts} 条 Prompt`);
      if (r.contexts) counts.push(`${r.contexts} 个上下文`);
      if (r.scenarios) counts.push(`${r.scenarios} 个场景`);
      if (counts.length) parts.push(`已导入 ${counts.join("、")}`);
      const conflicts: string[] = [];
      if (r.conflictedPrompts) conflicts.push(`${r.conflictedPrompts} 条 Prompt`);
      if (r.conflictedContexts) conflicts.push(`${r.conflictedContexts} 个上下文`);
      if (r.conflictedScenarios) conflicts.push(`${r.conflictedScenarios} 个场景`);
      if (conflicts.length) {
        parts.push(`其中 ${conflicts.join("、")} 与本地 id 冲突已自动分配新 id（本地数据未被覆盖）`);
      }
      setImportMsg(parts.join("；"));
    } catch (err) {
      setImportMsg(err instanceof Error ? `导入失败：${err.message}` : "导入失败，请检查文件格式");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handlePublish() {
    if (!meta.title.trim()) return;
    setPublishing(true);
    try {
      const ids = selectedPromptIds.size > 0 ? [...selectedPromptIds] : prompts.map((p) => p.id);
      const url = await publishTemplate(meta.title, meta.description, ids);
      setShareUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <div className="mx-auto max-w-3xl p-4 space-y-6 page-enter">
      <h1 className="text-lg font-semibold">模板管理</h1>

      {/* 元信息 */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-1.5">
          <Info size={14} className="text-accent" />
          <h2 className="font-medium text-sm">模板元信息（可选，导出/分享时附带）</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="标题">
            <input
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
              placeholder="如：内容创作者复利系统"
              className="input"
            />
          </Field>
          <Field label="适用人群">
            <input
              value={meta.audience}
              onChange={(e) => setMeta({ ...meta, audience: e.target.value })}
              placeholder="如：自媒体新手 / 写作者"
              className="input"
            />
          </Field>
        </div>
        <Field label="描述">
          <textarea
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            rows={2}
            className="input resize-none"
            placeholder="模板核心价值"
          />
        </Field>
        <Field label="推荐使用路径">
          <textarea
            value={meta.recommendedPath}
            onChange={(e) => setMeta({ ...meta, recommendedPath: e.target.value })}
            rows={2}
            className="input resize-none"
            placeholder="如：先用 X Prompt 生成大纲 → 再用 Y 工作流细化 → 最后..."
          />
        </Field>
        <Field label="适用边界">
          <textarea
            value={meta.boundaries}
            onChange={(e) => setMeta({ ...meta, boundaries: e.target.value })}
            rows={2}
            className="input resize-none"
            placeholder="不适合用于...或在以下情况下..."
          />
        </Field>
      </div>

      {/* 导出 / 导入 */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-medium text-sm">本地导出 / 导入</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Download size={14} />
            导出（{totals.prompts} P · {totals.contexts} C · {totals.scenarios} S）
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Upload size={14} /> 导入 .promptos.json
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.promptos.json"
            className="hidden"
            onChange={handleImport}
          />
        </div>
        <p className="text-xs text-foreground/45">
          P=Prompt · C=上下文 · S=场景。Prompt 不勾选时默认全选；其余类需主动勾选。
        </p>
        {importMsg && (
          <p className="rounded bg-muted px-3 py-2 text-xs text-foreground/70">{importMsg}</p>
        )}
      </div>

      {/* 在线分享 */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h2 className="font-medium text-sm">在线分享（需 Supabase）</h2>
        {!isSupabaseConfigured() && (
          <p className="text-xs text-foreground/50">
            在线分享需要配置 Supabase。请在项目根目录创建{" "}
            <code className="bg-muted px-1 rounded">.env.local</code> 并添加
            <code className="bg-muted px-1 rounded ml-1">VITE_SUPABASE_URL</code> 和
            <code className="bg-muted px-1 rounded ml-1">VITE_SUPABASE_ANON_KEY</code>。
          </p>
        )}
        <button
          onClick={handlePublish}
          disabled={!isSupabaseConfigured() || !meta.title.trim() || publishing}
          className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90 disabled:opacity-40"
        >
          <Share2 size={14} />
          {publishing ? "发布中…" : `发布 ${totals.prompts} 条 Prompt`}
        </button>
        {!meta.title.trim() && isSupabaseConfigured() && (
          <p className="text-xs text-foreground/45">请先在「模板元信息」填写标题</p>
        )}
        {shareUrl && (
          <div className="rounded-lg bg-muted p-3 space-y-1">
            <p className="text-xs text-foreground/60">分享链接：</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs break-all">{shareUrl}</code>
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="shrink-0 rounded border px-2 py-0.5 text-xs hover:bg-background"
              >
                复制
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 多 Tab 选择 */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">选择资产</h2>
          <div className="flex items-center gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded px-2 py-0.5 text-xs ${
                  tab === t.key
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-foreground/55 hover:bg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "prompts" && (
          <SelectionList
            items={prompts.map((p) => ({ id: p.id, label: p.title }))}
            selected={selectedPromptIds}
            onToggle={(id) => toggle(selectedPromptIds, id, setSelectedPromptIds)}
            onSelectAll={() => setSelectedPromptIds(new Set(prompts.map((p) => p.id)))}
            onClear={() => setSelectedPromptIds(new Set())}
            emptyHint="未勾选则导出全部"
          />
        )}
        {tab === "contexts" && (
          <SelectionList
            items={contexts.map((c) => ({ id: c.id, label: `${c.title} · ${c.type}` }))}
            selected={selectedContextIds}
            onToggle={(id) => toggle(selectedContextIds, id, setSelectedContextIds)}
            onSelectAll={() => setSelectedContextIds(new Set(contexts.map((c) => c.id)))}
            onClear={() => setSelectedContextIds(new Set())}
            emptyHint="勾选后才会包含在导出中"
          />
        )}
        {tab === "scenarios" && (
          <SelectionList
            items={scenarios.map((s) => ({ id: s.id, label: s.fullPath.join(" / ") }))}
            selected={selectedScenarioIds}
            onToggle={(id) => toggle(selectedScenarioIds, id, setSelectedScenarioIds)}
            onSelectAll={() => setSelectedScenarioIds(new Set(scenarios.map((s) => s.id)))}
            onClear={() => setSelectedScenarioIds(new Set())}
            emptyHint="勾选后才会包含在导出中"
          />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-foreground/60">{label}</div>
      {children}
    </label>
  );
}

function SelectionList({
  items,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  emptyHint,
}: {
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  emptyHint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <button onClick={onSelectAll} className="rounded border px-2 py-0.5 hover:bg-muted">
          全选 ({items.length})
        </button>
        <button onClick={onClear} className="rounded border px-2 py-0.5 hover:bg-muted">
          清空
        </button>
        <span className="text-foreground/40">已选 {selected.size}</span>
        {emptyHint && selected.size === 0 && (
          <span className="text-foreground/40 ml-auto">{emptyHint}</span>
        )}
      </div>
      <div className="max-h-56 overflow-y-auto space-y-0.5 rounded border border-border/60">
        {items.length === 0 ? (
          <p className="p-3 text-center text-xs text-foreground/40">暂无数据</p>
        ) : (
          items.map((it) => (
            <label
              key={it.id}
              className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(it.id)}
                onChange={() => onToggle(it.id)}
                className="shrink-0"
              />
              <span className="text-xs truncate">{it.label}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
