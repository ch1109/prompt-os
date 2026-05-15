import { Outlet, NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useUI } from "@/store/uiStore";
import { Toaster } from "@/components/Toaster";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ThemeManager } from "@/components/ThemeManager";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { WorkbenchActions } from "@/components/layout/WorkbenchActions";

const NAV = [
  { to: "/", label: "工作台" },
  { to: "/prompts", label: "Prompt 库" },
  { to: "/templates", label: "模板" },
  { to: "/settings", label: "设置" },
];

export default function App() {
  const mobileNavOpen = useUI((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUI((s) => s.setMobileNavOpen);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-canvas/85 px-3.5 backdrop-blur-sm md:gap-7 md:px-6">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="rounded p-1.5 text-sub hover:bg-soft md:hidden"
          aria-label="打开导航"
        >
          <Menu size={16} strokeWidth={1.7} />
        </button>
        <div className="flex shrink-0 flex-col leading-tight">
          <span className="mono select-none whitespace-nowrap text-[16px] font-semibold tracking-tight text-ink">
            Prompt<span className="text-moss">·</span>OS
          </span>
          <span className="hidden whitespace-nowrap text-xs text-hint md:block">
            场景驱动的提示词工作台
          </span>
        </div>
        <nav className="hidden min-w-0 flex-1 items-center gap-1 whitespace-nowrap text-[14px] md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `relative whitespace-nowrap px-3.5 py-1.5 transition-colors ${
                  isActive ? "font-medium text-ink" : "text-sub hover:text-ink"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {n.label}
                  {isActive && (
                    <span className="absolute inset-x-3 -bottom-[18px] h-px bg-ink" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <WorkbenchActions />
      </header>

      {/* 移动端 nav drawer */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 bg-ink/30 page-enter md:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <div
            className="detail-enter absolute inset-y-0 left-0 w-[260px] max-w-[80vw] overflow-y-auto border-r border-line bg-canvas"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 items-center justify-between border-b border-line px-3">
              <span className="mono text-[15px] font-semibold text-ink">
                Prompt<span className="text-moss">·</span>OS
              </span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="rounded p-1.5 text-sub hover:bg-soft"
                aria-label="关闭导航"
              >
                <X size={16} strokeWidth={1.7} />
              </button>
            </div>
            <nav className="flex flex-col p-2 text-[14px]">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === "/"}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    `rounded px-3 py-2 transition-colors ${
                      isActive
                        ? "bg-moss-soft font-medium text-moss"
                        : "text-sub hover:bg-soft hover:text-ink"
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <Toaster />
      <ConfirmDialog />
      <ThemeManager />
      <CommandPalette />
      <KeyboardShortcuts />
    </div>
  );
}
