# Prompt OS

场景驱动的本地提示词工作台。同一份代码同时跑 **web**（Vite）与 **桌面端**（Electron）。

## 命令

```bash
pnpm dev              # web 开发服务器 http://localhost:5173
pnpm build            # 类型检查 + 生产构建
pnpm desktop:start    # 构建后用 Electron 打开（本地验证打包形态）
pnpm desktop:dev      # 连 http://localhost:5173 调 UI（需先另开 pnpm dev）
pnpm desktop:build    # 打 macOS dmg，产物在 release/
```

> `desktop:dev` 的 origin 是 localhost，**IndexedDB 与打包后的 `app://promptos` 不是同一个库**——只用来改界面，别在里面录真实数据。

## 桌面端说明

- 页面通过自定义协议 `app://promptos` 加载 `dist/`，主进程做 SPA 回退，因此 BrowserRouter 路由刷新不白屏，`/seed-prompts.json` 这类站点根绝对路径也照常可用。
- dmg **未做签名与公证**：首次打开需右键 →「打开」，或在「系统设置 → 隐私与安全性」放行。
- 桌面端首次使用要在 **设置 → 数据管理 → 仓库目录** 里选中本仓库根目录，之后才能「保存快照到仓库」与读取仓库最新数据。
- API Key / 主题等偏好存在 localStorage，同样按 origin 隔离，**桌面端需要重新填一次 API Key**。

## web ↔ 桌面 数据同步

两端是两个独立的 IndexedDB，统一靠仓库快照 `public/data-snapshot.json` 做镜像（last-writer-wins，勿两端同时编辑）：

1. 编辑端点「保存快照到仓库」——自动写盘 + `git commit` + `git push`（web 端需 `pnpm dev`；桌面端需已绑定仓库目录）。
2. 另一端：web 端先 `git pull`；桌面端读的就是磁盘实时文件，`git pull` 后直接点「从仓库恢复最新数据」即可。

首次把 web 数据搬到桌面端：先在 web 端保存快照，再在桌面端绑定仓库目录并点「从仓库恢复最新数据」。

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
