import { type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useUI } from "@/store/uiStore";
import { SearchBar } from "./SearchBar";

interface Props {
  sidebar: ReactNode;
  main: ReactNode;
  detail?: ReactNode;
  /** 详情面板宽度 Tailwind class，默认适配阅读型侧栏 */
  detailWidthClass?: string;
  /** 移动端遮罩点击 / 关闭按钮的回调，不传则遮罩不可点击 */
  onDetailClose?: () => void;
}

export function ThreeColumnLayout({
  sidebar,
  main,
  detail,
  detailWidthClass = "md:w-[380px] lg:w-[460px] xl:w-[500px]",
  onDetailClose,
}: Props) {
  const mobileSidebarOpen = useUI((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUI((s) => s.setMobileSidebarOpen);

  return (
    <div className="flex h-full flex-col bg-canvas text-ink">
      <div className="relative z-30 flex items-center gap-2.5 border-b border-line/80 bg-paper/70 px-3.5 py-2.5 shadow-[0_1px_0_rgb(var(--paper)/0.7)] backdrop-blur-xl md:px-6 md:py-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded-md p-2 text-sub transition hover:bg-soft hover:text-ink md:hidden"
          aria-label="打开侧边栏"
        >
          <Menu size={18} strokeWidth={1.7} />
        </button>
        <div className="flex-1">
          <SearchBar />
        </div>
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        {/* 桌面 sidebar */}
        <aside className="hidden w-[236px] shrink-0 overflow-y-auto border-r border-line/75 bg-canvas/80 lg:w-[260px] md:block">
          {sidebar}
        </aside>

        {/* 移动端 sidebar drawer */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/[0.35] backdrop-blur-sm md:hidden page-enter"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <aside
              className="detail-enter absolute inset-y-0 left-0 w-[300px] max-w-[84vw] overflow-y-auto border-r border-line bg-paper shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-14 items-center justify-end border-b border-line/80 px-2.5">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded-md p-2 text-sub transition hover:bg-soft hover:text-ink"
                  aria-label="关闭侧边栏"
                >
                  <X size={18} strokeWidth={1.7} />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <section className="min-w-0 flex-1 overflow-y-auto bg-canvas/80">{main}</section>

        {/* 详情：桌面三栏内联，移动端全屏 overlay */}
        {detail && (
          <>
            {/* 移动端半透明遮罩，点击关闭 */}
            {onDetailClose && (
              <div
                className="fixed inset-0 z-30 bg-ink/[0.35] backdrop-blur-sm md:hidden"
                onClick={onDetailClose}
              />
            )}
            <aside className={`fixed inset-y-0 right-0 z-30 w-full overflow-y-auto border-line/80 bg-paper/95 shadow-[0_0_0_1px_rgb(var(--line)/0.35),-24px_0_48px_-42px_rgb(var(--ink)/0.55)] backdrop-blur-xl detail-enter md:static md:inset-auto md:z-auto md:shrink-0 md:border-l ${detailWidthClass}`}>
              {/* 移动端固定关闭按钮 */}
              {onDetailClose && (
                <button
                  onClick={onDetailClose}
                  className="absolute right-3 top-3 z-10 rounded-md p-2 text-sub transition hover:bg-soft hover:text-ink md:hidden"
                  aria-label="关闭详情"
                >
                  <X size={18} strokeWidth={1.7} />
                </button>
              )}
              {detail}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
