import { notFound } from "next/navigation";

import { Markdown } from "@/components/help/Markdown";
import { getHelpArticle, getHelpArticles } from "@/lib/help";

export async function generateStaticParams() {
  const articles = await getHelpArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  return { title: article ? `${article.title} — Help` : "Help" };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  if (!article) notFound();

  return (
    <article>
      <h2 className="text-[16px] font-semibold text-ink">{article.title}</h2>
      {article.summary && <p className="mt-1 text-[13px] text-ink-muted">{article.summary}</p>}
      <Markdown>{article.content}</Markdown>
    </article>
  );
}
