import { useEffect } from "react";
import { useSettings } from "@/store/settingsStore";

/**
 * 无 UI 的副作用组件：根据 settingsStore 的 theme 字段（system/light/dark）
 * 给 <html> 加/去 .dark 类，并在 system 模式下监听 prefers-color-scheme 变化。
 * 挂在 App 根即可。
 */
export function ThemeManager() {
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      root.classList.toggle("dark", dark);
    }
    apply();

    if (theme === "system") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  return null;
}
