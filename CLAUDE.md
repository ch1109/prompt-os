# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
pnpm dev                                # 启动开发服务器 http://localhost:5173
pnpm build                              # tsc -b && vite build（类型检查 + 生产构建）
pnpm lint                               # ESLint 检查
pnpm preview                            # 预览生产构建产物
pnpm exec vitest run                    # 运行所有单元测试
pnpm exec vitest run src/db/repos/      # 只跑 repo 层测试
pnpm exec vitest run --reporter=verbose # 带详情输出
pnpm exec tsc --noEmit                  # 仅类型检查（不生成文件）
```

## 技术栈

React 19 + TypeScript 6 + Vite 8 / Tailwind CSS 3 + lucide-react / Zustand 5 / React Router 7 / Dexie.js 4（IndexedDB） / react-markdown + remark-gfm

完全本地 webapp，无后端服务（Supabase 仅在 Templates 页用于可选的模板分享）。

## 架构概览

### 数据层（`src/db/`）

`src/db/index.ts` 定义 `PromptOSDB`（Dexie 子类），5 张表：`prompts` / `contexts` / `scenarios` / `workflows` / `sharedTemplates`。CRUD 操作集中在 `src/db/repos/`，组件通过 repo 暴露的纯函数（`createPrompt`、`incrementUseCount`、`toggleFavorite` 等）操作数据，**不要在组件里直接 `db.prompts.xxx`**。

**Schema 演进**：每次表结构变更都通过 `this.version(N).stores({...}).upgrade(async tx => ...)` 在 `src/db/index.ts` 增加新版本号。当前已升到 v5，迁移函数集中在 `src/db/migrations/`。**绝对不要原地修改旧版本号的 stores**，会破坏老用户数据。

### 启动 seeding 流程（`src/db/seed.ts`）

`src/main.tsx` 调用 `seedAll()`，**串行执行**：

1. `seedPromptsFromFile()` — 仅当 `prompts.count() === 0` 时 `fetch("/seed-prompts.json")` 分批写入种子数据
2. `seedPlaceholderPrompts()`（在 `migrations/v3.ts`）— 36 条占位 prompt 写入/迁移
3. `repairBadTitles()`（`src/db/repairTitles.ts`）— **每次启动都跑**，幂等清洗历史脏标题。三层兜底：body 指纹匹配 seed → summary 替代 → 规则截取
4. `seedDefaultScenarios()` — 仅当 `scenarios.count() === 0` 时基于 prompts 的 `primaryScenario / secondaryScenarios` 生成三级场景树

种子数据来源是 `Prompt大全.md`，通过 `scripts/parse-and-seed.mjs` 离线生成 `public/seed-prompts.json`（运行时 fetch 加载，不打入 bundle）。

### 状态管理（`src/store/`）

| Store | 持久化 | 用途 |
|---|---|---|
| `settingsStore` | `zustand/persist` → localStorage `prompt-os-settings` | API Key / 模型 / 主题三态（`system` / `light` / `dark`） |
| `uiStore` | 内存 | `selectedScenarioId`、`selectedPromptId`、`searchQuery`、筛选器、`mobileSidebarOpen` 等临时 UI 状态 |
| `toastStore` | 内存 | `toast.success / error / info` 全局 API |
| `confirmStore` | 内存 | Promise-based `confirm({title, message, danger})` 替代 native confirm |
| `commandPaletteStore` | 内存 | Cmd+K 命令面板的 open/toggle |

**关键约定**：UI 反馈一律走 `toast` / `confirm`，**禁止使用 native `alert()` / `confirm()`**。Toast/Confirm 的渲染容器（`<Toaster />` / `<ConfirmDialog />`）挂在 `src/App.tsx` 根。

### 三栏布局与移动端适配（`src/components/layout/`）

桌面（≥ md）：顶部 SearchBar + 左 244px Sidebar + 中 flex-1 PromptList + 右 400px PromptDetail（条件渲染）。

< md：Sidebar 改为左侧 280px drawer overlay，PromptDetail 改为全屏 overlay，顶部 nav 折叠到汉堡 drawer。响应式实现完全靠 Tailwind `md:` 前缀，没有移动端复制组件。

### 主题系统（CSS 变量驱动）

**所有颜色都走 CSS 变量**，在 `src/index.css` 的 `:root` / `:root.dark` 两个块定义；`tailwind.config.js` 的 `colors` 引用变量（如 `canvas: "rgb(var(--canvas) / <alpha-value>)"`）。token 命名：`canvas / paper / ink / sub / hint / line / soft / moss / moss-soft / amber / amber-soft`。

切换主题靠 `<ThemeManager />`（在 App 根挂载，无 UI）：监听 `useSettings(s => s.theme)` 与 `prefers-color-scheme`，给 `document.documentElement` 加/删 `dark` 类。Tailwind `darkMode: "class"` 据此自动切换。

**严格约束**：
- 写组件 className 时只用 `bg-canvas / text-ink / border-line` 这类 token，**不要 hardcode 颜色字符串**（如 `bg-white`、`text-zinc-900`、`#fff`），暗色下会断
- 旧代码遗留的 `bg-accent / text-foreground / bg-muted / border-border` 是兼容 alias（仍指向同一组 CSS 变量），但**新代码请用 `moss / ink / soft / line` 这套规范命名**

