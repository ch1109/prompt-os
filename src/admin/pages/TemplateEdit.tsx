import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import {
  ArrowLeft,
  Save,
  Rocket,
  Search,
  Eye,
  AlertTriangle,
  Loader2,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import { db } from "@/db";
import type { Prompt, TaskPack, TaskStage } from "@/types";
import {
  createTemplate,
  updateTemplate,
  publishTemplate,
  getTemplate,
  type TemplateRecord,
} from "@/services/adminTemplate";
import { packTemplate } from "@/services/adminPackager";
import { toast } from "@/store/toastStore";
import { confirm } from "@/store/confirmStore";

type Tab = "prompts" | "scenarios" | "taskPacks";

const TABS: { key: Tab; label: string }[] = [
  { key: "prompts", label: "Prompts" },
  { key: "scenarios", label: "场景" },
  { key: "taskPacks", label: "任务包" },
];

interface PreselectedState {
  preselected?: {
    promptIds?: string[];
    scenarioIds?: string[];
    taskPackIds?: string[];
  };
  suggestedTitle?: string;
  suggestedAudience?: string;
}

export default function TemplateEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";
  const nav = useNavigate();
  const location = useLocation();

  // 从 router state 读取「主工作台一键打包」传过来的预选
  // 只在新建模板时生效
  const preset = (isNew ? (location.state as PreselectedState | null) : null) ?? null;
  const presetCount = preset?.preselected
    ? (preset.preselected.promptIds?.length ?? 0) +
      (preset.preselected.scenarioIds?.length ?? 0) +
      (preset.preselected.taskPackIds?.length ?? 0)
    : 0;

  const [tplId] = useState<string>(() => (isNew ? `tpl_${nanoid(12)}` : id!));
  const [loaded, setLoaded] = useState<TemplateRecord | null>(null);
  const [loading, setLoading] = useState(!isNew);

  const [title, setTitle] = useState(() => preset?.suggestedTitle ?? "");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState(() => preset?.suggestedAudience ?? "");

  const [tab, setTab] = useState<Tab>("prompts");
  const [query, setQuery] = useState("");
  const [selPrompts, setSelPrompts] = useState<Set<string>>(
    () => new Set(preset?.preselected?.promptIds ?? [])
  );
  const [selScenarios, setSelScenarios] = useState<Set<string>>(
    () => new Set(preset?.preselected?.scenarioIds ?? [])
  );
  const [selTaskPacks, setSelTaskPacks] = useState<Set<string>>(
    () => new Set(preset?.preselected?.taskPackIds ?? [])
  );
  // 提示条显示态：预选数 > 0 时显示，用户可手动关闭或点「清空预选」消失
  const [showPresetHint, setShowPresetHint] = useState(presetCount > 0);

  const [busy, setBusy] = useState<"save" | "publish" | null>(null);

  const allPrompts = useLiveQuery(() => db.prompts.toArray()) ?? [];
  const allScenarios = useLiveQuery(() => db.scenarios.toArray()) ?? [];
  const allTaskPacks = useLiveQuery(() => db.taskPacks.toArray()) ?? [];

  // 加载已有模板
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      try {
        const t = await getTemplate(tplId);
        if (cancelled) return;
        if (!t) {
          toast.error("模板不存在");
          nav("/admin/templates");
          return;
        }
        setLoaded(t);
        setTitle(t.title);
        setDescription(t.description);
        setAudience(t.audience ?? "");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tplId, isNew, nav]);

  const isReadOnlyPayload = loaded?.status !== "draft" && !isNew;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tab === "prompts") {
      return allPrompts.filter(
        (p) => !q || p.title.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q)
      );
    }
    if (tab === "scenarios") {
      return allScenarios
        .filter((s) => s.level === 1 || s.level === 2 || s.level === 3)
        .filter((s) => !q || s.title.toLowerCase().includes(q));
    }
    return allTaskPacks.filter(
      (t) => !q || t.title.toLowerCase().includes(q) || t.goal?.toLowerCase().includes(q)
    );
  }, [tab, query, allPrompts, allScenarios, allTaskPacks]);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
  }

  async function handleSave(publishAfter: boolean) {
    if (!title.trim()) {
      toast.error("标题不能为空");
      return;
    }
    if (
      isNew &&
      selPrompts.size === 0 &&
      selScenarios.size === 0 &&
      selTaskPacks.size === 0
    ) {
      toast.error("至少选一项内容");
      return;
    }
    setBusy(publishAfter ? "publish" : "save");

    try {
      if (isNew) {
        const packed = await packTemplate(
          {
            promptIds: [...selPrompts],
            scenarioIds: [...selScenarios],
            taskPackIds: [...selTaskPacks],
          },
          tplId
        );
        if (packed.warnings.length) {
          for (const w of packed.warnings) toast.info(w);
        }
        await createTemplate({
          id: tplId,
          title: title.trim(),
          description: description.trim(),
          audience: audience.trim() || undefined,
          payload: packed.payload,
        });
        if (publishAfter) await publishTemplate(tplId);
        toast.success(publishAfter ? "已创建并发布" : "已保存草稿");
        nav("/admin/templates");
      } else if (loaded) {
        // 编辑模式
        if (loaded.status === "draft") {
          // 草稿：meta 可改、payload 可重新打包（如果用户选了新内容）
          const hasNewSelection =
            selPrompts.size > 0 || selScenarios.size > 0 || selTaskPacks.size > 0;
          if (hasNewSelection) {
            const ok = await confirm({
              title: "覆盖现有内容？",
              message: `将用当前选择的 ${selPrompts.size + selScenarios.size + selTaskPacks.size} 项内容重新打包，覆盖该模板的 payload。`,
              danger: false,
            });
            if (!ok) {
              setBusy(null);
              return;
            }
            const packed = await packTemplate(
              {
                promptIds: [...selPrompts],
                scenarioIds: [...selScenarios],
                taskPackIds: [...selTaskPacks],
              },
              tplId
            );
            await updateTemplate(tplId, {
              title: title.trim(),
              description: description.trim(),
              audience: audience.trim() || undefined,
              payload: packed.payload,
            });
          } else {
            await updateTemplate(tplId, {
              title: title.trim(),
              description: description.trim(),
              audience: audience.trim() || undefined,
            });
          }
          if (publishAfter) await publishTemplate(tplId);
          toast.success(publishAfter ? "已发布" : "已保存");
          nav("/admin/templates");
        } else {
          // published / archived：只能改 meta
          await updateTemplate(tplId, {
            title: title.trim(),
            description: description.trim(),
            audience: audience.trim() || undefined,
          });
          toast.success("已更新");
          nav("/admin/templates");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-sub">
        <Loader2 size={14} className="animate-spin" /> 加载中…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-6">
      <div className="mb-5">
        <Link
          to="/admin/templates"
          className="inline-flex items-center gap-1 text-xs text-sub hover:text-ink"
        >
          <ArrowLeft size={12} strokeWidth={1.8} />
          返回列表
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="font-serif text-2xl tracking-tight text-ink">
          {isNew ? "新建模板" : loaded?.status === "draft" ? "编辑草稿" : "查看模板"}
        </h1>
        {!isNew && (
          <p className="mono mt-1 text-[11px] text-hint">id: {tplId}</p>
        )}
      </header>

      {/* 从主工作台一键打包带过来的预选提示 */}
      {showPresetHint && presetCount > 0 && (
        <section className="mb-5 flex items-start gap-3 rounded-lg border border-moss/30 bg-moss-soft/40 px-4 py-3">
          <Sparkles size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-moss" />
          <div className="min-w-0 flex-1 text-[13px] text-ink">
            <span>
              已从主工作台预填{" "}
              <span className="mono font-medium">
                {preset?.preselected?.promptIds?.length ?? 0}
              </span>{" "}
              prompts /{" "}
              <span className="mono font-medium">
                {preset?.preselected?.scenarioIds?.length ?? 0}
              </span>{" "}
              场景 /{" "}
              <span className="mono font-medium">
                {preset?.preselected?.taskPackIds?.length ?? 0}
              </span>{" "}
              任务包，可继续微调
            </span>
            <button
              type="button"
              onClick={() => {
                setSelPrompts(new Set());
                setSelScenarios(new Set());
                setSelTaskPacks(new Set());
                setShowPresetHint(false);
              }}
              className="ml-3 text-[12px] text-sub underline-offset-2 hover:text-ink hover:underline"
            >
              清空预选
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPresetHint(false)}
            aria-label="关闭提示"
            className="shrink-0 rounded p-0.5 text-hint transition hover:bg-paper hover:text-ink"
          >
            <X size={12} strokeWidth={1.8} />
          </button>
        </section>
      )}

      {/* meta 表单 */}
      <section className="mb-6 grid gap-4 rounded-lg border border-line bg-paper p-5">
        <div>
          <Label>标题 *</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="如：设计师·AI 提案工具包"
            className={inputCls}
          />
        </div>
        <div>
          <Label>描述</Label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="向用户介绍这个模板能干什么"
            rows={2}
            className={inputCls}
          />
        </div>
        <div>
          <Label>适用人群（运营备注，对用户不可见）</Label>
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="如：独立设计师 / 设计工作室"
            className={inputCls}
          />
        </div>
      </section>

      {/* payload 区 */}
      {isReadOnlyPayload && loaded ? (
        <section className="mb-6 rounded-lg border border-line bg-paper p-5">
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-ink">
            <Eye size={14} strokeWidth={1.8} />
            模板内容快照（只读）
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <StatBox value={loaded.stats?.promptCount ?? 0} label="Prompt" />
            <StatBox value={loaded.stats?.scenarioCount ?? 0} label="场景" />
            <StatBox value={loaded.stats?.taskPackCount ?? 0} label="任务包" />
          </div>
          <ContentChecklist payload={loaded.payload} />
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-hint">
            <AlertTriangle size={11} strokeWidth={1.8} className="text-amber" />
            已发布模板的内容不能修改，确保存量邀请码兑换稳定。
          </p>
        </section>
      ) : (
        <section className="mb-6 rounded-lg border border-line bg-paper">
          <div className="border-b border-line p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`rounded px-3 py-1.5 text-xs transition ${
                      tab === t.key
                        ? "bg-soft font-medium text-ink"
                        : "text-sub hover:bg-soft/50"
                    }`}
                  >
                    {t.label}
                    <span className="mono ml-1 text-[10px] text-hint">
                      {tab === t.key ? `${pickCount(t.key, selPrompts, selScenarios, selTaskPacks)}/` : ""}
                      {t.key === "prompts"
                        ? allPrompts.length
                        : t.key === "scenarios"
                          ? allScenarios.length
                          : allTaskPacks.length}
                    </span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-hint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索"
                  className="mono w-48 rounded border border-line bg-canvas py-1.5 pl-7 pr-2 text-xs text-ink outline-none focus:border-moss"
                />
              </div>
            </div>
            <p className="text-[11px] text-hint">
              提示：任务包会自动带入其指向的场景；子场景会自动带入父场景。
            </p>
          </div>

          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="py-12 text-center text-xs text-hint">没有匹配项</li>
            ) : tab === "prompts" ? (
              filtered.map((p) => {
                const item = p as (typeof allPrompts)[number];
                return (
                  <SelRow
                    key={item.id}
                    checked={selPrompts.has(item.id)}
                    onToggle={() => toggle(selPrompts, setSelPrompts, item.id)}
                    title={item.title}
                    subtitle={item.summary || item.taskIntent}
                    rightSlot={
                      <span className="mono text-[10px] text-hint">{item.taskType}</span>
                    }
                  />
                );
              })
            ) : tab === "scenarios" ? (
              filtered.map((s) => {
                const item = s as (typeof allScenarios)[number];
                return (
                  <SelRow
                    key={item.id}
                    checked={selScenarios.has(item.id)}
                    onToggle={() => toggle(selScenarios, setSelScenarios, item.id)}
                    title={item.title}
                    subtitle={item.fullPath?.join(" / ")}
                    rightSlot={
                      <span className="mono text-[10px] text-hint">L{item.level}</span>
                    }
                  />
                );
              })
            ) : (
              filtered.map((t) => {
                const item = t as (typeof allTaskPacks)[number];
                return (
                  <SelRow
                    key={item.id}
                    checked={selTaskPacks.has(item.id)}
                    onToggle={() => toggle(selTaskPacks, setSelTaskPacks, item.id)}
                    title={item.title}
                    subtitle={item.goal || item.description}
                    rightSlot={
                      <span className="mono text-[10px] text-hint">{item.stages.length} 阶段</span>
                    }
                  />
                );
              })
            )}
          </ul>
        </section>
      )}

      {/* 当前选择统计 */}
      {!isReadOnlyPayload && (
        <section className="mb-6 flex items-center justify-between rounded-lg border border-line bg-soft px-4 py-3 text-xs">
          <div className="flex gap-4 text-sub">
            <span>
              已选 <span className="mono text-ink">{selPrompts.size}</span> prompt
            </span>
            <span>
              <span className="mono text-ink">{selScenarios.size}</span> 场景
            </span>
            <span>
              <span className="mono text-ink">{selTaskPacks.size}</span> 任务包
            </span>
          </div>
          {!isNew && loaded?.status === "draft" && (
            <span className="text-hint">不选则保留原内容</span>
          )}
        </section>
      )}

      {/* 操作 */}
      <div className="sticky bottom-0 -mx-6 flex gap-2 border-t border-line bg-canvas/90 px-6 py-4 backdrop-blur-sm">
        <button
          onClick={() => nav("/admin/templates")}
          className="rounded border border-line bg-paper px-4 py-2 text-sm text-sub hover:bg-soft"
        >
          取消
        </button>
        <div className="flex-1" />
        {(isNew || loaded?.status === "draft") && (
          <button
            onClick={() => handleSave(false)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded border border-line bg-paper px-4 py-2 text-sm text-ink transition hover:bg-soft disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.8} />}
            保存草稿
          </button>
        )}
        {(isNew || loaded?.status === "draft") && (
          <button
            onClick={() => handleSave(true)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded bg-moss px-4 py-2 text-sm font-medium text-canvas transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "publish" ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} strokeWidth={1.8} />}
            发布
          </button>
        )}
        {loaded && loaded.status !== "draft" && (
          <button
            onClick={() => handleSave(false)}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded bg-ink px-4 py-2 text-sm font-medium text-canvas transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={1.8} />}
            保存 Meta
          </button>
        )}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-hint">
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/15";

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-line bg-canvas py-3">
      <div className="mono text-2xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-hint">{label}</div>
    </div>
  );
}

function SelRow({
  checked,
  onToggle,
  title,
  subtitle,
  rightSlot,
}: {
  checked: boolean;
  onToggle: () => void;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <li>
      <label
        className={`flex cursor-pointer items-start gap-3 px-4 py-2.5 transition hover:bg-soft/50 ${checked ? "bg-moss-soft/40" : ""}`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-[3px] h-3.5 w-3.5 cursor-pointer accent-moss"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-ink">{title}</div>
          {subtitle && <div className="mt-0.5 line-clamp-1 text-[11px] text-hint">{subtitle}</div>}
        </div>
        {rightSlot}
      </label>
    </li>
  );
}

function pickCount(
  tab: Tab,
  p: Set<string>,
  s: Set<string>,
  t: Set<string>
): number {
  return tab === "prompts" ? p.size : tab === "scenarios" ? s.size : t.size;
}

/** 已发布模板的内容清单：三 tab 展示真实 title 列表 */
function ContentChecklist({ payload }: { payload: TemplateRecord["payload"] }) {
  const [tab, setTab] = useState<Tab>("prompts");
  const counts = {
    prompts: payload.prompts?.length ?? 0,
    scenarios: payload.scenarios?.length ?? 0,
    taskPacks: payload.taskPacks?.length ?? 0,
  };
  // 预构建 id → Prompt 索引，TaskPack 展开时 O(1) 查 prompt title，避免 stages × promptIds 的 O(N²) find
  const promptMap = useMemo(
    () => new Map((payload.prompts ?? []).map((p) => [p.id, p])),
    [payload.prompts]
  );
  return (
    <div className="mt-5 overflow-hidden rounded-md border border-line bg-canvas">
      <div className="flex gap-1 border-b border-line bg-soft/40 px-2 py-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded px-3 py-1 text-xs transition ${
              tab === t.key
                ? "bg-paper font-medium text-ink shadow-sm"
                : "text-sub hover:bg-paper/60"
            }`}
          >
            {t.label}
            <span className="mono ml-1 text-[10px] text-hint">
              {t.key === "prompts"
                ? counts.prompts
                : t.key === "scenarios"
                  ? counts.scenarios
                  : counts.taskPacks}
            </span>
          </button>
        ))}
      </div>
      <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
        {tab === "prompts" && payload.prompts?.length === 0 && (
          <EmptyRow label="该模板没有包含任何 prompt" />
        )}
        {tab === "scenarios" && payload.scenarios?.length === 0 && (
          <EmptyRow label="该模板没有包含任何场景" />
        )}
        {tab === "taskPacks" && payload.taskPacks?.length === 0 && (
          <EmptyRow label="该模板没有包含任何任务包" />
        )}
        {tab === "prompts" &&
          payload.prompts?.map((p) => (
            <ChecklistRow
              key={p.id}
              title={p.title}
              subtitle={p.summary || p.taskIntent}
              rightSlot={
                <span className="mono text-[10px] text-hint">{p.taskType}</span>
              }
            />
          ))}
        {tab === "scenarios" &&
          payload.scenarios?.map((s) => (
            <ChecklistRow
              key={s.id}
              title={s.title}
              subtitle={s.fullPath?.join(" / ")}
              rightSlot={
                <span className="mono text-[10px] text-hint">L{s.level}</span>
              }
            />
          ))}
        {tab === "taskPacks" &&
          payload.taskPacks?.map((t) => (
            <ExpandableTaskPackRow key={t.id} pack={t} promptMap={promptMap} />
          ))}
      </ul>
    </div>
  );
}

