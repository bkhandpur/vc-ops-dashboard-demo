import { demoSession, withDemoPage } from "@/lib/demo-session";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AppShell } from "@/components/AppShell";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme/ThemeProvider";
import { readOrBuildPeople } from "@/lib/people";
import { readOrBuildSnapshot } from "@/lib/stats";

import "./globals.css";

export const metadata: Metadata = {
  title: "VC Operations Dashboard | Fictional Demo",
  description: "Pipeline, portfolio, sourcing and co-investor workflows in one dashboard.",
};

async function RequestShell({ children }: { children: React.ReactNode }) {
  /**
   * The search index is read here, once, for the whole app.
   *
   * These are cache reads, not external calls — the "page loads never call an external
   * service" rule holds. Reading them in the layout rather than per page means ⌘/ works
   * from anywhere in the app with nothing left to fetch when the user presses it.
   */
  const [stats, people] = await Promise.all([readOrBuildSnapshot(), readOrBuildPeople()]);

  return (
    <ThemeProvider>
      <AppShell
        searchIndex={{
          companies: stats.data.companies,
          founders: people.data.stealthFounders,
          coInvestors: people.data.coInvestors,
        }}
        snapshotGeneratedAt={stats.generatedAt}
        stateError={demoSession().stateError}
      >
        {children}
      </AppShell>
    </ThemeProvider>
  );
}

const ScopedShell = withDemoPage(RequestShell);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Suspense fallback={<div role="status">Loading fictional workspace</div>}>
          <ScopedShell>{children}</ScopedShell>
        </Suspense>
      </body>
    </html>
  );
}
