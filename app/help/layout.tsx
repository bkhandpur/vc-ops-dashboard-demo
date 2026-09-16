import { HelpBrowser } from "@/components/help/HelpBrowser";
import { getHelpArticles } from "@/lib/help";

export const metadata = { title: "Help" };

/**
 * Shared shell for /help and /help/[slug]. The article index is read from
 * /content/help/*.md on the server and handed to the client search box.
 */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const articles = await getHelpArticles();

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Help</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-ink-muted">
          Guides to dashboard views and workflows.
        </p>
      </header>

      <div className="flex gap-8">
        <HelpBrowser
          articles={articles.map((a) => ({
            slug: a.slug,
            title: a.title,
            summary: a.summary,
            content: a.content,
          }))}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
