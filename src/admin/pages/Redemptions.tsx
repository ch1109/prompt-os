import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import {
  listRedemptions,
  countRedemptions,
  type RedemptionRecord,
} from "@/services/redemption";
import { listTemplates, type TemplateRecord } from "@/services/adminTemplate";

const PAGE_SIZE = 50;

export default function Redemptions() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [filterTpl, setFilterTpl] = useState<string>("");
  const [items, setItems] = useState<RedemptionRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setTemplates(await listTemplates());
      } catch {
        // 不阻塞
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [list, count] = await Promise.all([
          listRedemptions(filterTpl || undefined, PAGE_SIZE, page * PAGE_SIZE),
          countRedemptions(filterTpl || undefined),
        ]);
        if (!cancelled) {
          setItems(list);
          setTotal(count);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filterTpl, page]);

  // 改 filterTpl 时回到第 0 页
  useEffect(() => {
    setPage(0);
  }, [filterTpl]);

  const tplMap = useMemo(
    () => new Map(templates.map((t) => [t.id, t])),
    [templates]
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:py-10">
      <div className="mb-6">
        <h1 className="font-serif text-2xl tracking-tight text-ink md:text-[26px]">
          兑换记录
        </h1>
        <p className="mt-1 text-sm text-sub">追踪每一次邀请码核销，用于事后审计。</p>
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
        <div className="flex-1" />
        <div className="mono text-[11px] text-hint">
          共 <span className="text-ink">{total}</span> 条
        </div>
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
        <div className="rounded-lg border border-dashed border-line bg-paper/50 py-16 text-center text-sm text-sub">
          还没有任何兑换记录
        </div>
      ) : (
        <>
          <table className="w-full overflow-hidden rounded-lg border border-line bg-paper">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-hint">
                <th className="px-3 py-2.5 font-normal">时间</th>
                <th className="px-3 py-2.5 font-normal">码</th>
                <th className="px-3 py-2.5 font-normal">模板</th>
                <th className="px-3 py-2.5 font-normal">指纹</th>
                <th className="px-3 py-2.5 font-normal">UA</th>
              </tr>
            </thead>
            <tbody className="text-[12px]">
              {items.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-soft/40">
                  <td className="mono px-3 py-2 text-[11px] text-sub">
                    {new Date(r.redeemed_at).toLocaleString("zh-CN", { hour12: false })}
                  </td>
                  <td className="mono px-3 py-2 text-ink">{r.code}</td>
                  <td className="px-3 py-2 text-sub">
                    <span className="line-clamp-1">
                      {tplMap.get(r.template_id)?.title ?? r.template_id}
                    </span>
                  </td>
                  <td className="mono px-3 py-2 text-[11px] text-hint" title={r.fingerprint ?? ""}>
                    {r.fingerprint?.slice(0, 10) ?? "—"}…
                  </td>
                  <td className="px-3 py-2 text-[11px] text-hint" title={r.user_agent ?? ""}>
                    <span className="line-clamp-1 max-w-xs">{shortenUA(r.user_agent)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded border border-line bg-paper p-1.5 text-sub disabled:opacity-40 hover:bg-soft"
              >
                <ChevronLeft size={13} strokeWidth={1.8} />
              </button>
              <span className="mono text-hint">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded border border-line bg-paper p-1.5 text-sub disabled:opacity-40 hover:bg-soft"
              >
                <ChevronRight size={13} strokeWidth={1.8} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function shortenUA(ua: string | null): string {
  if (!ua) return "—";
  // 抽取主要的浏览器+OS 信息
  const m = ua.match(/(Chrome|Firefox|Safari|Edge)\/[\d.]+/);
  const os = ua.match(/(Mac OS X|Windows|Linux|Android|iPhone OS)[\s_\d.]*/);
  return `${m?.[0] ?? "Unknown"} · ${os?.[0]?.trim() ?? ""}`.trim();
}
