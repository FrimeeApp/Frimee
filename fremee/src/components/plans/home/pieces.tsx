"use client";

import type { ReactNode } from "react";
import { Pin } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { DEFAULT_PLAN_COVER_IMAGE } from "@/config/app";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { InicioMiembro } from "@/services/api/endpoints/misPlanes.endpoint";

/* Tokens from the «Frimee» design system as used by the Mis planes boards. */
export const SERIF = "[font-family:var(--font-display-face)] font-normal tracking-[-0.01em]";
export const LABEL = "text-[12px] font-[var(--fw-semibold)] leading-4 tracking-[.02em] text-muted";
/** Filled button: primary-fill with its on-colour (#227a6c + white in light, turquoise + near-black in dark). */
export const FILL_BTN =
  "inline-flex h-[46px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] bg-[var(--chat-accent-text)] px-4 text-[16px] font-[var(--fw-semibold)] text-contrast-token transition-transform duration-[120ms] ease-[cubic-bezier(.2,0,0,1)] active:scale-[.98] disabled:opacity-[var(--disabled-opacity)]";
export const GHOST_BTN =
  "inline-flex h-[46px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[8px] border border-[var(--border-strong)] px-4 text-[16px] font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface-2";
export const TEXT_BTN =
  "inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]";
export const CHIP_HL =
  "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-3 text-[14px] font-[var(--fw-medium)] text-app";
export const CARD = "overflow-hidden rounded-[8px] border border-app bg-surface";
export const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]";

export function hasPhoto(plan: Pick<FeedPlanItemDto, "coverImage">): boolean {
  const url = plan.coverImage?.trim();
  return Boolean(url) && url !== DEFAULT_PLAN_COVER_IMAGE.mobile && url !== DEFAULT_PLAN_COVER_IMAGE.desktop;
}

const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

/**
 * Plan cover. «photo»: the plan's photo, or the default placeholder image when it has none.
 * «thumb» (small squares in rows): the photo, or the start date when it has none.
 */
export function PlanCover({
  plan,
  className = "",
  variant = "photo",
  veil = false,
  children,
}: {
  plan: FeedPlanItemDto;
  className?: string;
  variant?: "photo" | "thumb";
  veil?: boolean;
  children?: ReactNode;
}) {
  const photo = hasPhoto(plan);
  if (variant === "thumb" && !photo) {
    const start = new Date(plan.startsAt);
    return (
      <div aria-hidden className={`relative flex flex-col items-center justify-center overflow-hidden border border-app bg-surface-2 leading-none ${className}`}>
        <span className="text-[20px] font-[var(--fw-semibold)] tabular-nums text-app">{start.getDate()}</span>
        <span className="mt-0.5 text-[11px] font-[var(--fw-medium)] text-muted">{MONTHS_SHORT[start.getMonth()]}</span>
        {children}
      </div>
    );
  }
  return (
    <div className={`relative overflow-hidden bg-surface-inset ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote covers from Firebase Storage, any size */}
      <img src={photo ? plan.coverImage! : DEFAULT_PLAN_COVER_IMAGE.desktop} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      {veil && (
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,.82)_0%,rgba(0,0,0,.5)_50%,rgba(0,0,0,0)_100%)]"
        />
      )}
      {children}
    </div>
  );
}

/** Solid pill over a photo («Día 3 de 5», «Faltan 14 días»): does not depend on the photo. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-app bg-surface px-2.5 text-[12px] font-[var(--fw-semibold)] tabular-nums text-app">
      {children}
    </span>
  );
}

export function PinButton({ pinned, onToggle, onPhoto = false }: { pinned: boolean; onToggle: () => void; onPhoto?: boolean }) {
  const label = pinned ? "Desanclar plan" : "Anclar plan";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pinned}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${FOCUS} ${
        onPhoto ? "border border-app bg-surface" : ""
      } ${pinned ? "text-[var(--chat-accent-text)]" : "text-muted"}`}
    >
      <Pin size={20} strokeWidth={2} fill={pinned ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

/** Overlapping avatars, max 4 + «+N». ring = background colour behind the stack. */
export function PeopleStack({
  people,
  size,
  ring = "var(--surface)",
  max = 4,
}: {
  people: InicioMiembro[];
  size: number;
  ring?: string;
  max?: number;
}) {
  if (people.length === 0) return null;
  const shown = people.length > max ? people.slice(0, max - 1) : people;
  const extra = people.length - shown.length;
  const overlap = Math.round(size * 0.3);
  return (
    <div className="flex items-center" aria-hidden>
      {shown.map((p, i) => (
        <span key={p.id} className="flex rounded-full" style={{ marginLeft: i ? -overlap : 0, boxShadow: `0 0 0 2px ${ring}` }}>
          <Avatar name={p.nombre || "?"} src={p.foto} px={size} topMargin="" />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="flex items-center justify-center rounded-full border border-app bg-surface-2 font-[var(--fw-semibold)] tabular-nums text-muted"
          style={{ width: size, height: size, fontSize: size * 0.4, marginLeft: -overlap, boxShadow: `0 0 0 2px ${ring}` }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Trip progress: one segment per day (continuous bar for trips longer than 14 days). */
export function TripProgress({ day, total }: { day: number; total: number }) {
  const label = `Día ${day} de ${total}`;
  if (total > 14) {
    return (
      <div role="img" aria-label={label} className="h-1 overflow-hidden rounded-[2px] bg-[var(--border)]">
        <div className="h-full bg-[var(--primary)]" style={{ width: `${(day / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div role="img" aria-label={label} className="flex gap-1">
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={`h-1 flex-1 rounded-[2px] ${i < day ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
      ))}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-10 items-center justify-between px-4">
      <h2 className={`${LABEL} flex items-center gap-2`}>{children}</h2>
      {action}
    </div>
  );
}

export function LiveDot() {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 animate-[call-live_2000ms_ease-in-out_infinite] rounded-full bg-[var(--primary)] motion-reduce:animate-none"
    />
  );
}
