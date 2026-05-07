import { type ReactNode } from "react";
import { SearchBar } from "./SearchBar";

interface Props {
  sidebar: ReactNode;
  main: ReactNode;
  detail?: ReactNode;
}

export function ThreeColumnLayout({ sidebar, main, detail }: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2">
        <SearchBar />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[240px] shrink-0 overflow-y-auto border-r border-border">
          {sidebar}
        </aside>
        <section className="flex-1 overflow-y-auto">{main}</section>
        {detail && (
          <aside className="w-[380px] shrink-0 overflow-y-auto border-l border-border">
            {detail}
          </aside>
        )}
      </div>
    </div>
  );
}
