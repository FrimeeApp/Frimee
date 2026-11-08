"use client";

import type { ReactNode } from "react";
import { Phone } from "lucide-react";
import type { CallMiembro } from "@/hooks/useCall";

/**
 * Building blocks of the call screens (design boards C1 and C2). Styles in
 * styles/components/calls.css.
 */

export type CallControlKind =
  | "stage" | "off" | "on" | "hang" | "ghost"         // in the room (always dark)
  | "app" | "accept" | "reject" | "fill";              // around the room (user's theme)

export function CallControl({
  kind = "stage",
  small = false,
  size,
  label,
  ariaLabel,
  tip,
  pressed,
  disabled,
  onClick,
  children,
}: {
  kind?: CallControlKind;
  small?: boolean;
  /** Override the diameter (e.g. 72 for the ringing screens' hang up). */
  size?: number;
  /** Visible label under the button (ringing screens). */
  label?: string;
  ariaLabel: string;
  /** Desktop tooltip (after 500 ms); defaults to the aria label. */
  tip?: string | false;
  pressed?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  const classes = ["call-ctl", kind !== "stage" ? `call-ctl-${kind}` : "", small ? "call-ctl-sm" : ""].filter(Boolean).join(" ");
  const button = (
    <button
      type="button"
      className={classes}
      style={size ? { width: size, height: size } : undefined}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      aria-disabled={disabled || undefined}
      data-tip={label || tip === false ? undefined : (tip ?? ariaLabel)}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </button>
  );
  if (!label) return button;
  return (
    <div className="flex min-w-[72px] flex-col items-center gap-2">
      {button}
      <span className="call-ctl-label">{label}</span>
    </div>
  );
}

/** Stable colour for a person: the same in every call. */
function colourIndex(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 6;
}

export function initials(nombre: string) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "")).toUpperCase();
}

export function CallAvatar({ id, nombre, foto, size, ring, style }: {
  id: string;
  nombre: string;
  foto?: string;
  size: number;
  /** Border in the colour of what is behind (stacks). */
  ring?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={`call-av call-av-${colourIndex(id || nombre)}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), border: ring ? `2px solid ${ring}` : undefined, ...style }}
    >
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar from storage, any size
        <img src={foto} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials(nombre)
      )}
    </div>
  );
}

/** Group: up to three avatars overlapping, then "+N". */
export function AvatarStack({ miembros, size, ring, max = 3 }: { miembros: CallMiembro[]; size: number; ring: string; max?: number }) {
  const shown = miembros.slice(0, max);
  const rest = miembros.length - shown.length;
  const overlap = Math.round(size * 0.28);
  return (
    <div aria-hidden="true" className="flex items-center">
      {shown.map((m, i) => (
        <CallAvatar key={m.id} id={m.id} nombre={m.nombre} foto={m.foto} size={size} ring={ring} style={{ marginLeft: i === 0 ? 0 : -overlap }} />
      ))}
      {rest > 0 && (
        <div
          className="flex items-center justify-center rounded-full font-semibold"
          style={{ width: size, height: size, marginLeft: -overlap, border: `2px solid ${ring}`, background: "var(--call-btn-neutral)", color: "var(--text-secondary)", fontSize: Math.round(size * 0.32) }}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

/** Hang up / decline: the phone turned 135°. */
export function HangUpIcon({ size = 24 }: { size?: number }) {
  return <Phone aria-hidden className="shrink-0" style={{ width: size, height: size, transform: "rotate(135deg)" }} strokeWidth={2} />;
}

/** "Llamando ···" */
export function CallDots() {
  return (
    <span className="call-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
