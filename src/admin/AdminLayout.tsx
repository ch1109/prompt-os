import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Mail, Lock, Shield, LogOut, AlertTriangle, Loader2 } from "lucide-react";
import {
  signInAdmin,
  signOutAdmin,
  getCurrentAdmin,
  onAuthChange,
  type AdminSession,
} from "./adminAuth";
import { isSupabaseConfigured } from "@/services/supabase";

const NAV = [
  { to: "/admin/templates", label: "模板中心" },
  { to: "/admin/codes", label: "邀请码" },
  { to: "/admin/redemptions", label: "兑换记录" },
];

export default function AdminLayout() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentAdmin()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch((e) => {
        console.error("[admin] getCurrentAdmin failed:", e);
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    const unsub = onAuthChange((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!isSupabaseConfigured()) return <DegradedNotice />;
  if (checking) return <CheckingScreen />;
  if (!session) return <LoginGate onSuccess={setSession} />;
  return (
    <Shell
      session={session}
      onLogout={async () => {
        await signOutAdmin();
        setSession(null);
      }}
    />
  );
}

function CheckingScreen() {
  return (
    <div className="flex h-full items-center justify-center gap-2 bg-canvas text-sm text-sub">
      <Loader2 size={14} className="animate-spin" />
      正在检查登录态…
    </div>
  );
}

function DegradedNotice() {
  return (
    <div className="flex h-full items-center justify-center bg-canvas p-8">
      <div className="max-w-md text-center">
        <AlertTriangle size={28} strokeWidth={1.5} className="mx-auto text-amber" />
        <h2 className="mt-4 font-serif text-xl text-ink">后台不可用</h2>
        <p className="mt-2 text-sm leading-relaxed text-sub">
          后台需要 Supabase 配置。请在 <code className="mono text-xs">.env.local</code> 设置
          {" "}<code className="mono text-xs">VITE_SUPABASE_URL</code> 与
          {" "}<code className="mono text-xs">VITE_SUPABASE_ANON_KEY</code>。
        </p>
      </div>
    </div>
  );
}

function LoginGate({ onSuccess }: { onSuccess: (s: AdminSession) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      const s = await signInAdmin(email.trim(), password);
      onSuccess(s);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(translateAuthError(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 20% 25%, rgb(var(--amber-soft) / 0.45) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgb(var(--moss-soft) / 0.35) 0%, transparent 60%)",
        }}
      />
      <div className="mx-auto flex min-h-full max-w-md flex-col items-stretch px-6 py-16">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper">
            <Shield size={20} strokeWidth={1.5} className="text-amber" />
          </div>
          <h1 className="font-serif text-2xl tracking-tight text-ink md:text-[28px]">
            创作者后台
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-sub">
            使用 admin 账号登录
          </p>
        </header>

        <section className="rounded-2xl border border-line bg-paper/85 p-6 shadow-[0_1px_0_rgb(var(--line)/0.4)] backdrop-blur-sm md:p-8">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-hint">
            <Mail size={11} strokeWidth={1.8} className="-mt-[1px] mr-1 inline" />
            邮箱
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            spellCheck={false}
            autoComplete="email"
            autoFocus
            disabled={submitting}
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("admin-pw")?.focus()}
            className="mono w-full rounded-md border border-line bg-canvas px-4 py-3 text-[13px] text-ink outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/20 disabled:opacity-60"
          />

          <label className="mb-2 mt-5 block text-xs font-medium uppercase tracking-wider text-hint">
            <Lock size={11} strokeWidth={1.8} className="-mt-[1px] mr-1 inline" />
            密码
          </label>
          <input
            id="admin-pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={submitting}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="mono w-full rounded-md border border-line bg-canvas px-4 py-3 text-[13px] text-ink outline-none transition focus:border-amber focus:ring-2 focus:ring-amber/20 disabled:opacity-60"
          />

          <button
            onClick={handleSubmit}
            disabled={submitting || !email.trim() || !password}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-amber px-4 py-3 text-sm font-medium text-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "登录中…" : "登录"}
          </button>
          {error && (
            <div className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs leading-relaxed text-red-600">
              {error}
            </div>
          )}
        </section>

        <footer className="mt-8 text-center text-xs leading-relaxed text-hint">
          忘记密码请在 Supabase Dashboard → Authentication 重置。
          <br />
          新增 admin 账号需先在 Dashboard 创建用户，再 INSERT 进 admins 表。
        </footer>
      </div>
    </div>
  );
}

/** 把 supabase-js / pg 抛出的英文错误信息映射为更友好的中文 */
function translateAuthError(raw: string): string {
  if (/Invalid login credentials/i.test(raw)) return "邮箱或密码错误";
  if (/Email not confirmed/i.test(raw)) return "此邮箱未确认，请去 Supabase Dashboard 确认";
  if (/没有管理权限/.test(raw)) return raw;
  if (/Supabase 未配置/.test(raw)) return raw;
  if (/network|fetch/i.test(raw)) return "网络异常，请稍后重试";
  return `登录失败：${raw}`;
}

function Shell({
  session,
  onLogout,
}: {
  session: AdminSession;
  onLogout: () => void | Promise<void>;
}) {
  const nav = useNavigate();

  useEffect(() => {
    if (window.location.pathname === "/admin" || window.location.pathname === "/admin/") {
      nav("/admin/templates", { replace: true });
    }
  }, [nav]);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-canvas/85 px-6 backdrop-blur-sm">
        <div className="flex shrink-0 items-center gap-2">
          <Shield size={16} strokeWidth={1.8} className="text-amber" />
          <span className="mono select-none whitespace-nowrap text-[15px] font-semibold tracking-tight text-ink">
            Admin<span className="text-amber">·</span>Console
          </span>
        </div>
        <nav className="ml-6 hidden min-w-0 flex-1 items-center gap-1 whitespace-nowrap text-[14px] md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3.5 py-1.5 transition-colors ${
                  isActive ? "font-medium text-ink" : "text-sub hover:text-ink"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 md:hidden" />
        <span
          className="mono hidden max-w-[200px] truncate text-[12.5px] text-sub md:inline"
          title={session.email}
        >
          {session.email}
        </span>
        <button
          onClick={() => void onLogout()}
          className="flex items-center gap-1.5 rounded border border-line bg-paper px-3 py-1.5 text-xs text-sub transition hover:bg-soft hover:text-ink"
          title="退出登录"
        >
          <LogOut size={13} strokeWidth={1.8} />
          退出
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