### 服务层（`src/services/`）

不直接对应单个页面，按职责拆：

- `anthropicClient.ts` — 封装 `callJSON`，从 `useSettings.getState()` 取 apiKey/model
- `parser.ts` — 简单文本切分（按 `###` 或空行）
- `classifier.ts` — Import 流程的 AI 分类（taskType、scenario、tags 等）
- `searcher.ts` — 顶部搜索的「自然语言意图 → 命中资产」匹配
- `relationBuilder.ts` — Settings「重建任务图」按一级场景分组写入 upstream/downstream
- `workflowSuggester.ts` / `titleSuggester.ts` — AI 辅助生成
- `templateExport.ts` — 按 id 选取部分资产导出/导入（用于 Templates 页分享）
- `backup.ts` — 全量导出/导入（用于 Settings 页备份），id 冲突自动重命名而非覆盖
- `share.ts` / `supabase.ts` — 可选的 Supabase 在线分享（仅 Templates 页用，需 `.env.local` 配置 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`）

### Markdown 渲染

`src/components/MarkdownView.tsx` 是项目唯一的 markdown 渲染器，封装 `react-markdown + remark-gfm`，自定义 `components` 映射所有节点到项目 token（serif 标题、moss 引用块、mono 代码、moss 链接等），**不依赖 `@tailwindcss/typography`**。

接入位置：PromptDetail 的「正文」区、UsePromptDialog 的「拼接预览」区。**复制按钮永远复制原始 markdown 文本**——用户复制后给 AI 用，必须保留 markdown 字符。

### 数据订阅（`src/hooks/`）

- `usePrompts.ts` — `useLiveQuery` 订阅 prompts 表，内置场景过滤、关键词搜索、意图结果排序、taskType / difficulty chip 筛选
- `useScenarios.ts` — 订阅全量 scenarios

### 路由（`src/router.tsx`）

11 个顶层页面：`/` (Home) / `prompts` / `scenarios` / `workflows` / `contexts` / `templates` / `settings` / `import` / `pending` / `share/:id`。`App.tsx` 含顶部 nav + `<Outlet />`，并挂载所有全局组件（ThemeManager、CommandPalette、KeyboardShortcuts、Toaster、ConfirmDialog）。

**跨组件唤起编辑器**：Command Palette 的「新建 Prompt / 工作流 / 上下文」靠**路由 hash**（`#new`）触发——CommandPalette 跳到 `/prompts#new`，目标页 `useEffect` 监听 `location.hash === "#new"` 自动打开本地编辑器。这样保持页面级状态局部化，不必把编辑器开关提到 store。

### 路径别名

`@/` → `src/`，需在 `tsconfig.app.json` 的 `paths` 与 `vite.config.ts` 的 `resolve.alias` 中**双处**配置。

## 关键约束

**Schema 变更**：必须新增 `this.version(N+1)`，绝不原地改旧版本。布尔字段不能直接 Dexie 索引查询（如 `pendingReview` 用 `db.prompts.filter(p => !!p.pendingReview).toArray()`）。

**TypeScript 6 路径别名**：`tsconfig.app.json` 必须保留 `"ignoreDeprecations": "6.0"`，否则 `baseUrl` 报弃用错误。不要直接改 `tsconfig.json`（它引用 app/node 两个子配置）。

**测试环境**：`src/test/setup.ts` 中 `fake-indexeddb/auto` 自动注入；repo 层测试可直接用 `db.xxx`；每个 describe 的 `beforeEach` 应 `db.xxx.clear()` 隔离数据。

**重置数据**：DevTools → Application → IndexedDB → 删除 `prompt_os` 数据库；或在 Settings 页用「导出全部数据 / 导入备份」做软迁移。

## 关键架构决策（避免重复踩坑）

1. **CSS 变量 + Tailwind class 而非 React Context Theme** — 切换主题不触发 React 重渲染，整站靠根类名一次切色
2. **content-visibility 而非虚拟滚动库** — `.card-flat` 用浏览器原生 `content-visibility: auto + contain-intrinsic-size`，165+ 卡片场景无需引入 `react-window`
3. **路由 hash 触发编辑器** — 保持页面级状态局部化，避免编辑器开关提到全局 store
4. **Promise-based confirm/toast** — 调用方写 `if (await confirm(...))` 同步代码风格，比传 `onConfirm` 回调好读
5. **手写 markdown components 而非 prose 插件** — 完全控制每个节点的样式与 token，无第三方 typography 默认值冲突
6. **每次启动跑 repairBadTitles** — `seedPromptsFromFile` 仅在空库时跑，老用户的 IndexedDB 不会被新 seed 覆盖；用幂等清洗函数兜底修复历史脏数据，比强制 reseed 更安全（保留 useCount/收藏等状态）
