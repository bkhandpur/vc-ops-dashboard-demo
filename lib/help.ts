/**
 * Help docs loader.
 *
 * ── HOW TO ADD A HELP ARTICLE ────────────────────────────────────────────────
 * Drop a new `.md` file into /content/help/. It appears in the Help nav and the
 * search index automatically — no code change, no registry to update.
 *
 * Frontmatter (all optional):
 *   ---
 *   title: Human readable title      # defaults to the filename
 *   order: 30                        # nav sort order, ascending; default 999
 *   summary: One-line description    # shown under the title in the nav + search
 *   ---
 * ─────────────────────────────────────────────────────────────────────────────
 */

import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

/** Read the three simple frontmatter fields used by the committed help articles. */
function matter(raw: string): { data: Record<string, string | number>; content: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(raw);
  const data: Record<string, string | number> = {};
  if (!match) return { data, content: raw };
  for (const line of match[1]!.split(/\r?\n/)) {
    const field = /^(title|summary|order):\s*(.*)$/.exec(line);
    if (!field) continue;
    const value = field[2]!.replace(/^["']|["']$/g, "");
    data[field[1]!] = field[1] === "order" ? Number(value) : value;
  }
  return { data, content: raw.slice(match[0].length) };
}

export const HELP_DIR = path.join(process.cwd(), "content", "help");

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  order: number;
  /** Markdown body, frontmatter stripped. */
  content: string;
}

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export async function getHelpArticles(): Promise<HelpArticle[]> {
  let files: string[];
  try {
    files = await fs.readdir(HELP_DIR);
  } catch {
    return [];
  }

  const articles = await Promise.all(
    files
      .filter((f) => f.endsWith(".md"))
      .map(async (file) => {
        const slug = file.replace(/\.md$/, "");
        const raw = await fs.readFile(path.join(HELP_DIR, file), "utf8");
        const { data, content } = matter(raw);
        return {
          slug,
          title: typeof data.title === "string" ? data.title : titleFromSlug(slug),
          summary: typeof data.summary === "string" ? data.summary : "",
          order: typeof data.order === "number" ? data.order : 999,
          content: content.trim(),
        } satisfies HelpArticle;
      }),
  );

  return articles.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export async function getHelpArticle(slug: string): Promise<HelpArticle | null> {
  const articles = await getHelpArticles();
  return articles.find((a) => a.slug === slug) ?? null;
}
