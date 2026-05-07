# Prompt OS 实现计划

> **For Claude:** 使用 executing-plans 技能按任务逐步执行此计划。每个任务完成后请验证，再进入下一个任务。

**目标：** 在 22 天内交付一个本地优先的个人复利型 AI 提效系统 MVP（Vite + React + IndexedDB + Anthropic API + Supabase 分享），实现 Prompt / Context / Scenario / Workflow 四大对象的 CRUD、批量导入 AI 分类、双层搜索（关键词+意图）、工作流导航运行与模板分享。

**架构：** 浏览器单页应用，Zustand 管理 UI/会话状态，Dexie.js 封装 IndexedDB 作为唯一持久层（5 张表）；AI 能力通过用户自带 API Key 直连 Anthropic（claude-sonnet-4-6），分类/搜索/解析作为独立的 service 模块；模板分享走 Supabase 公开表（无认证，UUID 链接）。UI 三栏布局（场景树 240px / 卡片列表 flex-1 / 详情面板 380px），路由 7 个一级页面。

**技术栈：** React 18 + TypeScript 5 + Vite 5 / Tailwind CSS 3 + shadcn/ui / Zustand 4 / React Router v6 / Dexie.js 4 / @anthropic-ai/sdk / @hello-pangea/dnd / Supabase JS / Vitest + @testing-library/react / pnpm 10。

**开发原则：** DRY、YAGNI、TDD（关键纯函数与 Dexie 操作先写 Vitest 用例，再实现）、每个任务 2-5 分钟、完成即提交。

---

## 阶段一：项目脚手架 + 类型定义 + 数据库（Day 1-2）

### Task 1-1: 初始化 Vite + React + TypeScript 项目

**涉及文件：**
- 创建：`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`

**步骤 1：执行初始化命令**
```bash
cd "/Users/chch/Desktop/prompt os"
pnpm create vite@latest prompt-os-app --template react-ts
mv prompt-os-app/* prompt-os-app/.* . 2>/dev/null || true
rmdir prompt-os-app
pnpm install
```
期望输出：`node_modules` 创建成功，`Done in xx s`。

**步骤 2：清理默认样板**
- 修改 `src/App.tsx` 仅保留：
```tsx
function App() {
  return <div className="p-8 text-2xl">Prompt OS</div>;
}
export default App;
```
- 删除 `src/App.css`、`src/assets/react.svg`。

**步骤 3：验证**
```bash
pnpm dev
```
期望：浏览器 http://localhost:5173 显示 "Prompt OS"，控制台无报错。Ctrl-C 退出。

**步骤 4：提交**
```bash
git init
git add .
git commit -m "feat: 初始化 Vite + React + TypeScript 脚手架"
```

---

### Task 1-2: 配置 Tailwind CSS + 基础样式

**涉及文件：**
- 创建：`tailwind.config.js`, `postcss.config.js`
- 修改：`src/index.css`

**步骤 1：安装依赖**
```bash
pnpm add -D tailwindcss@3 postcss autoprefixer
pnpm dlx tailwindcss init -p
```

**步骤 2：写 `tailwind.config.js`**
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(214 32% 91%)",
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        accent: "hsl(217 91% 60%)",
      },
    },
  },
  plugins: [],
};
```

**步骤 3：写 `src/index.css`**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root { height: 100%; }
body { font-family: -apple-system, "SF Pro", "PingFang SC", system-ui, sans-serif; color: hsl(222 47% 11%); }
```

**步骤 4：验证**
```bash
pnpm dev
```
期望：标题 "Prompt OS" 应用 `text-2xl` 样式，字号增大。

**步骤 5：提交**
```bash
git add . && git commit -m "feat: 配置 Tailwind CSS"
```

---

### Task 1-3: 安装 shadcn/ui 依赖与路径别名

**涉及文件：**
- 修改：`tsconfig.json`, `vite.config.ts`
- 创建：`src/lib/utils.ts`, `components.json`

**步骤 1：安装依赖**
```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react
pnpm add -D @types/node
```

**步骤 2：配置路径别名 — `tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

**步骤 3：`vite.config.ts`**
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

**步骤 4：`src/lib/utils.ts`**
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```

**步骤 5：验证 + 提交**
```bash
pnpm dev   # 无报错
pnpm dlx tsc --noEmit
git add . && git commit -m "feat: 配置 shadcn/ui 依赖与 @/ 路径别名"
```

---

### Task 1-4: 全局类型定义

**涉及文件：**
- 创建：`src/types/index.ts`

**步骤 1：编写 `src/types/index.ts`**
```ts
export type TaskType = "分析" | "生成" | "改写" | "总结" | "规划" | "决策" | "复盘";
export type Difficulty = "初级" | "中级" | "高级";
export type ValueLevel = "高频" | "高价值" | "战略型" | "辅助型";
export type ContextType =
  | "个人背景" | "职业身份" | "当前项目" | "长期目标" | "输出风格"
  | "任务背景" | "产品介绍" | "用户画像" | "品牌信息" | "常用限制条件";

export interface Prompt {
  id: string;
  title: string;
  body: string;                  // 复制时只复制这个字段
  summary: string;
  primaryScenario: string[];     // 场景路径数组，例：["工作场景","会议","纪要"]
  secondaryScenarios: string[][];
  taskType: TaskType;
  inputRequirements: string;
  outputFormat: string;
  upstreamPrompts: string[];     // Prompt id 数组
  downstreamPrompts: string[];
  recommendedCombinations: string[];
  boundaries: string;
  tags: string[];
  difficulty: Difficulty;
  valueLevel: ValueLevel;
  shareable: boolean;
  isFavorited: boolean;
  useCount: number;
  lastUsedAt: number | null;     // unix ms
  createdAt: number;
  updatedAt: number;
  // 批量导入辅助
  classificationConfidence?: number;
  pendingReview?: boolean;
}

export interface Context {
  id: string;
  title: string;
  type: ContextType;
  content: string;
  tags: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Scenario {
  id: string;
  title: string;
  parentId: string | null;
  level: number;                 // 1=一级，2=二级...
  description: string;
  tags: string[];
}

export interface WorkflowStep {
  step: number;
  name: string;
  promptId: string | null;
  input: string;
  output: string;
  nextAction: string;
}

export interface Workflow {
  id: string;
  title: string;
  goal: string;
  steps: WorkflowStep[];
  finalOutput: string;
  boundaries: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  useCount?: number;
  lastUsedAt?: number | null;
}

export interface SharedTemplate {
  id: string;            // UUID
  title: string;
  description: string;
  payload: {
    prompts?: Prompt[];
    workflows?: Workflow[];
    contexts?: Context[];
    scenarios?: Scenario[];
  };
  createdAt: number;
}
```

**步骤 2：验证 + 提交**
```bash
pnpm dlx tsc --noEmit
git add . && git commit -m "feat: 定义核心领域类型 (Prompt/Context/Scenario/Workflow)"
```

---

