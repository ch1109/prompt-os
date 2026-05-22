import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ticket, Loader2, CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import {
  previewCode,
  redeemCode,
  normalizeCode,
  RedeemError,
  type RedeemStats,
  type ConflictResult,
} from "@/services/redeem";
import { isSupabaseConfigured } from "@/services/supabase";
import { toast } from "@/store/toastStore";

type Phase = "idle" | "previewing" | "previewed" | "redeeming" | "done";

interface PreviewData {
  stats: RedeemStats;
  conflicts: ConflictResult;
}

const ERROR_MESSAGES: Record<string, string> = {
  NO_SUPABASE: "兑换功能需要联网。请在设置中配置 Supabase 后再试。",
  INVALID_CODE: "邀请码不存在，请核对后重试。",
  CODE_ALREADY_USED: "该邀请码已被使用，无法重复兑换。",
  CODE_EXPIRED: "该邀请码已过期。",
  CODE_REVOKED: "该邀请码已被撤销。",
  TEMPLATE_NOT_FOUND: "模板内容不可用，请联系发码方。",
  NETWORK_ERROR: "网络异常，请稍后重试。",
};

export default function Redeem() {
  const nav = useNavigate();
  const [raw, setRaw] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [doneStats, setDoneStats] = useState<RedeemStats | null>(null);

  const code = normalizeCode(raw);
  const formatted = formatForDisplay(code);
  const canPreview = code.length >= 16 && phase === "idle";

  async function handlePreview() {
    if (!canPreview) return;
    setPhase("previewing");
    setPreview(null);
    try {
      const r = await previewCode(code);
      setPreview({ stats: r.stats, conflicts: r.conflicts });
      setPhase("previewed");
    } catch (e) {
      handleError(e);
      setPhase("idle");
    }
  }

  async function handleRedeem() {
    if (phase !== "previewed" || !preview) return;
    if (preview.conflicts.total > 0) return;
    setPhase("redeeming");
    try {
      const r = await redeemCode(code);
      setDoneStats(r.stats);
      setPhase("done");
      toast.success("兑换成功，内容已加入工作区");
    } catch (e) {
      handleError(e);
      setPhase("previewed");
    }
  }

  function reset() {
    setRaw("");
    setPreview(null);
    setDoneStats(null);
    setPhase("idle");
  }

  function handleError(e: unknown) {
    if (e instanceof RedeemError) {
      toast.error(ERROR_MESSAGES[e.code] ?? "兑换失败");
    } else {
      toast.error("网络异常，请稍后重试");
      console.error(e);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="text-amber" />
        <h2 className="mt-4 font-serif text-xl text-ink">兑换功能未就绪</h2>
        <p className="mt-2 text-sm text-sub">
          兑换需要联网校验。请在 <code className="mono text-xs">.env.local</code> 配置
          {" "}<code className="mono text-xs">VITE_SUPABASE_URL</code> 与{" "}
          <code className="mono text-xs">VITE_SUPABASE_ANON_KEY</code> 后重启。
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto">
      {/* 氛围背景：moss 到 canvas 的柔和渐变层叠 */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, rgb(var(--moss-soft) / 0.55) 0%, transparent 55%), radial-gradient(circle at 75% 75%, rgb(var(--amber-soft) / 0.35) 0%, transparent 60%)",
        }}
      />

      <div className="mx-auto flex min-h-full max-w-lg flex-col items-stretch px-6 py-12 md:py-16">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper">
            <Ticket size={20} strokeWidth={1.5} className="text-moss" />
          </div>
          <h1 className="font-serif text-2xl tracking-tight text-ink md:text-[28px]">
            兑换行业模板
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-sub">
            输入你收到的邀请码，一键导入定制内容。
            <br />
            内容将合并到当前工作区，且邀请码仅可使用一次。
          </p>
        </header>

        {phase !== "done" ? (
          <section className="rounded-2xl border border-line bg-paper/85 p-6 shadow-[0_1px_0_rgb(var(--line)/0.4)] backdrop-blur-sm md:p-8">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-hint">
              邀请码
            </label>
            <input
              type="text"
              value={formatted}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              spellCheck={false}
              autoFocus
              disabled={phase !== "idle"}
              className="mono w-full rounded-md border border-line bg-canvas px-4 py-3 text-center text-lg tracking-[0.18em] text-ink outline-none transition focus:border-moss focus:ring-2 focus:ring-moss/20 disabled:opacity-60"
            />

            {phase === "idle" && (
              <button
                onClick={handlePreview}
                disabled={!canPreview}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-moss px-4 py-3 text-sm font-medium text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight size={16} strokeWidth={1.8} />
                查看内容
              </button>
            )}

            {phase === "previewing" && (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-md border border-line bg-soft px-4 py-3 text-sm text-sub">
                <Loader2 size={16} className="animate-spin" />
                正在核对邀请码…
              </div>
            )}

            {phase === "previewed" && preview && (
              <PreviewBlock
                preview={preview}
                onRedeem={handleRedeem}
                onReset={reset}
              />
            )}

            {phase === "redeeming" && (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-md bg-moss px-4 py-3 text-sm text-canvas">
                <Loader2 size={16} className="animate-spin" />
                正在导入内容…
              </div>
            )}
          </section>
        ) : (
          doneStats && <DoneBlock stats={doneStats} onContinue={() => nav("/")} onAgain={reset} />
        )}

        <footer className="mt-8 text-center text-xs text-hint">
          没有邀请码？联系发码方获取。每个码仅可使用一次，请妥善保管。
        </footer>
      </div>
    </div>
  );
}

