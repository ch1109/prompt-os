import { type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useUI } from "@/store/uiStore";
import { SearchBar } from "./SearchBar";

interface Props {
  sidebar: ReactNode;
  main: ReactNode;
  detail?: ReactNode;
  /** 详情面板宽度 Tailwind class，默认 md:w-[400px] */
  detailWidthClass?: string;
}

export function ThreeColumnLayout({
  sidebar,
  main,
  detail,
  detailWidthClass = "md:w-[400px]",
}: Props) {
  const mobileSidebarOpen = useUI((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUI((s) => s.setMobileSidebarOpen);

  return (
    <div className="flex h-full flex-col bg-canvas">
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-3 py-2 md:px-5 md:py-2.5">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="rounded p-1.5 text-sub hover:bg-soft md:hidden"
          aria-label="打开侧边栏"
        >
          <Menu size={16} strokeWidth={1.7} />
        </button>
        <div className="flex-1">
          <SearchBar />
        </div>
      </div>
      <div className="relative flex flex-1 overflow-hidden">
        {/* 桌面 sidebar */}
        <aside className="hidden w-[244px] shrink-0 overflow-y-auto border-r border-line bg-canvas md:block">
          {sidebar}
        </aside>

        {/* 移动端 sidebar drawer */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/30 md:hidden page-enter"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <aside
              className="detail-enter absolute inset-y-0 left-0 w-[280px] max-w-[80vw] overflow-y-auto border-r border-line bg-canvas"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-12 items-center justify-end border-b border-line px-2">
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="rounded p-1.5 text-sub hover:bg-soft"
                  aria-label="关闭侧边栏"
                >
                  <X size={16} strokeWidth={1.7} />
                </button>
              </div>
              {sidebar}
            </aside>
          </div>
        )}

        <section className="flex-1 overflow-y-auto bg-canvas">{main}</section>

        {/* 详情：桌面三栏内联，移动端全屏 overlay */}
        {detail && (
          <aside className={`fixed inset-0 z-30 overflow-y-auto border-line bg-paper detail-enter md:static md:z-auto md:shrink-0 md:border-l ${detailWidthClass}`}>
            {detail}
          </aside>
        )}
      </div>
    </div>
  );
}
