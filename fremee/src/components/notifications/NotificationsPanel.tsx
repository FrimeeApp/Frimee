"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { ChevronLeft, X, Bell } from "lucide-react";
import { CloseX } from "@/components/ui/CloseX";
import {
  listNotificaciones,
  marcarNotificacionesLeidas,
  acceptFriendRequest,
  rejectFriendRequest,
  acceptPlanInvite,
  rejectPlanInvite,
  type NotificacionDto,
} from "@/services/api/repositories/notifications.repository";

// ─── helpers ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  follow: "empezó a seguirte.",
  like: "le dio me gusta a tu plan.",
  comment: "comentó tu plan.",
  friend_request: "te envió una solicitud de amistad.",
  friend_accept: "aceptó tu solicitud de amistad.",
  plan_invite: "te invitó a un plan.",
  mention: "te mencionó en un comentario.",
};

const N_TILDE_WORDS: Record<string, string> = {
  companera: "compañera",
  companeras: "compañeras",
  companero: "compañero",
  companeros: "compañeros",
  duena: "dueña",
  duenas: "dueñas",
  dueno: "dueño",
  duenos: "dueños",
  cumpleanos: "cumpleaños",
};

function preserveWordCase(source: string, replacement: string): string {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function normalizeNotificationText(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\b(companera|companeras|companero|companeros|duena|duenas|dueno|duenos|cumpleanos)\b/gi, (match) => {
      const normalized = N_TILDE_WORDS[match.toLowerCase()];
      return normalized ? preserveWordCase(match, normalized) : match;
    });
}

function recordatorioLabel(entityId: string | null): string {
  try {
    const meta = JSON.parse(entityId ?? "") as { plan_titulo?: string; importe?: number; has_tasks?: boolean };
    const plan = meta.plan_titulo ? ` en ${meta.plan_titulo}` : "";
    const deuda = (meta.importe ?? 0) > 0.01;
    const tareas = meta.has_tasks;
    if (deuda && tareas) return normalizeNotificationText(`te recuerda que le debes ${meta.importe!.toFixed(2)}€ y tienes tareas pendientes${plan}.`);
    if (deuda) return normalizeNotificationText(`te recuerda que todavía le debes ${meta.importe!.toFixed(2)}€${plan}.`);
    return normalizeNotificationText(`te recuerda que tienes tareas pendientes${plan}.`);
  } catch {
    return "te ha enviado un recordatorio.";
  }
}

function recordatorioDeudaLabel(entityId: string | null): string {
  try {
    const meta = JSON.parse(entityId ?? "") as { mensaje?: string };
    return normalizeNotificationText(meta.mensaje ?? "Tienes deudas pendientes de un viaje pasado.");
  } catch {
    return "Tienes deudas pendientes de un viaje pasado.";
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function groupByPeriod(notifs: NotificacionDto[]): { label: string; items: NotificacionDto[] }[] {
  const now = Date.now();
  const DAY = 86_400_000;
  const groups: Record<string, NotificacionDto[]> = { Hoy: [], "Esta semana": [], "Este mes": [], Anteriores: [] };
  for (const n of notifs) {
    const age = now - new Date(n.created_at).getTime();
    if (age < DAY) groups["Hoy"].push(n);
    else if (age < 7 * DAY) groups["Esta semana"].push(n);
    else if (age < 30 * DAY) groups["Este mes"].push(n);
    else groups["Anteriores"].push(n);
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  const letter = (name ?? "?")[0].toUpperCase();
  if (src) {
    return <Image src={src} alt={name ?? ""} width={40} height={40} className="size-10 rounded-full border border-app object-cover shrink-0" unoptimized referrerPolicy="no-referrer" />;
  }
  return (
    <div className="size-10 rounded-full border border-app bg-[var(--surface-2)] flex items-center justify-center text-body-sm font-[var(--fw-medium)] shrink-0">
      {letter}
    </div>
  );
}

// ─── NotifItem ───────────────────────────────────────────────────────────────

function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-3)]" aria-label="Cargando notificaciones" role="status">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-[var(--space-3)]">
          <div className="skeleton-shimmer size-12 shrink-0 rounded-full" />
          <div className="skeleton-shimmer h-[14px] w-[148px] rounded-full" />
        </div>
      ))}
    </div>
  );
}

