import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Minimal typographic styling for help articles. Server component — no client JS.
 * Tailwind v4 without the typography plugin, so element styles are mapped explicitly.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="max-w-2xl text-[14px] leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 {...props} className="mt-6 mb-2 text-lg font-semibold" />,
          h2: (props) => <h2 {...props} className="mt-6 mb-2 text-[15px] font-semibold" />,
          h3: (props) => <h3 {...props} className="mt-5 mb-1.5 text-[14px] font-semibold" />,
          p: (props) => <p {...props} className="my-3" />,
          ul: (props) => <ul {...props} className="my-3 list-disc space-y-1.5 pl-5" />,
          ol: (props) => <ol {...props} className="my-3 list-decimal space-y-1.5 pl-5" />,
          li: (props) => <li {...props} className="pl-1" />,
          a: (props) => <a {...props} className="text-accent underline" />,
          code: (props) => (
            <code
              {...props}
              className="rounded bg-surface-sunken px-1 py-0.5 font-mono text-[12.5px]"
            />
          ),
          pre: (props) => (
            <pre
              {...props}
              className="my-3 overflow-x-auto rounded-md bg-surface-sunken p-3 text-[12.5px]"
            />
          ),
          blockquote: (props) => (
            <blockquote
              {...props}
              className="my-3 border-l-2 border-line-strong pl-3 text-ink-muted"
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table {...props} className="w-full border-collapse text-[13px]" />
            </div>
          ),
          th: (props) => (
            <th {...props} className="border border-line px-2 py-1 text-left font-medium" />
          ),
          td: (props) => <td {...props} className="border border-line px-2 py-1" />,
          hr: (props) => <hr {...props} className="my-6 border-line" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
