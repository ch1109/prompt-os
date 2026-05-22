import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Copy,
  Ban,
  Download,
  Loader2,
  X,
  Filter,
} from "lucide-react";
import {
  generateCodes,
  listCodes,
  revokeCode,
  exportCodesToCSV,
  downloadCSV,
  type InviteCodeRecord,
} from "@/services/inviteCode";
import { listTemplates, type TemplateRecord } from "@/services/adminTemplate";
import { toast } from "@/store/toastStore";
import { confirm } from "@/store/confirmStore";

type StatusFilter = "all" | "unused" | "used" | "revoked";

const STATUS_META: Record<InviteCodeRecord["status"], { label: string; cls: string }> = {
  unused:  { label: "未使用", cls: "border-moss/30 bg-moss-soft text-moss" },
  used:    { label: "已使用", cls: "border-line bg-soft text-sub" },
  revoked: { label: "已撤销", cls: "border-amber/30 bg-amber-soft text-amber" },
};

export default function CodeList() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [codes, setCodes] = useState<InviteCodeRecord[] | null>(null);
  const [filterTpl, setFilterTpl] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [error, setError] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);

  async function reload() {
    setError(null);
    try {
      const list = await listCodes(
        filterTpl || undefined,
        filterStatus === "all" ? undefined : filterStatus
      );
      setCodes(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        setTemplates(await listTemplates());
      } catch {
        // 不阻塞页面
      }
    })();
  }, []);

  useEffect(() => {
    reload();
  }, [filterTpl, filterStatus]);

  const tplMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  );

  async function handleRevoke(code: InviteCodeRecord) {
    const ok = await confirm({
      title: "撤销该邀请码？",
      message: `撤销后用户无法用 ${code.code} 兑换。仅未使用的码可被撤销。`,
      confirmText: "撤销",
      danger: true,
    });
    if (!ok) return;
    try {
      await revokeCode(code.code);
      toast.success("已撤销");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "撤销失败");
    }
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("已复制：" + code);
    } catch {
      toast.error("复制失败");
    }
  }

  function handleExportCSV() {
    if (!codes || codes.length === 0) {
      toast.info("没有可导出的邀请码");
      return;
    }
    const csv = exportCodesToCSV(codes);
    const tag = filterTpl ? `-${filterTpl.slice(-8)}` : "";
    downloadCSV(`invite-codes${tag}-${Date.now()}.csv`, csv);
    toast.success(`已导出 ${codes.length} 条`);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-ink md:text-[26px]">
            邀请码
          </h1>
          <p className="mt-1 text-sm text-sub">为已发布的模板批量生成可分发的一次性码。</p>
        </div>
        <button
          onClick={() => setShowGenerate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink px-4 py-2 text-sm font-medium text-canvas transition hover:opacity-90"
        >
          <Plus size={15} strokeWidth={2} />
          生成邀请码
        </button>
      </div>

      {/* 过滤栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper px-4 py-3">
        <Filter size={12} strokeWidth={1.8} className="text-hint" />
        <span className="text-xs text-hint">筛选</span>
        <select
          value={filterTpl}
          onChange={(e) => setFilterTpl(e.target.value)}
          className="mono rounded border border-line bg-canvas px-2 py-1 text-[11px] text-ink focus:border-moss"
        >
          <option value="">全部模板</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className="rounded border border-line bg-canvas px-2 py-1 text-[11px] text-ink focus:border-moss"
        >
          <option value="all">全部状态</option>
          <option value="unused">未使用</option>
          <option value="used">已使用</option>
          <option value="revoked">已撤销</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={handleExportCSV}
          disabled={!codes || codes.length === 0}
          className="inline-flex items-center gap-1 rounded border border-line bg-paper px-2.5 py-1 text-[11px] text-sub hover:bg-soft disabled:opacity-40"
        >
          <Download size={11} strokeWidth={1.8} />
          导出 CSV
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600">
          {error}
        </div>
      )}

      {codes === null ? (
        <div className="flex items-center gap-2 py-12 text-sm text-sub">
          <Loader2 size={14} className="animate-spin" /> 加载中…
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line bg-paper/50 py-16 text-center text-sm text-sub">
          没有匹配的邀请码
        </div>
      ) : (
        <table className="w-full overflow-hidden rounded-lg border border-line bg-paper">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-hint">
              <th className="px-3 py-2.5 font-normal">码</th>
              <th className="px-3 py-2.5 font-normal">模板</th>
              <th className="px-3 py-2.5 font-normal">状态</th>
              <th className="px-3 py-2.5 font-normal">创建</th>
              <th className="px-3 py-2.5 font-normal">备注</th>
              <th className="px-3 py-2.5 font-normal"></th>
            </tr>
          </thead>
          <tbody className="text-[12px]">
            {codes.map((c) => (
              <tr key={c.code} className="border-b border-line last:border-0 hover:bg-soft/40">
                <td className="mono px-3 py-2 text-ink">
                  <button onClick={() => handleCopy(c.code)} className="hover:underline">
                    {c.code}
                  </button>
                </td>
                <td className="px-3 py-2 text-sub">
                  <span className="line-clamp-1">
                    {tplMap.get(c.template_id)?.title ?? c.template_id}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-px text-[10px] ${STATUS_META[c.status].cls}`}
                  >
                    {STATUS_META[c.status].label}
                  </span>
                </td>
                <td className="mono px-3 py-2 text-[11px] text-hint">
                  {new Date(c.created_at).toLocaleString("zh-CN", { hour12: false })}
                </td>
                <td className="px-3 py-2 text-sub">
                  <span className="line-clamp-1">{c.notes ?? "—"}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => handleCopy(c.code)}
                      className="rounded p-1 text-sub hover:bg-soft hover:text-ink"
                      title="复制"
                    >
                      <Copy size={12} strokeWidth={1.8} />
                    </button>
                    {c.status === "unused" && (
                      <button
                        onClick={() => handleRevoke(c)}
                        className="rounded p-1 text-sub hover:bg-soft hover:text-red-600"
                        title="撤销"
                      >
                        <Ban size={12} strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showGenerate && (
        <GenerateDialog
          templates={templates.filter((t) => t.status === "published")}
          onClose={() => setShowGenerate(false)}
          onGenerated={() => {
            setShowGenerate(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function GenerateDialog({
  templates,
  onClose,
  onGenerated,
}: {
  templates: TemplateRecord[];
  onClose: () => void;
  onGenerated: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [count, setCount] = useState(10);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const tpl = templates.find((t) => t.id === templateId);

  async function handleSubmit() {
    if (!tpl) {
      toast.error("请选择模板");
      return;
    }
    if (count < 1 || count > 200) {
      toast.error("数量需在 1-200 之间");
      return;
    }
    setBusy(true);
    try {
      const codes = await generateCodes(
        tpl.id,
        tpl.version,
        count,
        null,
        notes.trim() || null
      );
      toast.success(`已生成 ${codes.length} 个邀请码`);
      onGenerated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink">生成邀请码</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-sub hover:bg-soft hover:text-ink"
          >
            <X size={14} strokeWidth={1.8} />
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-md border border-amber/40 bg-amber-soft/40 px-3 py-3 text-xs leading-relaxed text-ink">
            没有已发布的模板。请先到「模板中心」发布一个模板。
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>模板</Label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-moss"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} (v{t.version})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>生成数量（1-200）</Label>
              <input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="mono w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-moss"
              />
            </div>
            <div>
              <Label>备注（仅运营可见）</Label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="如：卖给设计公会·2026Q2"
                className="w-full rounded border border-line bg-canvas px-3 py-2 text-sm text-ink focus:border-moss"
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded border border-line bg-paper px-4 py-2 text-sm text-sub hover:bg-soft"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || templates.length === 0}
            className="flex flex-[2] items-center justify-center gap-1.5 rounded bg-moss px-4 py-2 text-sm font-medium text-canvas hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} strokeWidth={1.8} />}
            生成 {count} 个
          </button>
        </div>
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
