import { useUI } from "@/store/uiStore";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useUI();
  return (
    <input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="搜索 Prompt、场景、工作流…"
      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent/30"
    />
  );
}
