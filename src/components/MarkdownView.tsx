import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  text: string;
  className?: string;
}

const COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="serif mt-4 mb-2 text-[16px] font-semibold leading-snug text-ink first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="serif mt-3.5 mb-1.5 text-[14.5px] font-semibold leading-snug text-ink first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="serif mt-3 mb-1 text-[13.5px] font-semibold leading-snug text-ink first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-2.5 mb-1 text-[12.5px] font-semibold uppercase tracking-wider2 text-sub first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="my-1.5 leading-[1.75] text-ink/90">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-hint [&_ul]:my-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-hint [&_ol]:my-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-[1.7] text-ink/90">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-moss/40 bg-moss-soft/30 px-3 py-1.5 text-sub [&_p]:my-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-line" />,
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
        className="mono rounded bg-soft px-1 py-px text-[0.92em] text-ink/90"
        {...rest}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mono my-2 overflow-x-auto rounded border border-line bg-canvas p-3 text-[12px] leading-[1.7] text-ink/90">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-soft text-sub">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-line px-2 py-1 text-left font-medium">{children}</th>
  ),
  td: ({ children }) => <td className="border border-line px-2 py-1 align-top">{children}</td>,
};

export function MarkdownView({ text, className = "" }: Props) {
  return (
    <div className={`text-[12.5px] leading-[1.7] ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