### Task 1-5: 安装 Dexie.js 并定义数据库 Schema

**涉及文件：**
- 创建：`src/db/index.ts`, `src/db/seed.ts`

**步骤 1：安装依赖**
```bash
pnpm add dexie nanoid
```

**步骤 2：写 `src/db/index.ts`**
```ts
import Dexie, { type Table } from "dexie";
import type { Prompt, Context, Scenario, Workflow, SharedTemplate } from "@/types";

export class PromptOSDB extends Dexie {
  prompts!: Table<Prompt, string>;
  contexts!: Table<Context, string>;
  scenarios!: Table<Scenario, string>;
  workflows!: Table<Workflow, string>;
  sharedTemplates!: Table<SharedTemplate, string>;

  constructor() {
    super("prompt_os");
    this.version(1).stores({
      prompts: "id, title, taskType, difficulty, valueLevel, isFavorited, lastUsedAt, useCount, *tags, *primaryScenario, pendingReview, updatedAt",
      contexts: "id, title, type, isDefault, *tags, updatedAt",
      scenarios: "id, parentId, level, title",
      workflows: "id, title, *tags, updatedAt",
      sharedTemplates: "id, createdAt",
    });
  }
}

export const db = new PromptOSDB();
```

**步骤 3：写 `src/db/seed.ts`（10 个默认一级场景）**
```ts
import { db } from "./index";
import { nanoid } from "nanoid";

const DEFAULT_SCENARIOS = [
  "工作场景", "自媒体场景", "学习场景", "读书场景", "写作场景",
  "商业场景", "个人成长场景", "生活管理场景", "AI工具场景", "知识管理场景",
];

export async function seedDefaultScenarios() {
  const count = await db.scenarios.count();
  if (count > 0) return;
  await db.scenarios.bulkAdd(
    DEFAULT_SCENARIOS.map((title) => ({
      id: nanoid(),
      title,
      parentId: null,
      level: 1,
      description: "",
      tags: [],
    }))
  );
}
```

**步骤 4：在 `src/main.tsx` 中调用 seed**
```tsx
import { seedDefaultScenarios } from "@/db/seed";
seedDefaultScenarios();
```

**步骤 5：验证 + 提交**
```bash
pnpm dev   # DevTools > Application > IndexedDB > prompt_os 应有 5 张表，scenarios 表 10 条
git add . && git commit -m "feat: 定义 Dexie 数据库 schema 与 10 个默认场景种子"
```

---

### Task 1-6: 编写 CRUD 操作层（TDD：先写测试）

**涉及文件：**
- 创建：`src/db/repos/promptRepo.ts`, `src/db/repos/contextRepo.ts`, `src/db/repos/scenarioRepo.ts`, `src/db/repos/workflowRepo.ts`
- 创建：`src/db/repos/promptRepo.test.ts`

**步骤 1：安装测试栈**
```bash
pnpm add -D vitest @vitest/ui happy-dom fake-indexeddb @testing-library/react @testing-library/jest-dom
```

**步骤 2：`vite.config.ts` 加测试配置**
```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "happy-dom", setupFiles: ["./src/test/setup.ts"], globals: true },
});
```

**步骤 3：`src/test/setup.ts`**
```ts
import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
```

**步骤 4：测试 `src/db/repos/promptRepo.test.ts`**
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import * as promptRepo from "./promptRepo";

describe("promptRepo", () => {
  beforeEach(async () => { await db.prompts.clear(); });

  it("createPrompt 自动生成 id/createdAt/updatedAt", async () => {
    const p = await promptRepo.createPrompt({ title: "测试", body: "你好" });
    expect(p.id).toBeTruthy();
    expect(p.createdAt).toBeGreaterThan(0);
    expect(p.useCount).toBe(0);
  });

  it("incrementUseCount 累加 useCount 并更新 lastUsedAt", async () => {
    const p = await promptRepo.createPrompt({ title: "t", body: "b" });
    await promptRepo.incrementUseCount(p.id);
    const updated = await db.prompts.get(p.id);
    expect(updated?.useCount).toBe(1);
    expect(updated?.lastUsedAt).toBeGreaterThan(0);
  });

  it("toggleFavorite 切换收藏状态", async () => {
    const p = await promptRepo.createPrompt({ title: "t", body: "b" });
    await promptRepo.toggleFavorite(p.id);
    const fav = await db.prompts.get(p.id);
    expect(fav?.isFavorited).toBe(true);
  });
});
```

**步骤 5：实现 `src/db/repos/promptRepo.ts`**
```ts
import { nanoid } from "nanoid";
import { db } from "@/db";
import type { Prompt } from "@/types";

const now = () => Date.now();

export async function createPrompt(input: Partial<Prompt> & { title: string; body: string }): Promise<Prompt> {
  const p: Prompt = {
    id: nanoid(),
    title: input.title,
    body: input.body,
    summary: input.summary ?? "",
    primaryScenario: input.primaryScenario ?? [],
    secondaryScenarios: input.secondaryScenarios ?? [],
    taskType: input.taskType ?? "生成",
    inputRequirements: input.inputRequirements ?? "",
    outputFormat: input.outputFormat ?? "",
    upstreamPrompts: input.upstreamPrompts ?? [],
    downstreamPrompts: input.downstreamPrompts ?? [],
    recommendedCombinations: input.recommendedCombinations ?? [],
    boundaries: input.boundaries ?? "",
    tags: input.tags ?? [],
    difficulty: input.difficulty ?? "初级",
    valueLevel: input.valueLevel ?? "高频",
    shareable: input.shareable ?? true,
    isFavorited: input.isFavorited ?? false,
    useCount: 0,
    lastUsedAt: null,
    createdAt: now(),
    updatedAt: now(),
    classificationConfidence: input.classificationConfidence,
    pendingReview: input.pendingReview ?? false,
  };
  await db.prompts.add(p);
  return p;
}

export const listPrompts = () => db.prompts.orderBy("updatedAt").reverse().toArray();
export const getPrompt = (id: string) => db.prompts.get(id);

export async function updatePrompt(id: string, patch: Partial<Prompt>) {
  await db.prompts.update(id, { ...patch, updatedAt: now() });
}

export const deletePrompt = (id: string) => db.prompts.delete(id);

export async function toggleFavorite(id: string) {
  const p = await db.prompts.get(id);
  if (!p) return;
  await db.prompts.update(id, { isFavorited: !p.isFavorited, updatedAt: now() });
}

export async function incrementUseCount(id: string) {
  const p = await db.prompts.get(id);
  if (!p) return;
  await db.prompts.update(id, { useCount: (p.useCount ?? 0) + 1, lastUsedAt: now() });
}

