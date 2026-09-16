"use client";

import type { ReactNode } from "react";

import type { SearchIndex } from "@/lib/search";

import { EntrySplash } from "./brand/EntrySplash";
import { MobileQuickAccess } from "./MobileQuickAccess";
import { CommandPaletteProvider } from "./command-palette/CommandPaletteProvider";
import { SearchProvider } from "./search/SearchProvider";
import { Sidebar } from "./Sidebar";
import { SidebarProvider } from "./SidebarState";
import { TopBar } from "./TopBar";

/**
 * Client shell: sidebar, top bar, search and command palette, wrapped around
 * server-rendered page content. Both overlays live here so they float above whatever
 * page is active.
 *
 * The search index arrives as a prop from the server layout — it is derived from the
 * cached snapshot, so search costs no request and the "page loads never call an external service" rule
 * holds.
 *
 * The responsive sidebar decides rail vs overlay by width.
 */
export function AppShell({
  children,
  searchIndex,
  snapshotGeneratedAt,
}: {
  children: ReactNode;
  searchIndex: SearchIndex;
  snapshotGeneratedAt: string | null;
}) {
  return (
    <SidebarProvider>
      <CommandPaletteProvider index={searchIndex}>
        <SearchProvider index={searchIndex} generatedAt={snapshotGeneratedAt}>
          <EntrySplash />
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopBar snapshotGeneratedAt={snapshotGeneratedAt} />
              <main className="flex-1 overflow-y-auto bg-canvas">
                <div className="mx-auto max-w-[1680px] px-4 py-5 sm:px-6 sm:py-6 lg:px-7">
                  {/* Narrow screens only — see the header of MobileQuickAccess. */}
                  <MobileQuickAccess />
                  {children}
                </div>
              </main>
            </div>
          </div>
        </SearchProvider>
      </CommandPaletteProvider>
    </SidebarProvider>
  );
}
