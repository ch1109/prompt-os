import { Outlet, NavLink } from "react-router-dom";

const NAV = [
  { to: "/", label: "首页" },
  { to: "/prompts", label: "Prompt 库" },
  { to: "/scenarios", label: "场景库" },
  { to: "/workflows", label: "工作流" },
  { to: "/contexts", label: "上下文" },
  { to: "/templates", label: "模板" },
  { to: "/settings", label: "设置" },
];

export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-6 border-b border-border bg-background px-4">
        <span className="font-semibold tracking-tight">Prompt OS</span>
        <nav className="flex gap-1 text-sm">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) =>
                `rounded px-2.5 py-1 transition-colors ${
                  isActive
                    ? "bg-muted text-foreground font-medium"
                    : "text-foreground/60 hover:text-foreground"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