export async function bulkInsert(prompts: Prompt[]) {
  await db.prompts.bulkAdd(prompts);
}
```

**步骤 6：同样模式实现其余 repo（contextRepo.ts / scenarioRepo.ts / workflowRepo.ts）**，每个含 `create/list/get/update/delete`。

**步骤 7：验证 + 提交**
```bash
pnpm vitest run
# 期望：promptRepo 3 个 test 通过
git add . && git commit -m "feat: CRUD repo 层 (Prompt/Context/Scenario/Workflow) + 单测"
```

---

### Task 1-7: Zustand Stores（settings + ui）

**涉及文件：**
- 创建：`src/store/settingsStore.ts`, `src/store/uiStore.ts`

**步骤 1：安装**
```bash
pnpm add zustand
```

**步骤 2：`src/store/settingsStore.ts`**
```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  apiKey: string;
  model: string;
  setApiKey: (k: string) => void;
  setModel: (m: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: "",
      model: "claude-sonnet-4-6",
      setApiKey: (apiKey) => set({ apiKey }),
      setModel: (model) => set({ model }),
    }),
    { name: "prompt-os-settings" }
  )
);
```

**步骤 3：`src/store/uiStore.ts`**
```ts
import { create } from "zustand";

interface UIState {
  selectedScenarioId: string | null;
  selectedPromptId: string | null;
  searchQuery: string;
  detailOpen: boolean;
  setSelectedScenario: (id: string | null) => void;
  setSelectedPrompt: (id: string | null) => void;
  setSearchQuery: (q: string) => void;
  setDetailOpen: (b: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  selectedScenarioId: null,
  selectedPromptId: null,
  searchQuery: "",
  detailOpen: false,
  setSelectedScenario: (id) => set({ selectedScenarioId: id }),
  setSelectedPrompt: (id) => set({ selectedPromptId: id, detailOpen: !!id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setDetailOpen: (b) => set({ detailOpen: b }),
}));
```

**步骤 4：验证 + 提交**
```bash
pnpm dlx tsc --noEmit
git add . && git commit -m "feat: Zustand settings/ui store (持久化 API Key)"
```

---

### Task 1-8: React Router 7 个页面占位

**涉及文件：**
- 创建：`src/router.tsx`, `src/pages/{Home,Prompts,Scenarios,Workflows,Contexts,Templates,Settings}.tsx`
- 修改：`src/App.tsx`, `src/main.tsx`

**步骤 1：安装**
```bash
pnpm add react-router-dom
```

**步骤 2：每个页面文件示例 `src/pages/Home.tsx`**
```tsx
export default function Home() { return <div className="p-6">首页</div>; }
```
其余 6 个页面同样模式（中文标题：Prompt 库、场景库、工作流、上下文、模板、设置）。

**步骤 3：`src/router.tsx`**
```tsx
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Home from "./pages/Home";
import Prompts from "./pages/Prompts";
import Scenarios from "./pages/Scenarios";
import Workflows from "./pages/Workflows";
import Contexts from "./pages/Contexts";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: "prompts", element: <Prompts /> },
      { path: "scenarios", element: <Scenarios /> },
      { path: "workflows", element: <Workflows /> },
      { path: "contexts", element: <Contexts /> },
      { path: "templates", element: <Templates /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
```

**步骤 4：`src/App.tsx`**
```tsx
import { Outlet, NavLink } from "react-router-dom";
const NAV = [
  { to: "/", label: "首页" }, { to: "/prompts", label: "Prompt 库" },
  { to: "/scenarios", label: "场景库" }, { to: "/workflows", label: "工作流" },
  { to: "/contexts", label: "上下文" }, { to: "/templates", label: "模板" },
  { to: "/settings", label: "设置" },
];
export default function App() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-4 border-b px-4">
        <span className="font-semibold">Prompt OS</span>
        <nav className="flex gap-3 text-sm">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end className={({ isActive }) => isActive ? "text-accent" : "text-foreground/70"}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 overflow-hidden"><Outlet /></main>
    </div>
  );
}
```

**步骤 5：`src/main.tsx`**
```tsx
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import "./index.css";
import { seedDefaultScenarios } from "@/db/seed";
import ReactDOM from "react-dom/client";
seedDefaultScenarios();
ReactDOM.createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
```

**步骤 6：验证 + 提交**
```bash
pnpm dev   # 7 个导航能切换，URL 同步
git add . && git commit -m "feat: 添加 React Router 与 7 个页面占位"
```

---

## 阶段二：核心三栏布局 + Prompt CRUD（Day 3-5）

### Task 2-1: ThreeColumnLayout 骨架

**涉及文件：**
- 创建：`src/components/layout/ThreeColumnLayout.tsx`, `src/components/layout/SearchBar.tsx`

**步骤 1：`SearchBar.tsx`**
```tsx
import { useUI } from "@/store/uiStore";
export function SearchBar() {
  const { searchQuery, setSearchQuery } = useUI();
  return (
    <input
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder="搜索 Prompt、场景、工作流..."
      className="h-9 w-full rounded-md border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
    />
  );
}
```

**步骤 2：`ThreeColumnLayout.tsx`**
```tsx
import { ReactNode } from "react";
import { SearchBar } from "./SearchBar";
export function ThreeColumnLayout(props: { sidebar: ReactNode; main: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-2"><SearchBar /></div>
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[240px] shrink-0 overflow-y-auto border-r">{props.sidebar}</aside>
        <section className="flex-1 overflow-y-auto">{props.main}</section>
        {props.detail && <aside className="w-[380px] shrink-0 overflow-y-auto border-l">{props.detail}</aside>}
      </div>
    </div>
  );
}
```

**步骤 3：验证 + 提交**
```bash
git add . && git commit -m "feat: ThreeColumnLayout + 顶部搜索栏"
```

---

### Task 2-2: Sidebar 场景树（快捷入口 / 场景库 / 智能集合）

**涉及文件：**
- 创建：`src/components/sidebar/Sidebar.tsx`, `src/components/sidebar/ScenarioTree.tsx`, `src/hooks/useScenarios.ts`

**步骤 1：`useScenarios.ts`**
```ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
export const useScenarios = () => useLiveQuery(() => db.scenarios.toArray()) ?? [];
```
安装 dexie-react-hooks：
```bash
pnpm add dexie-react-hooks
```

**步骤 2：`Sidebar.tsx`**
```tsx
import { ScenarioTree } from "./ScenarioTree";
import { useUI } from "@/store/uiStore";
const QUICK = [
  { id: "qs:all", label: "全部 Prompt" },
  { id: "qs:fav", label: "收藏" },
  { id: "qs:recent", label: "最近使用" },
  { id: "qs:pending", label: "待确认" },
];
const SMART = [
  { id: "smart:high-value", label: "高价值" },
  { id: "smart:strategic", label: "战略型" },
  { id: "smart:high-freq", label: "高频" },
];
export function Sidebar() {
  const { selectedScenarioId, setSelectedScenario } = useUI();
  return (
    <div className="space-y-4 p-3 text-sm">
      <Section title="快捷入口" items={QUICK} active={selectedScenarioId} onSelect={setSelectedScenario} />
      <div>
        <div className="px-2 py-1 text-xs uppercase text-foreground/50">场景库</div>
        <ScenarioTree />
      </div>
      <Section title="智能集合" items={SMART} active={selectedScenarioId} onSelect={setSelectedScenario} />
    </div>
  );
}
function Section({ title, items, active, onSelect }: any) {
  return (
    <div>
      <div className="px-2 py-1 text-xs uppercase text-foreground/50">{title}</div>
      <ul>{items.map((it: any) => (
        <li key={it.id}>
          <button onClick={() => onSelect(it.id)}
            className={`w-full rounded px-2 py-1 text-left ${active === it.id ? "bg-muted" : "hover:bg-muted/60"}`}>
            {it.label}
          </button>
        </li>
      ))}</ul>
    </div>
  );
}
```

**步骤 3：`ScenarioTree.tsx`（递归渲染）**
```tsx
import { useScenarios } from "@/hooks/useScenarios";
import { useUI } from "@/store/uiStore";
import type { Scenario } from "@/types";

