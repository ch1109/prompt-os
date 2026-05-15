import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  text: string;
  className?: string;
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="mt-5 mb-3 text-[20px] font-semibold leading-snug tracking-tight text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-[18px] mb-2.5 text-[18px] font-semibold leading-snug tracking-tight text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 mb-2 text-[16px] font-semibold leading-snug text-ink first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-3.5 mb-1.5 text-[13px] font-semibold uppercase tracking-wider2 text-sub first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="my-2.5 leading-[1.82] text-ink/90">{children}</p>,
  ul: ({ children, ...props }) => (
    <ul
      {...props}
      className="my-2.5 ml-5 list-disc space-y-1.5 marker:text-hint [&_ul]:my-0"
    >
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol
      {...props}
      className="my-2.5 ml-5 list-decimal space-y-1.5 marker:text-hint [&_ol]:my-0"
    >
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li {...props} className="leading-[1.78] text-ink/90">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3.5 rounded-r-xl border-l-2 border-moss/[0.45] bg-moss-soft/40 px-4 py-2.5 text-sub [&_p]:my-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-5 border-line/80" />,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-moss underline decoration-moss/30 underline-offset-2 hover:decoration-moss"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic text-ink/90">{children}</em>,
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} mono`} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="mono rounded-md border border-line/60 bg-soft/80 px-1.5 py-0.5 text-[0.92em] text-ink/90"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mono my-3.5 overflow-x-auto rounded-xl border border-line/75 bg-paper/[0.72] p-4 text-[13px] leading-[1.8] text-ink/90 shadow-[inset_0_1px_0_rgb(var(--paper)/0.65)]">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3.5 overflow-x-auto rounded-lg border border-line/75">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-soft/80 text-sub">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-line/75 px-2.5 py-1.5 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-line/75 px-2.5 py-1.5 align-top">{children}</td>,
};

export function MarkdownView({ text, className = "" }: Props) {
  return (
    <div className={`text-[15px] leading-[1.82] ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
