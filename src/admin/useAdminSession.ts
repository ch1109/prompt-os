// 全局 admin 会话 hook
//
// 给主工作台和其他非 admin-only 页面用：判断"当前是否登录了 admin 账号"，
// 用于权限门控（如「打包为模板」等创作者专属功能）。
//
// 内部依赖的 adminAuth 已经有 try/catch + withTimeout 兜底，
// 不会因 supabase 卡死阻塞 UI。
import { useEffect, useState } from "react";
import {
  getCurrentAdmin,
  onAuthChange,
  type AdminSession,
} from "./adminAuth";

export function useAdminSession() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getCurrentAdmin()
      .then((s) => {
        if (!cancelled) setSession(s);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const unsub = onAuthChange((s) => {
      if (!cancelled) setSession(s);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { session, isAdmin: !!session, loading };
}