export function ScenarioTree() {
  const all = useScenarios();
  const { selectedScenarioId, setSelectedScenario } = useUI();
  const roots = all.filter((s) => s.parentId === null);
  const childrenOf = (pid: string) => all.filter((s) => s.parentId === pid);
  const renderNode = (s: Scenario, depth = 0) => (
    <li key={s.id}>
      <button onClick={() => setSelectedScenario(s.id)}
        className={`w-full rounded px-2 py-1 text-left ${selectedScenarioId === s.id ? "bg-muted" : "hover:bg-muted/60"}`}
        style={{ paddingLeft: 8 + depth * 12 }}>
        {s.title}
      </button>
      {childrenOf(s.id).length > 0 && <ul>{childrenOf(s.id).map((c) => renderNode(c, depth + 1))}</ul>}
    </li>
  );
  return <ul>{roots.map((r) => renderNode(r))}</ul>;
}
```

**步骤 4：在 `src/pages/Prompts.tsx` 接线**
```tsx
import { ThreeColumnLayout } from "@/components/layout/ThreeColumnLayout";
import { Sidebar } from "@/components/sidebar/Sidebar";
export default function Prompts() {
  return <ThreeColumnLayout sidebar={<Sidebar />} main={<div className="p-4">卡片列表</div>} />;
}
```

**步骤 5：验证 + 提交**
```bash
pnpm dev   # /prompts 三栏布局，左侧 10 个一级场景可点击
git add . && git commit -m "feat: Sidebar + ScenarioTree (快捷入口/场景库/智能集合)"
```

---

### Task 2-3: PromptCard 卡片 + 一键复制

**涉及文件：**
- 创建：`src/components/prompt/PromptCard.tsx`, `src/components/prompt/PromptList.tsx`, `src/hooks/usePrompts.ts`

**步骤 1：`usePrompts.ts`**
```ts
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
export function usePrompts() {
  const { selectedScenarioId, searchQuery } = useUI();
  return useLiveQuery(async () => {
    let all = await db.prompts.orderBy("updatedAt").reverse().toArray();
    if (selectedScenarioId === "qs:fav") all = all.filter((p) => p.isFavorited);
    else if (selectedScenarioId === "qs:recent") all = all.filter((p) => p.lastUsedAt).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0));
    else if (selectedScenarioId === "qs:pending") all = all.filter((p) => p.pendingReview);
    else if (selectedScenarioId === "smart:high-value") all = all.filter((p) => p.valueLevel === "高价值");
    else if (selectedScenarioId === "smart:strategic") all = all.filter((p) => p.valueLevel === "战略型");
    else if (selectedScenarioId === "smart:high-freq") all = all.filter((p) => p.valueLevel === "高频");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      all = all.filter((p) =>
        p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) || p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return all;
  }, [selectedScenarioId, searchQuery]) ?? [];
}
```

**步骤 2：`PromptCard.tsx`**
```tsx
import type { Prompt } from "@/types";
import { Copy, Star } from "lucide-react";
import { incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";
import { useUI } from "@/store/uiStore";

export function PromptCard({ p }: { p: Prompt }) {
  const { setSelectedPrompt } = useUI();
  async function copy() {
    await navigator.clipboard.writeText(p.body);
    await incrementUseCount(p.id);
  }
  return (
    <div onClick={() => setSelectedPrompt(p.id)}
      className="cursor-pointer rounded-lg border p-3 transition hover:border-accent/50 hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium">{p.title}</div>
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(p.id); }}>
            <Star size={16} className={p.isFavorited ? "fill-yellow-400 text-yellow-400" : "text-foreground/40"} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); copy(); }} title="复制正文">
            <Copy size={16} />
          </button>
        </div>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-foreground/70">{p.summary || p.body.slice(0, 80)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {p.tags.slice(0, 4).map((t) => <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs">{t}</span>)}
      </div>
    </div>
  );
}
```

**步骤 3：`PromptList.tsx`**
```tsx
import { usePrompts } from "@/hooks/usePrompts";
import { PromptCard } from "./PromptCard";
export function PromptList() {
  const items = usePrompts();
  if (!items.length) return <div className="p-6 text-sm text-foreground/60">还没有 Prompt，点右上角"新建"</div>;
  return <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{items.map((p) => <PromptCard key={p.id} p={p} />)}</div>;
}
```

**步骤 4：接线 `Prompts.tsx`** 把 main 替换为 `<PromptList />`。

**步骤 5：验证 + 提交**
```bash
git add . && git commit -m "feat: PromptCard + PromptList + 一键复制(自动 useCount+1)"
```

---

### Task 2-4: PromptDetail 详情面板

**涉及文件：**
- 创建：`src/components/prompt/PromptDetail.tsx`

**步骤 1：组件**
```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { useUI } from "@/store/uiStore";
import { Copy, Star, Trash2, Pencil } from "lucide-react";
import { deletePrompt, incrementUseCount, toggleFavorite } from "@/db/repos/promptRepo";

