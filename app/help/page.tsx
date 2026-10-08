import Link from "next/link";

import { Panel } from "@/components/ui";
import { getHelpArticles } from "@/lib/help";

export default async function HelpIndexPage() {
  const articles = await getHelpArticles();

  return (
    <div className="space-y-3">
      {articles.length === 0 && (
        <Panel className="p-6 text-[13px] text-ink-muted">
          No articles yet. Add a markdown file to <code>/content/help/</code> and it will appear
          here.
        </Panel>
      )}
      {articles.map((article) => (
        <Link key={article.slug} href={`/help/${article.slug}`} className="block">
          <Panel className="px-4 py-3 transition-colors hover:border-line-strong">
            <p className="text-[13px] font-medium text-ink">{article.title}</p>
            {article.summary && (
              <p className="mt-0.5 text-[12px] text-ink-muted">{article.summary}</p>
            )}
          </Panel>
        </Link>
      ))}
    </div>
  );
}
