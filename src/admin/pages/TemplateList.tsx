import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Archive, Trash2, ChevronRight, Loader2 } from "lucide-react";
import {
  listTemplates,
  archiveTemplate,
  deleteTemplate,
  type TemplateRecord,
} from "@/services/adminTemplate";
import { toast } from "@/store/toastStore";
import { confirm } from "@/store/confirmStore";

const STATUS_META: Record<TemplateRecord["status"], { label: string; cls: string }> = {
  draft:     { label: "草稿",   cls: "border-line bg-soft text-sub" },
  published: { label: "已发布", cls: "border-moss/30 bg-moss-soft text-moss" },
  archived:  { label: "已归档", cls: "border-amber/30 bg-amber-soft text-amber" },
};

export default function TemplateList() {
  const [items, setItems] = useState<TemplateRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      setItems(await listTemplates());
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleArchive(t: TemplateRecord) {
    const ok = await confirm({
      title: `归档模板「${t.title}」？`,
      message: "归档后用户不能再兑换关联此模板的新邀请码（已生成的码不受影响）。",
      danger: false,
    });
    if (!ok) return;
    try {
      await archiveTemplate(t.id);
      toast.success("已归档");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "归档失败");
    }
  }

  async function handleDelete(t: TemplateRecord) {
    const ok = await confirm({
      title: `永久删除「${t.title}」？`,
      message:
        "此操作不可撤销。如果该模板还有未使用的邀请码，删除会失败（数据库外键约束）。",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTemplate(t.id);
      toast.success("已删除");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink md:text-[26px]">
            模板中心
          </h1>
          <p className="mt-1 text-sm text-sub">从本地工作区打包成可分发模板。</p>
        </div>
        <Link
          to="/admin/templates/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas transition hover:opacity-90"
        >
          <Plus size={15} strokeWidth={2} />
          新建模板
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {items === null ? (
        <div className="flex items-center gap-2 py-12 text-sm text-sub">
          <Loader2 size={14} className="animate-spin" /> 加载中…
        </div>
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-2">
          {items.map((t) => (
            <li
              key={t.id}
              className="group relative rounded-lg border border-line bg-paper px-4 py-3.5 transition hover:border-ink/20 hover:bg-soft/30"
            >
              {/* 整张卡片 click overlay：覆盖在按钮下层，点空白处跳详情 */}
              <Link
                to={`/admin/templates/${t.id}`}
                aria-label={`查看模板 ${t.title}`}
                className="absolute inset-0 z-0 rounded-lg"
              />
              <div className="pointer-events-none relative z-[1] flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink group-hover:underline">
                      {t.title}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-px text-[10px] ${STATUS_META[t.status].cls}`}
                    >
                      {STATUS_META[t.status].label}
                    </span>
                    <span className="mono shrink-0 text-[10px] text-hint">v{t.version}</span>
                  </div>
                  {t.description && (
                    <p className="mt-1 line-clamp-1 text-xs text-sub">{t.description}</p>
                  )}
                  <div className="mono mt-1.5 flex gap-3 text-[11px] text-hint">
                    {t.stats && (
                      <>
                        <span>{t.stats.promptCount} prompt</span>
                        <span>{t.stats.scenarioCount} scene</span>
                        <span>{t.stats.taskPackCount} pack</span>
                      </>
                    )}
                    <span className="ml-auto">
                      更新 {new Date(t.updated_at).toLocaleString("zh-CN", { hour12: false })}
                    </span>
                  </div>
                </div>
                {/* 按钮层：z 高于 overlay + 单独 pointer-events-auto + stopPropagation */}
                <div className="pointer-events-auto relative z-[2] flex shrink-0 items-center gap-1">
                  {t.status === "published" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleArchive(t);
                      }}
                      className="rounded p-1.5 text-sub transition hover:bg-paper hover:text-amber"
                      title="归档"
                    >
                      <Archive size={14} strokeWidth={1.8} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(t);
                    }}
                    className="rounded p-1.5 text-sub transition hover:bg-paper hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 size={14} strokeWidth={1.8} />
                  </button>
                  <ChevronRight
                    size={14}
                    strokeWidth={1.8}
                    className="ml-1 text-hint transition group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-line bg-paper/50 px-6 py-16 text-center">
      <p className="text-sm text-sub">还没有模板。</p>
      <Link
        to="/admin/templates/new"
        className="mt-3 inline-flex items-center gap-1.5 text-sm text-moss hover:underline"
      >
        <Plus size={13} strokeWidth={1.8} />
        创建第一个
      </Link>
    </div>
  );
}
