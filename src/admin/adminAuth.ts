// Admin 后台认证：基于 Supabase Auth 邮箱密码登录
//
// 安全模型：
//   - 登录走 supabase.auth.signInWithPassword (anon key 调 Auth endpoint)
//   - 登录成功后立即调 is_admin() RPC 校验 admins 白名单
//   - session 由 supabase-js 自动持久化到 localStorage（持续到 token 过期或手动登出）
//   - 后续所有 supabase.from(...) 请求自动带 Authorization: Bearer <jwt>，RLS policy 校验
//
// 这个文件取代了旧的 src/admin/adminClient.ts（已删除）。
import { supabase } from "@/services/supabase";

export interface AdminSession {
  email: string;
  userId: string;
}

/**
 * 包装 promise 加超时兜底。
 * supabase-js v2 的 getSession() 在 token 临近过期触发 autoRefreshToken 时，
 * 如果 refresh 请求因网络问题永远 pending，getSession() 也会永远 pending（既不 resolve 也不 reject）。
 * 任何依赖外部网络的 await 都必须有超时，否则 UI 会被锁死。
 */
function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/** 邮箱密码登录 + 白名单校验。登录但不在 admins 表会被立刻 signOut */
export async function signInAdmin(email: string, password: string): Promise<AdminSession> {
  if (!supabase) throw new Error("Supabase 未配置");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: ok, error: rpcErr } = await supabase.rpc("is_admin");
  if (rpcErr) {
    await supabase.auth.signOut();
    throw rpcErr;
  }
  if (!ok) {
    await supabase.auth.signOut();
    throw new Error("此账号没有管理权限");
  }
  return { email: data.user.email ?? email, userId: data.user.id };
}

export async function signOutAdmin(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/** 启动时调用，恢复登录态。任何异常或超时都吞掉返回 null，避免上层 UI 死锁。 */
export async function getCurrentAdmin(): Promise<AdminSession | null> {
  if (!supabase) return null;
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      3000,
      "getSession"
    );
    if (!data.session) return null;
    const { data: ok, error } = await withTimeout(
      supabase.rpc("is_admin"),
      5000,
      "is_admin RPC"
    );
    if (error || !ok) return null;
    return { email: data.session.user.email ?? "", userId: data.session.user.id };
  } catch (e) {
    console.error("[adminAuth] getCurrentAdmin error:", e);
    return null;
  }
}

/** 监听 session 变化（其他 tab 登出、token 过期续期等）。返回取消订阅函数 */
export function onAuthChange(callback: (session: AdminSession | null) => void): () => void {
  if (!supabase) return () => {};
  const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session || !supabase) return callback(null);
    try {
      const { data: ok, error } = await withTimeout(
        supabase.rpc("is_admin"),
        5000,
        "is_admin RPC (onAuthChange)"
      );
      callback(
        error || !ok
          ? null
          : { email: session.user.email ?? "", userId: session.user.id }
      );
    } catch (e) {
      console.error("[adminAuth] onAuthChange rpc error:", e);
      callback(null);
    }
  });
  return () => sub.subscription.unsubscribe();
}
