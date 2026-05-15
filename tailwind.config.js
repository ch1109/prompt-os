/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 通过 CSS 变量驱动主题切换（:root 与 :root.dark 分别在 index.css 定义）
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        sub: "rgb(var(--sub) / <alpha-value>)",
        hint: "rgb(var(--hint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        soft: "rgb(var(--soft) / <alpha-value>)",
        moss: "rgb(var(--moss) / <alpha-value>)",
        "moss-soft": "rgb(var(--moss-soft) / <alpha-value>)",
        amber: "rgb(var(--amber) / <alpha-value>)",
        "amber-soft": "rgb(var(--amber-soft) / <alpha-value>)",

        // 兼容旧引用（仍然走 CSS 变量）
        border: "rgb(var(--line) / <alpha-value>)",
        background: "rgb(var(--canvas) / <alpha-value>)",
        foreground: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--soft) / <alpha-value>)",
        accent: "rgb(var(--moss) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          '"Avenir Next"',
          '"PingFang SC"',
          '"Noto Sans SC"',
          '"Microsoft YaHei UI"',
          'sans-serif',
        ],
        serif: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          'STSong',
          'ui-serif',
          'serif',
        ],
        mono: [
          'ui-monospace',
          '"SF Mono"',
          '"JetBrains Mono"',
          'Menlo',
          'monospace',
        ],
      },
      fontSize: {
        // 略调大以贴近 Notion 阅读舒适度
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
      },
      letterSpacing: {
        wider2: '0.08em',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',
        md: '0.625rem',
        lg: '0.875rem',
      },
    },
  },
  plugins: [],
};
