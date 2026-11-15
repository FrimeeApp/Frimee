"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Link2, Users } from "lucide-react";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { getWebAppUrl } from "@/config/external";
import { useToast } from "@/components/ui/Toaster";

export type Friend = PublicUserProfileRow;

export type FriendsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; friends: Friend[] };

/** My friends, loaded the first time they are needed (search or «Nuevo grupo») and kept. */
export function useFriends() {
  const [state, setState] = useState<FriendsState>({ status: "idle" });
  const inFlight = useRef(false);
  const load = useCallback(async (force = false) => {
    if (inFlight.current) return;
    if (!force && state.status === "ready") return;
    inFlight.current = true;
    setState({ status: "loading" });
    try {
      const friends = await fetchActiveFriends();
      friends.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
      setState({ status: "ready", friends });
    } catch (e) {
      console.error("[mensajes] Error cargando amigos:", (e as { message?: string })?.message ?? String(e));
      setState({ status: "error" });
    } finally {
      inFlight.current = false;
    }
  }, [state.status]);
  return { state, load };
}

export function firstName(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || nombre;
}

export function PersonAvatar({ name, src, size = 44, group }: { name: string; src?: string | null; size?: number; group?: boolean }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-[var(--surface-2)] font-[var(--fw-semibold)] text-app"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        : group ? <Users className="size-[45%] text-muted" />
        : (name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Three overlapping avatars and «+N» (a new group's header). */
export function AvatarStack({ people, max = 3, size = 32 }: { people: Friend[]; max?: number; size?: number }) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span aria-hidden className="flex shrink-0 items-center">
      {shown.map((p, i) => (
        <span key={p.id} className="rounded-full ring-2 ring-[var(--bg)]" style={{ marginLeft: i ? -size / 3 : 0 }}>
          <PersonAvatar name={p.nombre} src={p.profile_image} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -size / 3 }}
          className="flex items-center justify-center rounded-full border border-app bg-[var(--surface-2)] text-[11px] font-[var(--fw-semibold)] tabular-nums text-app ring-2 ring-[var(--bg)]"
        >+{rest}</span>
      )}
    </span>
  );
}

/** The checkbox drawn next to a person (the real input is visually hidden before it: `peer`). */
export function CheckMark({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`ml-auto flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)] ${on ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]" : "border-[var(--border)]"}`}>
      {on && <Check className="size-[14px]" strokeWidth={3} />}
    </span>
  );
}

/** «Copiar enlace de invitación»: the app's sign-up page, for someone who is not in Frimee yet. */
export function CopyInviteLink() {
  const { toastError, toastSuccess } = useToast();
  return (
    <button
      type="button"
      onClick={() => {
        const url = `${getWebAppUrl()}/register`;
        navigator.clipboard.writeText(url)
          .then(() => toastSuccess("Enlace copiado"))
          .catch(() => toastError("No se pudo copiar el enlace"));
      }}
      className="inline-flex min-h-[44px] items-center gap-[6px] text-[14px] font-[var(--fw-semibold)] text-primary-token"
    >
      <Link2 className="size-[16px]" aria-hidden />
      Copiar enlace de invitación
    </button>
  );
}

/** Empty, loading and error states for the friends list (board nc-sistema). */
export function FriendsStatus({ state, onRetry }: { state: FriendsState; onRetry: () => void }) {
  if (state.status === "loading" || state.status === "idle") {
    return (
      <div role="status" className="flex items-center gap-[10px] px-[12px] py-[16px] text-[14px] text-muted">
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" aria-hidden />
        Cargando tus amigos…
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div role="alert" className="px-[12px] py-[16px]">
        <p className="text-[15px] font-[var(--fw-semibold)] text-app">No se pudieron cargar tus amigos</p>
        <p className="mt-[2px] text-[14px] text-muted">Comprueba la conexión y vuelve a intentarlo.</p>
        <button type="button" onClick={onRetry} className="mt-[4px] inline-flex min-h-[44px] items-center text-[14px] font-[var(--fw-semibold)] text-primary-token">Reintentar</button>
      </div>
    );
  }
  if (state.friends.length === 0) {
    return (
      <div className="px-[12px] py-[16px]">
        <p className="text-[15px] font-[var(--fw-semibold)] text-app">Aún no tienes amigos en Frimee</p>
        <p className="mt-[2px] text-[14px] text-muted">Invítalos con un enlace y podrás escribirles y hacer planes juntos.</p>
        <CopyInviteLink />
      </div>
    );
  }
  return null;
}