function NotifItem({
  n,
  onAction,
  onPlanAccepted,
}: {
  n: NotificacionDto;
  onAction: (id: number) => void;
  onPlanAccepted?: (planId: string) => void;
}) {
  const [acting, setActing] = useState(false);
  const isFriendRequest = n.tipo === "friend_request" && n.actor_id;
  const isPlanInvite = n.tipo === "plan_invite" && n.entity_id;

  const handleFriend = async (accept: boolean) => {
    if (!n.actor_id || acting) return;
    setActing(true);
    try {
      if (accept) await acceptFriendRequest(n.actor_id);
      else await rejectFriendRequest(n.actor_id);
      onAction(n.id);
    } catch (e) {
      console.error(e);
    } finally {
      setActing(false);
    }
  };

  const handlePlanInvite = async (accept: boolean) => {
    if (!n.entity_id || acting) return;
    setActing(true);
    try {
      if (accept) {
        await acceptPlanInvite(Number(n.entity_id), n.id);
        onAction(n.id);
        onPlanAccepted?.(n.entity_id);
      } else {
        await rejectPlanInvite(n.id);
        onAction(n.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActing(false);
    }
  };

  return (
    <li
      className={`flex items-start gap-3 px-5 py-3 transition-colors ${
        !n.leida ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
      }`}
    >
      <div className="relative shrink-0">
        {n.tipo === "recordatorio_deuda"
          ? <div className="size-10 rounded-full border border-app bg-[var(--primary)]/15 flex items-center justify-center text-body-sm font-[var(--fw-semibold)] text-[var(--primary)] shrink-0">F</div>
          : <Avatar src={n.actor_foto} name={n.actor_nombre} />
        }
        {!n.leida && (
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-blue-500 border-2 border-[var(--bg)]" />
        )}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-body-sm leading-snug">
              {n.tipo === "recordatorio_deuda" ? (
                <>
                  <span className="font-[var(--fw-semibold)] text-[var(--primary)]">Frimee</span>
                  {" "}
                  <span className="text-muted">{recordatorioDeudaLabel(n.entity_id)}</span>
                </>
              ) : (
                <>
                  <span className="font-[var(--fw-semibold)]">{n.actor_nombre ?? "Alguien"}</span>
                  {" "}
                  <span className="text-muted">
                    {normalizeNotificationText(n.tipo === "recordatorio" ? recordatorioLabel(n.entity_id) : (TIPO_LABELS[n.tipo] ?? n.tipo))}
                  </span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-caption text-muted">{timeAgo(n.created_at)}</p>
          </div>

          {(isFriendRequest || isPlanInvite) && (
            <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
              <button
                type="button"
                disabled={acting}
                onClick={() => void (isFriendRequest ? handleFriend(true) : handlePlanInvite(true))}
                className="rounded-full bg-[var(--primary)] px-3 py-1 text-[14px] font-[var(--fw-semibold)] text-[var(--contrast)] transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                Aceptar
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void (isFriendRequest ? handleFriend(false) : handlePlanInvite(false))}
                aria-label="Rechazar"
                className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:text-app disabled:opacity-50"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── panel ──────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
  onRead: () => void; // called when all are marked read → reset badge
  desktopPosition?: "left" | "right";
}

export default function NotificationsPanel({ open, onClose, onRead, desktopPosition = "right" }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<NotificacionDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();
  const [hasMore, setHasMore] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  const load = useCallback(async (cur?: number) => {
    if (!user) return;
    try {
      const data = await listNotificaciones(30, cur);
      setNotifs((prev) => (cur ? [...prev, ...data] : data));
      setHasMore(data.length === 30);
      if (data.length > 0) setCursor(data[data.length - 1].id);
    } catch (e) {
      console.error("[NotificationsPanel] load error:", e);
    }
  }, [user]);

  // Load when panel opens
  useEffect(() => {
    if (!open || !user) return;
    markedRef.current = false;
    const run = async () => {
      setLoading(true);
      try {
        await load();
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [open, user, load]);

  // Mark as read after brief delay
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (markedRef.current) return;
      markedRef.current = true;
      marcarNotificacionesLeidas()
        .then(() => {
          setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
          onRead();
        })
        .catch((e) => console.error("[NotificationsPanel] marcar leidas error:", e));
    }, 1200);
    return () => clearTimeout(t);
  }, [open, onRead]);

  // Realtime: reload on INSERT or DELETE
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`notif-panel-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `user_id=eq.${user.id}` },
        () => { void load(); }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notificaciones", filter: `user_id=eq.${user.id}` },
        () => { void load(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const groups = groupByPeriod(notifs);

  return (
    <>
      {/* Backdrop — only on desktop */}
      <div
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 hidden md:block ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: "var(--z-modal)" }}
        aria-hidden="true"
      />

      {/* Panel — fullscreen on mobile, slide-in on desktop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificaciones"
        className={`fixed inset-0 flex h-dvh w-full flex-col bg-[var(--bg)] pb-safe transition-transform duration-300 [transition-timing-function:var(--ease-standard)] md:inset-auto md:top-0 md:max-w-[408px] md:shadow-elev-3 md:pb-0 ${
          open ? "translate-x-0" : "translate-x-full"
        } ${
          desktopPosition === "left"
            ? `md:left-0 md:border-r md:border-[var(--border)] ${open ? "md:translate-x-0" : "md:-translate-x-full"}`
            : `md:right-0 md:border-l md:border-[var(--border)] ${open ? "md:translate-x-0" : "md:translate-x-full"}`
        }`}
        style={{ zIndex: "calc(var(--z-modal) + 1)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-[var(--space-3)] border-b border-[var(--border)] px-[var(--space-4)] pb-[var(--space-3)] pt-[max(var(--space-2),env(safe-area-inset-top))] md:py-[var(--space-3)]">
          <button
            type="button"
            onClick={onClose}
            aria-label="Volver"
            className="flex size-[36px] items-center justify-center rounded-full transition-colors hover:bg-surface md:hidden"
          >
            <ChevronLeft className="size-[18px]" aria-hidden />
          </button>
          <h1 className="flex-1 text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app">Notificaciones</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="hidden text-muted hover:text-app transition-colors md:block"
          >
            <CloseX />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <NotificationsSkeleton />
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
              <Bell className="size-12 opacity-20" aria-hidden />
              <p className="text-body-sm text-muted">No tienes notificaciones aún</p>
            </div>
          ) : (
            <>
              {groups.map(({ label, items }) => (
                <div key={label}>
                  <p className="px-5 pt-5 pb-2 text-body-sm font-[var(--fw-semibold)]">{label}</p>
                  <ul>
                    {items.map((n) => (
                      <NotifItem
                        key={n.id}
                        n={n}
                        onAction={(id) =>
                          setNotifs((prev) => prev.filter((x) => x.id !== id))
                        }
                        onPlanAccepted={(planId) => {
                          onClose();
                          router.push(`/plans/${planId}`);
                        }}
                      />
                    ))}
                  </ul>
                </div>
              ))}

              {hasMore && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => void load(cursor)}
                    className="text-body-sm text-muted hover:text-app transition-colors"
                  >
                    Cargar más
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