export function PromptDetail({ onEdit }: { onEdit: (id: string) => void }) {
  const { selectedPromptId, setSelectedPrompt } = useUI();
  const p = useLiveQuery(() => selectedPromptId ? db.prompts.get(selectedPromptId) : undefined, [selectedPromptId]);
  if (!p) return <div className="p-6 text-sm text-foreground/50">选择左侧卡片查看详情</div>;
  return (
    <div className="space-y-3 p-4 text-sm">
      <div className="flex items-start justify-between">
        <h2 className="text-base font-semibold">{p.title}</h2>
        <div className="flex gap-2">
          <button onClick={() => toggleFavorite(p.id)}><Star size={16} className={p.isFavorited ? "fill-yellow-400 text-yellow-400" : ""} /></button>
          <button onClick={() => onEdit(p.id)}><Pencil size={16} /></button>
          <button onClick={async () => { await deletePrompt(p.id); setSelectedPrompt(null); }}><Trash2 size={16} /></button>
        </div>
      </div>
      <Field label="摘要">{p.summary}</Field>
      <Field label="任务类型">{p.taskType} · {p.difficulty} · {p.valueLevel}</Field>
      <Field label="主场景">{p.primaryScenario.join(" / ")}</Field>
      <Field label="正文">
        <pre className="whitespace-pre-wrap rounded bg-muted p-2 text-xs">{p.body}</pre>
        <button onClick={async () => { await navigator.clipboard.writeText(p.body); await incrementUseCount(p.id); }}
          className="mt-2 inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs text-white">
          <Copy size={12} /> 复制正文
        </button>
      </Field>
      <Field label="输入要求">{p.inputRequirements}</Field>
      <Field label="输出格式">{p.outputFormat}</Field>
      <Field label="边界">{p.boundaries}</Field>
      <Field label="标签">{p.tags.join("、")}</Field>
      <Field label="使用次数 / 上次使用">{p.useCount} / {p.lastUsedAt ? new Date(p.lastUsedAt).toLocaleString() : "—"}</Field>
    </div>
  );
}
function Field({ label, children }: any) {
  return <div><div className="text-xs uppercase text-foreground/50">{label}</div><div className="mt-1">{children}</div></div>;
}
```

**步骤 2：在 `Prompts.tsx` 注入第三列**

**步骤 3：验证 + 提交**
```bash
git add . && git commit -m "feat: PromptDetail 详情面板 (复制/收藏/编辑/删除)"
```

---

### Task 2-5: PromptEditor 新建/编辑模态框

**涉及文件：**
- 创建：`src/components/prompt/PromptEditor.tsx`
- 修改：`src/pages/Prompts.tsx`

**步骤 1：`PromptEditor.tsx`（受控表单 + 完整字段）**
```tsx
import { useEffect, useState } from "react";
import { db } from "@/db";
import { createPrompt, updatePrompt } from "@/db/repos/promptRepo";
import type { Difficulty, Prompt, TaskType, ValueLevel } from "@/types";

const TASK_TYPES: TaskType[] = ["分析","生成","改写","总结","规划","决策","复盘"];
const DIFFS: Difficulty[] = ["初级","中级","高级"];
const VALUES: ValueLevel[] = ["高频","高价值","战略型","辅助型"];

export function PromptEditor({ open, id, onClose }: { open: boolean; id?: string | null; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Prompt>>({
    title: "", body: "", summary: "", taskType: "生成", difficulty: "初级",
    valueLevel: "高频", primaryScenario: [], tags: [], inputRequirements: "",
    outputFormat: "", boundaries: "", shareable: true,
  });
  useEffect(() => { (async () => {
    if (id) { const p = await db.prompts.get(id); if (p) setForm(p); }
  })(); }, [id]);

  if (!open) return null;
  const set = (k: keyof Prompt, v: any) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.title || !form.body) return;
    if (id) await updatePrompt(id, form); else await createPrompt(form as any);
    onClose();
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-h-[90vh] w-[640px] overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-lg font-semibold">{id ? "编辑" : "新建"} Prompt</h3>
        <div className="space-y-2 text-sm">
          <Input label="标题*" value={form.title} onChange={(v) => set("title", v)} />
          <Textarea label="正文*（复制时只复制此内容）" rows={6} value={form.body} onChange={(v) => set("body", v)} />
          <Input label="摘要" value={form.summary} onChange={(v) => set("summary", v)} />
          <Input label="主场景路径（逗号分隔，例：工作场景,会议,纪要）"
            value={(form.primaryScenario ?? []).join(",")}
            onChange={(v) => set("primaryScenario", v.split(",").map((x) => x.trim()).filter(Boolean))} />
          <Select label="任务类型" value={form.taskType} options={TASK_TYPES} onChange={(v) => set("taskType", v)} />
          <Select label="难度" value={form.difficulty} options={DIFFS} onChange={(v) => set("difficulty", v)} />
          <Select label="价值等级" value={form.valueLevel} options={VALUES} onChange={(v) => set("valueLevel", v)} />
          <Input label="标签（逗号分隔）"
            value={(form.tags ?? []).join(",")}
            onChange={(v) => set("tags", v.split(",").map((x) => x.trim()).filter(Boolean))} />
          <Textarea label="输入要求" rows={2} value={form.inputRequirements} onChange={(v) => set("inputRequirements", v)} />
          <Textarea label="输出格式" rows={2} value={form.outputFormat} onChange={(v) => set("outputFormat", v)} />
          <Textarea label="边界" rows={2} value={form.boundaries} onChange={(v) => set("boundaries", v)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-3 py-1 text-sm">取消</button>
          <button onClick={submit} className="rounded bg-accent px-3 py-1 text-sm text-white">保存</button>
        </div>
      </div>
    </div>
  );
}
function Input({ label, value, onChange }: any) {
  return <label className="block"><div className="text-xs text-foreground/60">{label}</div>
    <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>;
}
function Textarea({ label, value, onChange, rows }: any) {
  return <label className="block"><div className="text-xs text-foreground/60">{label}</div>
    <textarea rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" /></label>;
}
function Select({ label, value, options, onChange }: any) {
  return <label className="block"><div className="text-xs text-foreground/60">{label}</div>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded border px-2 py-1">
      {options.map((o: string) => <option key={o}>{o}</option>)}
    </select></label>;
}
```

**步骤 2：`Prompts.tsx` 加"新建"按钮 + 接管 onEdit**

**步骤 3：验证**：能新建一条 Prompt，左侧列表与右侧详情同步刷新。

**步骤 4：提交**
```bash
git add . && git commit -m "feat: PromptEditor 新建/编辑模态框"
```

---

## 阶段三：批量导入 + AI 分类（Day 6-9）

### Task 3-1: Settings 页与 API Key 管理

**涉及文件：** 修改 `src/pages/Settings.tsx`

```tsx
import { useSettings } from "@/store/settingsStore";
export default function Settings() {
  const { apiKey, model, setApiKey, setModel } = useSettings();
  return (
    <div className="mx-auto max-w-xl space-y-4 p-6 text-sm">
      <h1 className="text-xl font-semibold">设置</h1>
      <label className="block"><div className="text-xs text-foreground/60">Anthropic API Key</div>
        <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
          className="mt-1 w-full rounded border px-2 py-1" placeholder="sk-ant-..." />
      </label>
      <label className="block"><div className="text-xs text-foreground/60">模型</div>
        <input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
      </label>
      <p className="text-xs text-foreground/50">API Key 仅保存在本机 localStorage。</p>
    </div>
  );
}
```
提交：`git commit -am "feat: 设置页 — API Key & 模型配置"`

---

### Task 3-2: Anthropic SDK 客户端封装

**涉及文件：** 创建 `src/services/anthropicClient.ts`

```bash
pnpm add @anthropic-ai/sdk
```

```ts
import Anthropic from "@anthropic-ai/sdk";
import { useSettings } from "@/store/settingsStore";