function PreviewBlock({
  preview,
  onRedeem,
  onReset,
}: {
  preview: PreviewData;
  onRedeem: () => void;
  onReset: () => void;
}) {
  const { stats, conflicts } = preview;
  const total = stats.prompts + stats.scenarios + stats.taskPacks;
  const hasConflict = conflicts.total > 0;

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-md border border-line bg-canvas px-4 py-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-hint">
          <Sparkles size={12} strokeWidth={1.8} className="text-moss" />
          模板内容预览
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <StatBox value={stats.prompts} label="Prompt" />
          <StatBox value={stats.scenarios} label="场景" />
          <StatBox value={stats.taskPacks} label="任务包" />
        </div>
        <div className="mt-3 text-center text-xs text-sub">
          共 <span className="mono text-ink">{total}</span> 项内容将合并到工作区
        </div>
      </div>

      {hasConflict && (
        <div className="flex items-start gap-2 rounded-md border border-amber/40 bg-amber-soft/40 px-3 py-3 text-xs leading-relaxed text-ink">
          <AlertTriangle size={14} strokeWidth={1.8} className="mt-[2px] shrink-0 text-amber" />
          <div>
            <div className="mb-1 font-medium">检测到 {conflicts.total} 条 id 冲突</div>
            <div className="text-sub">
              请前往设置页清空数据后重试。本次邀请码<strong className="text-ink">不会被消耗</strong>。
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 rounded-md border border-line bg-paper px-4 py-2.5 text-sm text-sub transition hover:bg-soft"
        >
          换个码
        </button>
        <button
          onClick={onRedeem}
          disabled={hasConflict}
          className="flex flex-[2] items-center justify-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-medium text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckCircle2 size={16} strokeWidth={1.8} />
          确认兑换
        </button>
      </div>
    </div>
  );
}

function StatBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-line bg-paper py-2.5">
      <div className="mono text-xl font-semibold text-ink">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-hint">{label}</div>
    </div>
  );
}

function DoneBlock({
  stats,
  onContinue,
  onAgain,
}: {
  stats: RedeemStats;
  onContinue: () => void;
  onAgain: () => void;
}) {
  return (
    <section className="rounded-2xl border border-moss/40 bg-paper/85 p-8 text-center shadow-[0_1px_0_rgb(var(--moss)/0.2)] backdrop-blur-sm md:p-10">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-moss-soft">
        <CheckCircle2 size={26} strokeWidth={1.5} className="text-moss" />
      </div>
      <h2 className="font-serif text-xl tracking-tight text-ink md:text-2xl">兑换完成</h2>
      <p className="mt-2 text-sm text-sub">
        <span className="mono text-ink">{stats.prompts}</span> 条 Prompt、
        <span className="mono text-ink">{stats.scenarios}</span> 个场景、
        <span className="mono text-ink">{stats.taskPacks}</span> 个任务包已加入工作区
      </p>

      <div className="mt-6 flex gap-2">
        <button
          onClick={onAgain}
          className="flex-1 rounded-md border border-line bg-paper px-4 py-2.5 text-sm text-sub transition hover:bg-soft"
        >
          再兑一张
        </button>
        <button
          onClick={onContinue}
          className="flex flex-[2] items-center justify-center gap-2 rounded-md bg-moss px-4 py-2.5 text-sm font-medium text-canvas transition hover:opacity-90"
        >
          进入工作台
          <ArrowRight size={16} strokeWidth={1.8} />
        </button>
      </div>
    </section>
  );
}

/** 把原始输入按 4 字符分组成 XXXX-XXXX-XXXX-XXXX */
function formatForDisplay(code: string): string {
  const compact = code.replace(/-/g, "").slice(0, 16);
  return compact.match(/.{1,4}/g)?.join("-") ?? compact;
}