function ChecklistRow({
  title,
  subtitle,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] text-ink">{title}</div>
        {subtitle && (
          <div className="mt-0.5 line-clamp-1 text-[11px] text-hint">{subtitle}</div>
        )}
      </div>
      {rightSlot}
    </li>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <li className="py-8 text-center text-xs text-hint">{label}</li>;
}

function ExpandableTaskPackRow({
  pack,
  promptMap,
}: {
  pack: TaskPack;
  promptMap: Map<string, Prompt>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition hover:bg-soft/40"
      >
        <ChevronRight
          size={12}
          strokeWidth={2}
          className={`mt-1 shrink-0 text-hint transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-ink">{pack.title}</div>
          {(pack.goal || pack.description) && (
            <div className="mt-0.5 line-clamp-1 text-[11px] text-hint">
              {pack.goal || pack.description}
            </div>
          )}
        </div>
        <span className="mono shrink-0 text-[10px] text-hint">{pack.stages.length} 阶段</span>
      </button>
      {open && <TaskPackStages stages={pack.stages} promptMap={promptMap} />}
    </li>
  );
}

function TaskPackStages({
  stages,
  promptMap,
}: {
  stages: TaskStage[];
  promptMap: Map<string, Prompt>;
}) {
  const sorted = [...stages].sort((a, b) => a.order - b.order);
  return (
    <div className="border-t border-line bg-soft/30 px-4 py-2">
      {sorted.map((stage, i) => (
        <div key={stage.id} className="py-1.5">
          <div className="flex items-baseline gap-2 text-[11px]">
            <span className="mono shrink-0 text-hint">阶段 {i + 1}</span>
            <span className="font-medium text-sub">{stage.name}</span>
            {stage.description && (
              <span className="truncate text-hint">— {stage.description}</span>
            )}
          </div>
          {stage.promptIds.length === 0 ? (
            <div className="ml-4 mt-1 text-[11px] italic text-hint">
              （该阶段未绑定 prompt）
            </div>
          ) : (
            <ul className="ml-4 mt-1 space-y-0.5">
              {stage.promptIds.map((pid) => {
                const p = promptMap.get(pid);
                return (
                  <li key={pid} className="text-[11.5px] leading-relaxed">
                    {p ? (
                      <span className="text-sub">· {p.title}</span>
                    ) : (
                      <span className="text-red-600">
                        ⚠ 引用缺失（id={pid.slice(-12)}）
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