export function getClient() {
  const { apiKey } = useSettings.getState();
  if (!apiKey) throw new Error("请先在「设置」中填入 API Key");
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

export async function callJSON<T>(systemPrompt: string, userPrompt: string, maxTokens = 2048): Promise<T> {
  const client = getClient();
  const { model } = useSettings.getState();
  const res = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("AI 未返回 JSON");
  return JSON.parse(match[0]) as T;
}
```
提交：`git commit -am "feat: 封装 Anthropic 客户端 (callJSON 工具)"`

---

### Task 3-3: 批量导入 — 文本解析与预览

**涉及文件：** 创建 `src/pages/Import.tsx`, `src/services/parser.ts`, `src/services/parser.test.ts`，并在路由加入 `/import`。

**步骤 1：测试 `parser.test.ts`**
```ts
import { describe, it, expect } from "vitest";
import { splitPrompts } from "./parser";
describe("splitPrompts", () => {
  it("按空行分割", () => {
    expect(splitPrompts("a\n\nb\n\nc")).toEqual(["a", "b", "c"]);
  });
  it("按 ### 分割", () => {
    expect(splitPrompts("### 1\nfoo\n### 2\nbar")).toEqual(["foo", "bar"]);
  });
});
```

**步骤 2：实现 `parser.ts`**
```ts
export function splitPrompts(raw: string): string[] {
  if (raw.includes("###")) {
    return raw.split(/###[^\n]*\n/).map((s) => s.trim()).filter(Boolean);
  }
  return raw.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}
```

**步骤 3：`Import.tsx` 文本框 + 预览列表 + 「下一步」按钮**

**步骤 4：验证 + 提交**
```bash
pnpm vitest run
git add . && git commit -m "feat: 批量导入文本解析 + 预览页"
```

---

### Task 3-4: AI 分类服务（含批次并发与进度）

**涉及文件：** 创建 `src/services/classifier.ts`

```ts
import { callJSON } from "./anthropicClient";
import type { Prompt } from "@/types";

interface ClassifyResult {
  title: string;
  summary: string;
  primaryScenario: string[];
  taskType: Prompt["taskType"];
  difficulty: Prompt["difficulty"];
  valueLevel: Prompt["valueLevel"];
  tags: string[];
  inputRequirements: string;
  outputFormat: string;
  boundaries: string;
  confidence: number; // 0-1
}

const SYSTEM = `你是 Prompt 分类专家。给定一段 Prompt 文本，输出 JSON：
{"title":"动词+任务对象，6-12 字","summary":"一句话描述用途","primaryScenario":["一级场景","二级","三级"],
"taskType":"分析|生成|改写|总结|规划|决策|复盘","difficulty":"初级|中级|高级",
"valueLevel":"高频|高价值|战略型|辅助型","tags":["5-8 个关键词"],
"inputRequirements":"","outputFormat":"","boundaries":"","confidence":0.0}
一级场景必须从下列十项中选一：工作场景/自媒体场景/学习场景/读书场景/写作场景/商业场景/个人成长场景/生活管理场景/AI工具场景/知识管理场景。
仅输出 JSON，不要解释。`;

export async function classifyOne(body: string): Promise<ClassifyResult> {
  return callJSON<ClassifyResult>(SYSTEM, body, 1024);
}

export async function classifyBatch(
  bodies: string[],
  onProgress: (done: number, total: number) => void,
  concurrency = 3
): Promise<(ClassifyResult & { body: string })[]> {
  const results: (ClassifyResult & { body: string })[] = [];
  let done = 0;
  const queue = bodies.map((b, i) => ({ b, i }));
  async function worker() {
    while (queue.length) {
      const { b, i } = queue.shift()!;
      try {
        const r = await classifyOne(b);
        results[i] = { ...r, body: b };
      } catch {
        results[i] = {
          title: b.slice(0, 12), summary: "", primaryScenario: [],
          taskType: "生成", difficulty: "初级", valueLevel: "辅助型",
          tags: [], inputRequirements: "", outputFormat: "", boundaries: "",
          confidence: 0, body: b,
        };
      }
      done++; onProgress(done, bodies.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
```
提交：`git commit -am "feat: classifier 服务 (批次并发 + 进度回调)"`

---

### Task 3-5: 导入流程串联 + 待确认队列

**涉及文件：** 修改 `Import.tsx`，新增页面 `src/pages/PendingReview.tsx`

**`Import.tsx` 三步流程：**
1. 粘贴文本 → 解析边界 → 预览条目数量
2. 点击"开始 AI 分类" → 调用 `classifyBatch`，进度条显示 `已分类 X / Y`
3. 分类完成 → 高置信度（≥0.7）直接 `bulkInsert`，低置信度设置 `pendingReview: true` 后入库

**`PendingReview.tsx`**
```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { updatePrompt } from "@/db/repos/promptRepo";
export default function PendingReview() {
  const items = useLiveQuery(() => db.prompts.filter((p) => !!p.pendingReview).toArray()) ?? [];
  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold">待确认 ({items.length})</h1>
      {items.map((p) => (
        <div key={p.id} className="rounded border p-3">
          <div className="font-medium">{p.title}</div>
          <div className="text-sm text-foreground/70">{p.summary}</div>
          <button onClick={() => updatePrompt(p.id, { pendingReview: false })}
            className="mt-2 rounded bg-accent px-2 py-1 text-xs text-white">确认入库</button>
        </div>
      ))}
    </div>
  );
}
```
提交：`git commit -am "feat: 批量导入流程 + 待确认队列页"`

---

## 阶段四：搜索推荐（Day 10-12）

### Task 4-1: 关键词全文搜索 + 性能基准

**涉及文件：** 创建 `src/services/search.ts`, `src/services/search.test.ts`

```ts
import { db } from "@/db";
import type { Prompt } from "@/types";
export async function keywordSearch(q: string): Promise<Prompt[]> {
  const norm = q.trim().toLowerCase();
  if (!norm) return db.prompts.orderBy("updatedAt").reverse().limit(50).toArray();
  const all = await db.prompts.toArray();
  return all.filter((p) =>
    p.title.toLowerCase().includes(norm) ||
    p.body.toLowerCase().includes(norm) ||
    p.summary.toLowerCase().includes(norm) ||
    p.tags.some((t) => t.toLowerCase().includes(norm))
  );
}
```
测试：1000 条假数据下 < 200ms。提交：`git commit -am "feat: 关键词全文搜索 + 性能基准测试"`

---

### Task 4-2: AI 意图搜索（searcher.ts）

**涉及文件：** 创建 `src/services/searcher.ts`

```ts
import { callJSON } from "./anthropicClient";
import { db } from "@/db";

export async function intentSearch(query: string, topK = 8): Promise<{ id: string; reason: string }[]> {
  const candidates = await db.prompts.toArray();
  const summaries = candidates.map((p) => ({ id: p.id, title: p.title, summary: p.summary, tags: p.tags }));
  const SYSTEM = `根据用户意图，从候选 Prompt 列表中选出最匹配的 ${topK} 条，按相关度排序。
输出 JSON：[{"id":"xxx","reason":"为什么匹配（一句话）"}]，仅输出 JSON。`;
  return callJSON(SYSTEM, `用户意图：${query}\n候选：${JSON.stringify(summaries)}`, 1024);
}
```
提交：`git commit -am "feat: searcher 意图搜索 (LLM 重排序)"`

---

### Task 4-3: 搜索栏接入双层逻辑 + 筛选 chips

**涉及文件：** 修改 `SearchBar.tsx`，新增 `src/components/prompt/Filters.tsx`，更新 `uiStore.ts`

- SearchBar 加"AI 搜索"切换按钮（图标或 toggle），触发 `intentSearch` 并把结果 id 列表写入 uiStore 的 `intentResultIds`。
- usePrompts 优先使用 `intentResultIds` 过滤（带排序），无时走关键词逻辑。
- Filters 提供 TaskType / Difficulty 多选 chips（checkboxes），写入 uiStore 的 `filterTaskTypes` / `filterDifficulties`。
- usePrompts 对 chips 做 AND 过滤。

提交：`git commit -am "feat: 搜索切换 (关键词↔AI意图) + 筛选 chips"`

---

## 阶段五：工作流（Day 13-15）

### Task 5-1: Workflow CRUD 页与编辑器

**涉及文件：** `src/pages/Workflows.tsx`, `src/components/workflow/WorkflowEditor.tsx`

与 Prompt 类似的列表 + 详情 + 模态编辑。
表单字段：title / goal / boundaries / tags / steps（动态数组，每步含 promptId 选择器、input 说明、output 说明、nextAction）。

提交：`git commit -am "feat: Workflow CRUD"`

---

### Task 5-2: 步骤拖拽排序

**涉及文件：** `src/components/workflow/StepList.tsx`

```bash
pnpm add @hello-pangea/dnd
```
```tsx
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
// onDragEnd 后重排数组并重新编号 step 字段，调用 updateWorkflow 持久化
```
提交：`git commit -am "feat: 工作流步骤拖拽排序"`

---

### Task 5-3: WorkflowRunner 导航引导模式

**涉及文件：** `src/components/workflow/WorkflowRunner.tsx`

```tsx
// 状态：currentStep: number (从 0 开始)
// 顶部进度：Step {currentStep+1} / {steps.length}: {step.name}
// 中间：当前步骤关联的 Prompt 正文（pre 展示）+ 「复制正文」按钮
// 复制成功提示："已复制，请去 ChatGPT/Claude 等工具粘贴使用，完成后回来继续"
// 底部：「上一步」「下一步」按钮
// 最后一步后：显示「🎉 工作流完成」 + 完整工作流已使用 useCount+1
```
提交：`git commit -am "feat: WorkflowRunner 导航引导运行"`

---

## 阶段六：上下文库（Day 16-17）

### Task 6-1: Context CRUD

**涉及文件：** `src/pages/Contexts.tsx`, `src/components/context/ContextEditor.tsx`

字段：title, type（下拉，10 类）, content（textarea）, tags, isDefault。

提交：`git commit -am "feat: Context CRUD + 类型管理"`

---

### Task 6-2: 在 Prompt 详情中"带上下文使用"

**涉及文件：** `src/components/prompt/UsePromptDialog.tsx`

```tsx
// 在 PromptDetail 详情面板加按钮"带上下文使用"
// 弹出对话框：
//   1. 列出所有 Context（isDefault 默认勾选）
//   2. 实时预览拼接：{选中 contexts.content 按换行连接}\n\n---\n\n{prompt.body}
//   3. 按钮"复制全部" → navigator.clipboard.writeText(preview) + incrementUseCount
```
提交：`git commit -am "feat: 调用 Prompt 时选择上下文 + 预览拼接"`

---

## 阶段七：模板分享（Day 18-20）

### Task 7-1: JSON 模板导出/导入

**涉及文件：** `src/services/templateExport.ts`

```ts
import { db } from "@/db";
export async function exportTemplate(promptIds: string[], workflowIds: string[] = []) {
  const prompts = (await db.prompts.bulkGet(promptIds)).filter(Boolean);
  const workflows = (await db.workflows.bulkGet(workflowIds)).filter(Boolean);
  const blob = new Blob([JSON.stringify({ prompts, workflows }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: `template-${Date.now()}.promptos.json` }).click();
  URL.revokeObjectURL(url);
}
export async function importTemplateFromFile(file: File) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (data.prompts) await db.prompts.bulkPut(data.prompts);
  if (data.workflows) await db.workflows.bulkPut(data.workflows);
}
```
提交：`git commit -am "feat: 模板 JSON 导出/导入 (.promptos.json)"`

---

### Task 7-2: Supabase 配置 + shared_templates 表

**涉及文件：** `src/services/supabase.ts`, `.env.local`

```bash
pnpm add @supabase/supabase-js
```

**在 Supabase 控制台执行：**
```sql
create table shared_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  payload jsonb not null,
  created_at timestamptz default now()
);
alter table shared_templates enable row level security;
create policy "public read" on shared_templates for select using (true);
create policy "public insert" on shared_templates for insert with check (true);
```

**`src/services/supabase.ts`：**
```ts
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);
```

**`.env.local`（不提交 git）：**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
提交：`git commit -am "feat: 配置 Supabase 客户端 (不含 .env.local)"`

---

### Task 7-3: 生成分享链接

**涉及文件：** `src/services/share.ts`

```ts
import { supabase } from "./supabase";
import { db } from "@/db";
export async function publishTemplate(title: string, description: string, promptIds: string[]) {
  const prompts = (await db.prompts.bulkGet(promptIds)).filter(Boolean);
  const { data, error } = await supabase
    .from("shared_templates")
    .insert({ title, description, payload: { prompts } })
    .select("id").single();
  if (error) throw error;
  return `${location.origin}/share/${data.id}`;
}
```

在 Templates 页加入 UI：选择 Prompt 复选框 → 填写标题/描述 → 发布 → 弹出可复制链接。

提交：`git commit -am "feat: 发布模板到 Supabase 生成分享链接"`

---

### Task 7-4: ShareView 预览 + 一键导入

**涉及文件：** `src/pages/ShareView.tsx`，路由加 `/share/:id`

```tsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/services/supabase";
import { db } from "@/db";
export default function ShareView() {
  const { id } = useParams();
  const [tpl, setTpl] = useState<any>(null);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("shared_templates").select("*").eq("id", id!).single();
    setTpl(data);
  })(); }, [id]);
  if (!tpl) return <div className="p-6 text-center">加载中...</div>;
  const prompts: any[] = tpl.payload.prompts ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{tpl.title}</h1>
      <p className="text-foreground/70">{tpl.description}</p>
      <p className="text-sm">包含 {prompts.length} 条 Prompt</p>
      <ul className="space-y-2">
        {prompts.map((p: any) => <li key={p.id} className="rounded border px-3 py-2 text-sm">{p.title}</li>)}
      </ul>
      <button onClick={async () => { await db.prompts.bulkPut(prompts); alert(`已导入 ${prompts.length} 条 Prompt`); }}
        className="rounded bg-accent px-4 py-2 text-white">导入到我的库</button>
    </div>
  );
}
```
提交：`git commit -am "feat: ShareView 模板预览 + 一键导入"`

---

## 阶段八：首页 Dashboard + 收尾（Day 21-22）

### Task 8-1: Home Dashboard

**涉及文件：** `src/pages/Home.tsx`

```tsx
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/db";
import { useNavigate } from "react-router-dom";
import { PromptCard } from "@/components/prompt/PromptCard";

