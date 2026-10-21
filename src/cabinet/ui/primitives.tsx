"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type Variant = "primary" | "period" | "soft" | "ghost" | "danger" | "outline";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-c-accent text-c-accent-ink active:opacity-90",
  period: "bg-c-period text-c-period-ink active:opacity-90",
  soft: "bg-c-accent-soft text-c-accent active:opacity-80",
  ghost: "bg-transparent text-c-accent active:bg-c-raised",
  danger: "bg-transparent text-c-danger border border-c-line active:bg-c-raised",
  outline: "bg-c-card text-c-ink border border-c-line active:bg-c-raised",
};

export function Button({
  variant = "primary",
  size = "md",
  block,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
}) {
  const sizes = {
    sm: "min-h-11 px-4 text-sm",
    md: "min-h-12 px-5 text-base",
    lg: "min-h-14 px-6 text-lg",
  } as const;
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex select-none items-center justify-center gap-2 rounded-2xl font-medium transition disabled:opacity-50 ${VARIANTS[variant]} ${sizes[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-c-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}>{children}</section>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-c-subtle">{children}</h2>;
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-base text-c-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm text-c-muted">{hint}</span> : null}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-8 w-[3.25rem] rounded-full bg-c-line transition peer-checked:bg-c-accent peer-focus-visible:ring-2 peer-focus-visible:ring-c-accent peer-disabled:opacity-50" />
        <span className="pointer-events-none absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  unit,
  labelLess = "−",
  labelMore = "+",
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  unit?: string;
  /** Accessible names of the buttons, e.g. "Fewer days" / "More days". */
  labelLess?: string;
  labelMore?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={labelLess}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="h-12 w-12 rounded-2xl bg-c-raised text-2xl text-c-ink disabled:opacity-40"
      >
        −
      </button>
      <output className="min-w-20 text-center text-3xl font-light tabular-nums text-c-ink" aria-live="polite">
        {value}
        {unit ? <span className="ml-1 text-base text-c-muted">{unit}</span> : null}
      </output>
      <button
        type="button"
        aria-label={labelMore}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="h-12 w-12 rounded-2xl bg-c-raised text-2xl text-c-ink disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export function Chip({
  on,
  onClick,
  children,
  tone = "accent",
  disabled,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "accent" | "period" | "fertile";
  disabled?: boolean;
}) {
  const active = {
    accent: "border-c-accent bg-c-accent-soft text-c-accent",
    period: "border-c-period bg-c-period-soft text-c-period",
    fertile: "border-c-fertile bg-c-fertile-soft text-c-fertile",
  }[tone];
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium transition disabled:opacity-50 ${on ? active : "border-c-line bg-c-card text-c-ink"}`}
    >
      {children}
    </button>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

/** Bottom sheet on phones, centred dialog on wide screens. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  labelClose,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  labelClose: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Callers pass inline closures: keep the latest one without re-running the
  // effect below (that would move focus back to the dialog on every render).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !ref.current) return;
      // Keep keyboard focus inside the dialog.
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="sheet-in pb-safe max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl bg-c-card outline-none sm:max-w-md sm:rounded-3xl sm:pb-0"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-c-card px-5 pb-2 pt-3">
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-c-line sm:hidden" aria-hidden />
          <h2 id={titleId} className="pt-2 text-lg font-medium text-c-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={labelClose}
            className="-mr-2 mt-1 flex h-11 w-11 items-center justify-center rounded-full text-c-muted active:bg-c-raised"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Row({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  const cls = `flex min-h-14 w-full items-center gap-3 py-2 text-left ${className}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${cls} active:opacity-70`}>
      {children}
    </button>
  ) : (
    <div className={cls}>{children}</div>
  );
}
