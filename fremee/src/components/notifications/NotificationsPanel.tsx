"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
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
  like: "le dio me gusta a tu plan.",
  comment: "comentó tu plan.",
  friend_request: "te envió una solicitud de amistad.",
  friend_accept: "aceptó tu solicitud de amistad.",
  plan_invite: "te invitó a un plan.",
  mention: "te mencionó en un comentario.",
};

function recordatorioLabel(entityId: string | null): string {
  try {
    const meta = JSON.parse(entityId ?? "") as { plan_titulo?: string; importe?: number; has_tasks?: boolean };
    const plan = meta.plan_titulo ? ` en ${meta.plan_titulo}` : "";
    const deuda = (meta.importe ?? 0) > 0.01;
    const tareas = meta.has_tasks;
    if (deuda && tareas) return `te recuerda que le debes ${meta.importe!.toFixed(2)}€ y tienes tareas pendientes${plan}.`;
    if (deuda) return `te recuerda que todavía le debes ${meta.importe!.toFixed(2)}€${plan}.`;
    return `te recuerda que tienes tareas pendientes${plan}.`;
  } catch {
    return "te ha enviado un recordatorio.";
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
    return <img src={src} alt={name ?? ""} className="size-10 rounded-full border border-app object-cover shrink-0" />;
  }
  return (
    <div className="size-10 rounded-full border border-app bg-[var(--surface-2)] flex items-center justify-center text-body-sm font-[var(--fw-medium)] shrink-0">
      {letter}
    </div>
  );
}

// ─── NotifItem ───────────────────────────────────────────────────────────────

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
        onPlanAccepted?.(n.entity_id!);
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
        <Avatar src={n.actor_foto} name={n.actor_nombre} />
        {!n.leida && (
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-blue-500 border-2 border-[var(--bg)]" />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-body-sm leading-snug">
          <span className="font-[var(--fw-semibold)]">{n.actor_nombre ?? "Alguien"}</span>
          {" "}
          <span className="text-muted">
            {n.tipo === "recordatorio" ? recordatorioLabel(n.entity_id) : (TIPO_LABELS[n.tipo] ?? n.tipo)}
          </span>
        </p>
        <p className="text-caption text-muted mt-0.5">{timeAgo(n.created_at)}</p>

        {(isFriendRequest || isPlanInvite) && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => void (isFriendRequest ? handleFriend(true) : handlePlanInvite(true))}
              className="rounded-full bg-[var(--primary)] px-4 py-1.5 text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              Aceptar
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => void (isFriendRequest ? handleFriend(false) : handlePlanInvite(false))}
              className="rounded-full border border-[var(--border)] px-4 py-1.5 text-body-sm font-[var(--fw-semibold)] transition-colors hover:bg-[var(--surface)] disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

// ─── panel ──────────────────────────────────────────────────────────────────

interface Props {
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
    const data = await listNotificaciones(30, cur);
    setNotifs((prev) => (cur ? [...prev, ...data] : data));
    setHasMore(data.length === 30);
    if (data.length > 0) setCursor(data[data.length - 1].id);
  }, [user]);

  // Load when panel opens
  useEffect(() => {
    if (!open || !user) return;
    markedRef.current = false;
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [open, user, load]);

  // Mark as read after brief delay
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (markedRef.current) return;
      markedRef.current = true;
      await marcarNotificacionesLeidas();
      setNotifs((prev) => prev.map((n) => ({ ...n, leida: true })));
      onRead();
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
      {/* Backdrop — only on mobile */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notificaciones"
        className={`fixed top-0 z-50 flex h-dvh w-full max-w-[360px] flex-col bg-[var(--bg)] shadow-elev-3 transition-transform duration-300 [transition-timing-function:var(--ease-standard)] ${
          desktopPosition === "left"
            ? `left-0 border-r border-[var(--border)] ${open ? "translate-x-0" : "-translate-x-full"}`
            : `right-0 border-l border-[var(--border)] ${open ? "translate-x-0" : "translate-x-full"}`
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-[18px] font-[var(--fw-medium)]">Notificaciones</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-muted hover:text-app transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-5">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="size-5 rounded-full border-2 border-current border-t-transparent animate-spin opacity-40" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 px-6 text-center">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-12 opacity-20">
                <path d="M6 10.5C6 7.46 8.24 5 12 5s6 2.46 6 5.5v3l1.5 2.5H4.5L6 13.5v-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M10 17.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
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