export default function Home() {
  const navigate = useNavigate();
  const recent = useLiveQuery(() =>
    db.prompts.orderBy("lastUsedAt").reverse().filter((p) => !!p.lastUsedAt).limit(6).toArray()
  ) ?? [];
  const favs = useLiveQuery(() => db.prompts.filter((p) => p.isFavorited).limit(6).toArray()) ?? [];
  const workflows = useLiveQuery(() => db.workflows.orderBy("updatedAt").reverse().limit(4).toArray()) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <input placeholder="想做什么？搜索或描述你的任务..."
          className="h-11 w-full rounded-lg border px-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
          onKeyDown={(e) => { if (e.key === "Enter") navigate(`/prompts?q=${(e.target as HTMLInputElement).value}`); }} />
      </div>
      <Section title="最近使用" items={recent} renderItem={(p) => <PromptCard p={p} />} />
      <Section title="收藏" items={favs} renderItem={(p) => <PromptCard p={p} />} />
      <div>
        <h2 className="mb-3 font-semibold">高频工作流</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {workflows.map((w) => (
            <button key={w.id} onClick={() => navigate("/workflows")}
              className="rounded-lg border p-3 text-left hover:border-accent/50">
              <div className="font-medium">{w.title}</div>
              <div className="text-sm text-foreground/70">{w.goal}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function Section({ title, items, renderItem }: { title: string; items: any[]; renderItem: (i: any) => JSX.Element }) {
  if (!items.length) return null;
  return (
    <div>
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map(renderItem)}</div>
    </div>
  );
}
```
提交：`git commit -am "feat: 首页 Dashboard (最近使用/收藏/工作流/快速搜索)"`

---

### Task 8-2: 空状态 UI 组件

**涉及文件：** `src/components/EmptyState.tsx`

```tsx
export function EmptyState({ icon, title, description, action }: {
  icon: string; title: string; description: string; action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="text-4xl">{icon}</div>
      <div className="font-semibold">{title}</div>
      <div className="max-w-xs text-sm text-foreground/60">{description}</div>
      {action && <button onClick={action.onClick} className="rounded bg-accent px-3 py-1.5 text-sm text-white">{action.label}</button>}
    </div>
  );
}
```
应用到 Prompts、Workflows、Contexts 列表空状态。
提交：`git commit -am "feat: 空状态组件并在各列表接入"`

---

### Task 8-3: 动画与微交互打磨

**涉及文件：** `src/index.css`, `src/App.tsx`

```css
/* src/index.css 追加 */
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.page-enter { animation: fadeIn 200ms ease; }
@keyframes slideInRight { from { transform: translateX(16px); opacity: 0; } to { transform: none; opacity: 1; } }
.detail-enter { animation: slideInRight 180ms ease; }
```
- 在每个页面根元素加 `className="page-enter"`；
- 在详情面板容器加 `className="detail-enter"`；
- 复制按钮点击后 200ms 显示"✓ 已复制"文案（useState + setTimeout）。

提交：`git commit -am "polish: fade-in/slide-in 动画 + 复制按钮状态反馈"`

---

### Task 8-4: 最终验收 + 打包

```bash
# 全量单测
pnpm vitest run

# TypeScript 类型检查
pnpm dlx tsc --noEmit

# 生产构建
pnpm build

# 验收清单（手动测试）
# 1. 新建 Prompt → 详情面板同步 ✓
# 2. 复制正文 → 粘贴板内容仅正文 ✓
# 3. 粘贴 10 条 Prompt → AI 分类 → 至少 7 条高置信度入库 ✓
# 4. 搜索"写作" → 返回写作相关 ✓
# 5. AI 搜索"我要准备一次面试" → 返回面试相关 Prompt + 理由 ✓
# 6. 创建 3 步工作流 → Runner 引导运行 ✓
# 7. 调用 Prompt + 选 2 个上下文 → 复制内容 = Context1 + Context2 + Prompt 正文 ✓
# 8. 发布模板 → 复制链接 → 新标签页打开 → 预览 + 导入 ✓

git add .
git commit -m "feat: 最终验收通过 MVP v0.1.0"
git tag v0.1.0-mvp
```

---

## 风险与缓解

| 风险 | 缓解方案 |
|------|----------|
| Dexie 布尔索引查询异常 | `pendingReview` 用 `filter()` 而非索引查询；IndexedDB 不支持直接布尔索引 |
| `dangerouslyAllowBrowser` 安全 | 仅本地使用，README 强调"不在共享设备使用"；后续可加代理服务器 |
| Anthropic 速率限制 | classifier 并发限 3，失败自动回退为 `pendingReview: true` 占位 |
| Supabase 公开写入滥用 | MVP 接受；后续加 Cloudflare Turnstile 或一次性 token |
| 场景路径字符串与 scenarios 表脱节 | 阶段三完成后，`classifyBatch` 结束时调用 `ensureScenarioPath()` 把新场景自动 upsert 到 scenarios 表 |
| 批量导入 1000 条时 UI 卡顿 | `bulkAdd` 分批 100 条提交；分类进度用 `requestAnimationFrame` 更新 |

---

## 时间表速览

| 阶段 | 时间 | 关键交付物 | 验收标准 |
|------|------|-----------|---------|
| 一 | Day 1-2 | 脚手架 + Dexie + 类型 + 路由 | 7 页面可切换，IndexedDB 5 表创建，单测通过 |
| 二 | Day 3-5 | Prompt 三栏 CRUD | 新建/编辑/收藏/复制正文/删除，数据刷新不丢失 |
| 三 | Day 6-9 | 批量导入 + AI 分类 | 粘贴 50 条 → 分类 → 入库，<0.7 进待确认 |
| 四 | Day 10-12 | 关键词 + AI 意图搜索 | <200ms 关键词；AI 意图返回 8 条带理由 |
| 五 | Day 13-15 | Workflow + Runner | 3 步工作流拖拽 + 引导运行 |
| 六 | Day 16-17 | Context + 拼接 | 复制时可拼接选中上下文，预览正确 |
| 七 | Day 18-20 | JSON + Supabase 分享 | 发布链接 → 新标签页预览 + 导入成功 |
| 八 | Day 21-22 | 首页 + 动画 + 打包 | Dashboard 显示、动画流畅、`pnpm build` 成功 |
