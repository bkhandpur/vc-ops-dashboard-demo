"use client";

import { PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { WatershedWordmark } from "./brand/WatershedWordmark";
import { useCommandPalette } from "./command-palette/CommandPaletteProvider";
import { activeRoute, NAV_GROUPS, type NavItem } from "./nav-config";
import { useSidebar } from "./SidebarState";
import { ThemeToggle } from "./theme/ThemeToggle";
import { cx } from "./ui";

const ROW =
  "flex w-full items-center gap-2.5 rounded-[2px] px-2.5 py-[7px] text-[12px] transition-colors duration-[var(--dur-quick)]";

/**
 * The sidebar, in three layouts (see SidebarState.tsx for how the layout is chosen).
 *
 * Group headers remain visible in every layout so the larger navigation stays scannable.
 */
export function Sidebar() {
  const { layout, overlayOpen, closeOverlay } = useSidebar();

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (layout === "overlay" && overlayOpen && !element.open) element.showModal();
    else if (!overlayOpen && element.open) element.close();
  }, [layout, overlayOpen]);

  if (layout === "overlay") {
    return (
      <dialog
        ref={dialog}
        aria-label="Main navigation"
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[15rem] max-w-none border-0 border-r border-white/10 bg-[var(--brand-navy)] p-0 text-white backdrop:bg-black/40 sm:hidden"
        onCancel={(event) => {
          event.preventDefault();
          closeOverlay();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeOverlay();
          if (event.key !== "Tab" || event.ctrlKey || event.metaKey || event.altKey) return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
            ),
          ].filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <nav aria-label="Main navigation" className="h-full">
          <SidebarBody mode="full" showClose />
        </nav>
      </dialog>
    );
  }

  return (
    <nav
      aria-label="Main navigation"
      className={cx(
        "flex h-full shrink-0 flex-col border-r border-white/10 bg-[var(--brand-navy)] transition-[width] duration-[var(--dur-base)] ease-[var(--ease-out)]",
        layout === "rail" ? "w-[3.25rem]" : "w-[10.5rem]",
      )}
    >
      <SidebarBody mode={layout} />
    </nav>
  );
}

function SidebarBody({ mode, showClose = false }: { mode: "full" | "rail"; showClose?: boolean }) {
  const pathname = usePathname();
  const { openPalette } = useCommandPalette();
  const { closeOverlay, collapsed, toggleCollapsed, layout } = useSidebar();
  const rail = mode === "rail";
  const active = activeRoute(pathname);

  // Navigating inside the overlay must close it — the single most irritating mobile-nav
  // bug is the menu staying open on top of the page you just asked for.
  useEffect(() => {
    closeOverlay();
  }, [pathname, closeOverlay]);

  return (
    <div className="flex h-full flex-col">
      <div
        className={cx(
          "flex min-h-14 items-center gap-2.5 border-b border-white/10 py-3",
          rail ? "justify-center px-2" : "px-3",
        )}
      >
        {rail ? (
          <span aria-hidden className="grid size-7 shrink-0 place-items-center overflow-hidden">
            <WatershedWordmark text="W" height={19} detail={false} />
          </span>
        ) : (
          <WatershedWordmark text="WATERSHED" height={17} detail={false} />
        )}
        {showClose && (
          <button
            type="button"
            onClick={closeOverlay}
            aria-label="Close navigation"
            className="ml-auto rounded p-1 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className={cx("flex-1 overflow-y-auto pb-2", rail ? "px-1.5" : "px-2")}>
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className={groupIndex > 0 ? "mt-4" : ""}>
            {group.label &&
              (rail ? (
                // The group survives as a labelled rule rather than vanishing.
                <p
                  className="mb-1 border-t border-white/10 pt-2 text-center text-[9px] font-semibold tracking-[0.06em] text-white/65 uppercase"
                  title={group.label}
                >
                  {group.label.slice(0, 3)}
                </p>
              ) : (
                <p className="px-2.5 pb-1 text-[9px] font-bold tracking-[0.12em] text-[#87b7aa] uppercase">
                  {group.label}
                </p>
              ))}
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.kind === "route" ? (
                    <Link
                      href={item.route}
                      title={rail ? item.label : undefined}
                      aria-label={rail ? item.label : undefined}
                      className={cx(
                        ROW,
                        rail && "justify-center px-0",
                        active === item.route
                          ? "bg-white/14 font-semibold text-white"
                          : "text-white/62 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <NavIcon item={item} />
                      {!rail && <span className="truncate">{item.label}</span>}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={openPalette}
                      title={rail ? item.label : undefined}
                      aria-label={rail ? item.label : undefined}
                      className={cx(
                        ROW,
                        rail && "justify-center px-0",
                        "text-white/62 hover:bg-white/8 hover:text-white",
                      )}
                    >
                      <NavIcon item={item} />
                      {!rail && (
                        <>
                          <span className="flex-1 truncate text-left">{item.label}</span>
                          {item.shortcut && (
                            <kbd className="shrink-0 rounded border border-white/15 px-1 py-0.5 text-[10px] text-white/65">
                              {item.shortcut}
                            </kbd>
                          )}
                        </>
                      )}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* The collapse toggle only appears where it means anything — below 1024px the
          layout is dictated by the viewport and a manual override would just fight it. */}
      {layout !== "overlay" && (
        <div className={cx("border-t border-white/10 py-2", rail ? "px-1.5" : "px-3")}>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cx(
              ROW,
              rail && "justify-center px-0",
              "text-white/65 hover:bg-white/8 hover:text-white",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" />
            ) : (
              <PanelLeftClose className="size-4 shrink-0" />
            )}
            {!rail && <span className="truncate">Collapse</span>}
          </button>
        </div>
      )}

      <div className={cx("border-t border-white/10 py-3", rail ? "px-1.5" : "px-4")}>
        <ThemeToggle compact={rail} inverted />
      </div>

      {!rail && (
        <div className="border-t border-white/10 px-4 py-3">
          <a
            href="/help/what-this-demo-is"
            className="text-[10px] text-white/50 hover:text-white/80 hover:underline"
          >
            About this demo
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * The command-palette item wants a lightning bolt with a small "+". lucide has no
 * combined glyph, so we compose Zap with a Plus badge. The badge is what marks an item
 * as able to write.
 */
function NavIcon({ item }: { item: NavItem }) {
  const Icon = item.icon;
  if (item.kind === "action" && item.action === "open-command-palette") {
    return (
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <Icon className="size-4" />
        <Plus
          className="absolute -right-1 -bottom-1 size-2.5 rounded-full bg-surface"
          strokeWidth={3}
        />
      </span>
    );
  }
  return <Icon className="size-3.5 shrink-0" />;
}
