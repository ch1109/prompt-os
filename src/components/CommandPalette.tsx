import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, ArrowRight, Plus, FileText, Settings as SettingsIcon,
  Home, Upload, Inbox, Monitor, Sun, Moon, Sparkles,
} from "lucide-react";
import { useCommandPalette } from "@/store/commandPaletteStore";
import { useSettings, type ThemeMode } from "@/store/settingsStore";
import { useUI } from "@/store/uiStore";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: "导航" | "新建" | "主题" | "操作";
  Icon: typeof Search;
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const open = useCommandPalette((s) => s.open);
  const setOpen = useCommandPalette((s) => s.setOpen);
  const setTheme = useSettings((s) => s.setTheme);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    function go(path: string, hash?: string) {
      return () => {
        setOpen(false);
        navigate(path + (hash ?? ""));
      };
    }
    function setThemeAction(mode: ThemeMode) {
      return () => {
        setTheme(mode);
        setOpen(false);
      };
    }
    return [
      { id: "go-workbench", label: "前往工作台", group: "导航", Icon: Home, run: go("/"), keywords: "home workbench 工作台" },
      { id: "go-prompts", label: "前往 Prompt 库", group: "导航", Icon: FileText, run: go("/prompts"), keywords: "prompt list" },
      { id: "go-templates", label: "前往模板", group: "导航", Icon: FileText, run: go("/templates"), keywords: "templates" },
      { id: "go-settings", label: "前往设置", group: "导航", Icon: SettingsIcon, run: go("/settings"), keywords: "settings" },
      { id: "go-import", label: "前往批量导入", group: "导航", Icon: Upload, run: go("/import"), keywords: "import 导入" },
      { id: "go-pending", label: "前往待确认", group: "导航", Icon: Inbox, run: go("/pending"), keywords: "pending review" },

      { id: "new-prompt", label: "新建 Prompt", hint: "在 Prompt 库打开编辑器", group: "新建", Icon: Plus, run: go("/prompts", "#new"), keywords: "new create 新建" },
      { id: "new-taskpack", label: "新建子场景", hint: "在工作台填写名称与目标", group: "新建", Icon: Plus, run: () => {
        setOpen(false);
        navigate("/");
        useUI.getState().beginCreateTaskPack();
      }, keywords: "new pack 子场景 taskpack" },
      { id: "new-context", label: "新建上下文", hint: "在工作台侧栏打开编辑器", group: "新建", Icon: Plus, run: () => {
        setOpen(false);
        navigate("/");
        useUI.getState().openContextEditor(null);
      }, keywords: "new context 上下文" },

      { id: "theme-system", label: "主题：跟随系统", group: "主题", Icon: Monitor, run: setThemeAction("system") },
      { id: "theme-light", label: "主题：浅色", group: "主题", Icon: Sun, run: setThemeAction("light") },
      { id: "theme-dark", label: "主题：深色", group: "主题", Icon: Moon, run: setThemeAction("dark") },

      { id: "focus-search", label: "聚焦搜索框", hint: "按 / 也可触发", group: "操作", Icon: Search, run: () => {
        setOpen(false);
        setTimeout(() => {
          const el = document.querySelector<HTMLInputElement>("input[placeholder*='搜索']");
          el?.focus();
        }, 50);
      }, keywords: "search focus" },
      { id: "ai-search", label: "切换 AI 意图搜索", group: "操作", Icon: Sparkles, run: () => {
        setOpen(false);
        setTimeout(() => {
          const btn = document.querySelector<HTMLButtonElement>("button[title*='AI']");
          btn?.click();
          document.querySelector<HTMLInputElement>("input[placeholder*='搜索'], input[placeholder*='意图']")?.focus();
        }, 50);
      }, keywords: "ai intent" },
    ];
  }, [navigate, setOpen, setTheme]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = (c.label + " " + (c.keywords ?? "") + " " + c.group).toLowerCase();
      return hay.includes(q);
    });
  }, [commands, query]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(filtered.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[active]?.run();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active, setOpen]);

  if (!open) return null;

  // 按分组组织展示，但保持线性 active index
  const grouped: Record<string, { cmd: Command; flatIdx: number }[]> = {};
  filtered.forEach((c, idx) => {
    grouped[c.group] ??= [];
    grouped[c.group].push({ cmd: c, flatIdx: idx });
  });

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-ink/35 p-4 pt-[10vh] page-enter"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-line bg-paper shadow-[0_8px_32px_-8px_rgba(20,20,18,0.18)] detail-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
          <Search size={14} strokeWidth={1.7} className="shrink-0 text-hint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入命令或搜索…"
            className="flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-hint/80"
          />
          <kbd className="mono rounded border border-line bg-soft px-1.5 py-0.5 text-[10px] text-hint">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-hint">没有匹配的命令</div>
          )}
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="mb-1 last:mb-0">
              <div className="mono px-2 pb-1 pt-1.5 text-[10px] uppercase tracking-wider2 text-hint">
                {group}
              </div>
              <ul>
                {items.map(({ cmd, flatIdx }) => {
                  const isActive = flatIdx === active;
                  return (
                    <li key={cmd.id}>
                      <button
                        onClick={cmd.run}
                        onMouseEnter={() => setActive(flatIdx)}
                        className={`flex w-full items-center gap-2.5 rounded px-2.5 py-2 text-left text-[13px] transition-colors ${
                          isActive ? "bg-moss-soft text-moss" : "text-ink hover:bg-soft"
                        }`}
                      >
                        <cmd.Icon size={14} strokeWidth={1.6} className="shrink-0" />
                        <span className="flex-1">{cmd.label}</span>
                        {cmd.hint && (
                          <span className="text-[11px] text-hint">{cmd.hint}</span>
                        )}
                        {isActive && (
                          <ArrowRight size={12} strokeWidth={2} className="shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-canvas/60 px-3 py-2 text-[10.5px] text-hint">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="mono rounded border border-line bg-paper px-1 py-0.5">↑↓</kbd>
              选择
            </span>
            <span className="flex items-center gap-1">
              <kbd className="mono rounded border border-line bg-paper px-1 py-0.5">↵</kbd>
              执行
            </span>
          </div>
          <span className="mono">Prompt OS</span>
        </div>
      </div>
    </div>
  );
}
