/**
 * Shared primitives. Small on purpose — enough to keep spacing, typography and motion
 * consistent without pulling in a component library. Extend here rather than re-styling
 * inline, so a page added next month inherits the same feel for free.
 *
 * Everything here styles via the `@theme` tokens in globals.css. Nothing in this file
 * may reference a chart series colour: identity colour belongs to data marks only.
 */

"use client";

import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export { cx };

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hover border border-transparent shadow-[var(--shadow-panel)]",
  secondary:
    "bg-surface text-ink border border-line hover:border-line-strong hover:bg-surface-sunken",
  ghost:
    "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink border border-transparent",
  danger: "bg-negative text-white hover:opacity-90 border border-transparent",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 text-[13px] font-medium",
        // Scale on press only — a hover lift on a toolbar button reads as fidgety.
        "transition-[color,background-color,border-color,transform] duration-[var(--dur-quick)] ease-[var(--ease-out)] active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        BUTTON_STYLES[variant],
        className,
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Panel({
  children,
  className,
  /** Adds the hover lift. Only for panels that are themselves a link or button. */
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cx(
        "rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow-panel)]",
        interactive && "ws-lift hover:border-line-strong",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Title row inside a Panel, with the waterline motif under it. */
export function PanelHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="ws-waterline flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  /** Small line above the title, e.g. a breadcrumb or a section name. */
  eyebrow,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="ws-enter mb-5 flex items-start justify-between gap-6">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[10px] font-bold tracking-[0.11em] text-ink-muted uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[20px] leading-tight font-bold text-ink">{title}</h1>
        {description && (
          <div className="mt-1 max-w-3xl text-[12px] leading-relaxed text-ink-muted">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

/**
 * A single headline number. `value` is pre-formatted by the caller, because the caller
 * is the only thing that knows whether it is a count, a percentage or a currency.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "positive" | "negative" | "warning";
  className?: string;
}) {
  const toneClass = {
    default: "text-ink",
    positive: "text-positive",
    negative: "text-negative",
    warning: "text-warning",
  }[tone];

  return (
    <Panel className={cx("px-4 py-3", className)}>
      <p className="text-[11px] font-medium tracking-[0.04em] text-ink-subtle uppercase">{label}</p>
      <p className={cx("ws-nums mt-1.5 text-[26px] leading-none font-semibold", toneClass)}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-[11px] text-ink-muted">{hint}</p>}
    </Panel>
  );
}

type BadgeTone = "neutral" | "accent" | "positive" | "negative" | "warning";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-line bg-surface-sunken text-ink-muted",
  accent: "border-accent/25 bg-accent-soft text-accent",
  positive: "border-positive/25 bg-positive/10 text-positive",
  negative: "border-negative/25 bg-negative/10 text-negative",
  warning: "border-warning/25 bg-warning/10 text-warning",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Horizontal meter for a 0–100 value. Used by Data Health for coverage and by the
 * founder tracker for outreach. Deliberately monochrome: this is magnitude within one
 * row, never identity, so it must not borrow a series hue.
 */
export function Meter({
  pct,
  tone = "accent",
  className,
}: {
  pct: number;
  tone?: "accent" | "positive" | "warning" | "negative";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fill = {
    accent: "bg-accent",
    positive: "bg-positive",
    warning: "bg-warning",
    negative: "bg-negative",
  }[tone];
  return (
    <span
      className={cx("block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}
      role="img"
      aria-label={`${Math.round(clamped)}%`}
    >
      <span
        className={cx("block h-full rounded-full transition-[width]", fill)}
        style={{ width: `${clamped}%`, transitionDuration: "var(--dur-slow)" }}
      />
    </span>
  );
}

/** Consistent empty state. Every list view uses this rather than inventing copy. */
export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-subtle">{icon}</div>}
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-[13px] text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx("ws-skeleton block", className)} aria-hidden />;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

/**
 * Segmented control for mutually exclusive view switches (chart view, sort order).
 * Generic over the option value so callers keep their union types.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode; title?: string }[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-[var(--radius-control)] border border-line bg-surface-sunken p-0.5"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition-colors duration-[var(--dur-quick)]",
              selected
                ? "bg-surface text-ink shadow-[var(--shadow-panel)]"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle pill, for non-exclusive filters like the stage selector. */
export function TogglePill({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cx(
        "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-[var(--dur-quick)] disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-accent/30 bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline gap-1 text-[12px] font-medium text-ink-muted">
        {label}
        {required && <span className="text-negative">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-subtle">{hint}</span>}
    </label>
  );
}

const CONTROL =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink placeholder:text-ink-subtle transition-colors duration-[var(--dur-quick)] focus:border-accent focus:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CONTROL, className)} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CONTROL, "min-h-24 resize-y", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CONTROL, className)} />;
}

/** Checkbox list for CRM multiselect fields. */
export function MultiSelect({
  options,
  selected,
  onChange,
  emptyLabel = "No options available",
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  if (options.length === 0) {
    return <p className="text-[12px] text-ink-subtle">{emptyLabel}</p>;
  }
  return (
    <div className="max-h-36 space-y-1 overflow-y-auto rounded-[var(--radius-control)] border border-line-strong bg-surface p-2">
      {options.map((option) => {
        const checked = selected.includes(option);
        return (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={checked}
              onChange={() =>
                onChange(checked ? selected.filter((o) => o !== option) : [...selected, option])
              }
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

export function Callout({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "border-line bg-surface-sunken text-ink-muted",
    warn: "border-warning/30 bg-warning/5 text-warning",
    error: "border-negative/30 bg-negative/5 text-negative",
  } as const;
  return (
    <div
      className={cx("rounded-[var(--radius-control)] border px-3 py-2 text-[13px]", tones[tone])}
    >
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
      <span className="size-3 animate-spin rounded-full border-2 border-line-strong border-t-accent" />
      {label}
    </span>
  );
}

/**
 * Footnote under a chart or table. Every counting caveat in this app is rendered with
 * this, so they all look like the same kind of statement rather than ad-hoc asides.
 */
export function Footnote({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-relaxed text-ink-subtle">{children}</p>;
}
