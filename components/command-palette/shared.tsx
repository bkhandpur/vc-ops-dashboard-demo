"use client";

import { ArrowLeft, Check } from "lucide-react";
import type { ReactNode } from "react";

import { Button, Callout, Panel } from "../ui";

/** Props every palette action component receives. */
export interface PaletteActionProps {
  /** Return to the action list. */
  onBack: () => void;
  /** Close the whole palette (used after a successful write). */
  onClose: () => void;
}

export function ActionShell({
  title,
  subtitle,
  onBack,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded p-1 text-ink-subtle hover:bg-surface-sunken hover:text-ink"
          aria-label="Back to actions"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <p className="text-[13px] font-medium text-ink">{title}</p>
          {subtitle && <p className="text-[11px] text-ink-subtle">{subtitle}</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * The mandatory confirm step. Every write to the CRM in this app renders one of these
 * first — no silent writes, per project rule.
 */
export function ConfirmSummary({
  heading,
  rows,
  note,
}: {
  heading: string;
  rows: { label: string; value: ReactNode }[];
  note?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] font-medium text-ink">{heading}</p>
      <Panel className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-3 px-3 py-2 text-[13px]">
            <span className="w-32 shrink-0 text-ink-subtle">{row.label}</span>
            <span className="min-w-0 break-words text-ink">{row.value || "—"}</span>
          </div>
        ))}
      </Panel>
      {note && <Callout tone="warn">{note}</Callout>}
      {/*
        Every confirm dialog in this build carries this line. It is rendered here so no
        action can be added later that quietly omits it.
      */}
      <p className="text-[11px] leading-relaxed text-ink-subtle">
        This action updates local demo data only.
        Nothing leaves this machine, and the change will not survive a restart.
      </p>
    </div>
  );
}

export function SuccessState({
  heading,
  detail,
  links,
  onClose,
}: {
  heading: string;
  detail?: string;
  links?: { label: string; href: string }[];
  onClose: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-[13px] font-medium text-positive">
        <Check className="size-4" /> {heading}
      </p>
      {detail && <p className="text-[13px] text-ink-muted">{detail}</p>}
      {links?.length ? (
        <div className="flex flex-wrap gap-3">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-[13px] text-accent underline"
            >
              {link.label}
            </a>
          ))}
        </div>
      ) : null}
      <Button variant="secondary" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

/** Narrow an unknown fetch failure into something showable. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === "string" ? err : "Unexpected error";
}

/** POST JSON to one of our own API routes. Never talks to the CRM directly. */
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(payload?.error || `Request failed (${res.status})`);
  return payload as T;
}
