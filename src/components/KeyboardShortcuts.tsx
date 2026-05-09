import { useEffect } from "react";
import { useCommandPalette } from "@/store/commandPaletteStore";

/**
 * 全局键盘快捷键监听器：
 * - Cmd/Ctrl + K：打开 Command Palette
 * - / ：聚焦顶部搜索框（仅当焦点不在 input/textarea 时）
 * - Esc：关闭 Command Palette（其他弹窗各自处理）
 *
 * 无 UI，挂在 App 根。
 */
export function KeyboardShortcuts() {
  const toggle = useCommandPalette((s) => s.toggle);
  const setOpen = useCommandPalette((s) => s.setOpen);

  useEffect(() => {
    function isEditable(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el.isContentEditable
      );
    }

    function onKey(e: KeyboardEvent) {
      // Cmd/Ctrl + K：切换 Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
        return;
      }

      // / 聚焦搜索（不在编辑场景）
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(e.target)) {
        const search = document.querySelector<HTMLInputElement>("input[placeholder*='搜索'], input[placeholder*='意图']");
        if (search) {
          e.preventDefault();
          search.focus();
          search.select?.();
        }
        return;
      }

      // Esc 关闭 palette（其他 modal 由各自组件处理）
      if (e.key === "Escape") {
        setOpen(false);
        // 不 preventDefault，让其他 modal 也能响应
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, setOpen]);

  return null;
}
