"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";
import { Capacitor } from "@capacitor/core";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, ArrowLeft, Check, Copy, Loader2, QrCode, Search, Share2, UserRound, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { useIsPhone } from "@/components/chat/bitacora/Sheet";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { createRealtimeTopic } from "@/lib/realtime";
import { getWebAppUrl } from "@/config/external";
import {
  cancelInvite,
  fetchInviteList,
  formatPlanCode,
  inviteGroup,
  invitePeople,
  type InviteEstado,
  type InviteFriend,
  type InviteGroup,
} from "@/services/api/repositories/invitations.repository";

export type InviteMember = { id: string; nombre: string; profile_image: string | null };

type Props = {
  planId: number;
  planTitle: string;
  /** «20 – 22 nov», under the QR. */
  planDates: string;
  members: InviteMember[];
  currentUserId: string;
  onClose: () => void;
};

/** Per-row send state on top of what the server says (estado). */
type RowState = "sending" | "error";

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const firstName = (n: string) => n.trim().split(/\s+/)[0] ?? n;

/** «Tú e Irene Prueba» · «Tú, Irene y Ana» · «Tú, Irene y 4 más». */
function inPlanSentence(others: InviteMember[]) {
  if (others.length === 0) return "Solo tú";
  if (others.length === 1) return `Tú e ${others[0].nombre}`.replace(/^Tú e ([^iIíÍ])/, "Tú y $1");
  if (others.length === 2) return `Tú, ${firstName(others[0].nombre)} y ${firstName(others[1].nombre)}`;
  return `Tú, ${firstName(others[0].nombre)} y ${others.length - 1} más`;
}

/** «Irene ya está» · «Irene y Ana ya están» · «3 ya están». */
function alreadySentence(names: string[]) {
  if (names.length === 0) return null;
  if (names.length === 1) return `${firstName(names[0])} ya está`;
  if (names.length === 2) return `${firstName(names[0])} y ${firstName(names[1])} ya están`;
  return `${names.length} ya están`;
}

function joinUrl(codigo: string) {
  const base = Capacitor.isNativePlatform() ? getWebAppUrl() : window.location.origin;
  return `${base.replace(/\/$/, "")}/join/${formatPlanCode(codigo)}`;
}

const canShare = () => Capacitor.isNativePlatform() || (typeof navigator !== "undefined" && typeof navigator.share === "function");

async function shareLink(title: string, url: string) {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title, text: `Únete a «${title}» en Frimee`, url, dialogTitle: "Compartir enlace" });
      return;
    }
    await navigator.share({ title, text: `Únete a «${title}» en Frimee`, url });
  } catch {
    /* the person closed the share sheet */
  }
}

const ROW_BTN =
  "flex h-[40px] min-w-[96px] shrink-0 items-center justify-center gap-[6px] rounded-[8px] border px-[14px] text-[14px] font-[var(--fw-semibold)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] disabled:cursor-default";
const ICON_BTN =
  "flex size-[44px] shrink-0 items-center justify-center rounded-[8px] border border-[var(--border-strong)] text-app transition-colors hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)]";

export default function InviteSheet({ planId, planTitle, planDates, members, currentUserId, onClose }: Props) {
  const phone = useIsPhone();
  const [friends, setFriends] = useState<InviteFriend[] | null>(null);
  const [groups, setGroups] = useState<InviteGroup[] | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<"amigos" | "grupos">("amigos");
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [groupRows, setGroupRows] = useState<Record<string, RowState>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "miembros">("lista");
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live estado per person: what the server says, updated by Realtime and by our own sends.
  const [estados, setEstados] = useState<Record<string, InviteEstado>>({});

  const load = useCallback(async () => {
    setLoadError(false);
    setFriends(null);
    setGroups(null);
    try {
      const list = await fetchInviteList(planId);
      const next: Record<string, InviteEstado> = {};
      for (const f of list.amigos) next[f.id] = f.estado;
      for (const g of list.grupos) for (const m of g.miembros) next[m.id] = m.estado;
      setEstados(next);
      setFriends(list.amigos);
      setGroups(list.grupos);
      setCodigo(list.codigo);
    } catch {
      setLoadError(true);
    }
  }, [planId]);

  useEffect(() => { void load(); }, [load]);

  // «Enviada» → «En el plan» when they accept; cancelled or declined → «Invitar» again.
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(createRealtimeTopic("plan-invitaciones", String(planId)))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_invitaciones", filter: `plan_id=eq.${planId}` },
        (payload) => {
          const row = payload.new as { invitado_id?: string; estado?: string } | null;
          if (!row?.invitado_id) return;
          const estado: InviteEstado = row.estado === "PENDIENTE" ? "pendiente" : row.estado === "ACEPTADA" ? "miembro" : null;
          setEstados((prev) => ({ ...prev, [row.invitado_id!]: estado }));
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [planId]);

  // The page behind does not scroll while the window is open (the list scrolls on its own).
  useEffect(() => {
    const html = document.documentElement;
    const prev = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev.html;
      document.body.style.overflow = prev.body;
    };
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (phone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menuFor) { setMenuFor(null); return; }
      if (qrOpen) { setQrOpen(false); return; }
      if (view !== "lista") { setView("lista"); return; }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phone, menuFor, qrOpen, view, onClose]);

  const memberIds = useMemo(() => new Set(members.map((m) => m.id)), [members]);
  const estadoDe = (id: string): InviteEstado => (memberIds.has(id) ? "miembro" : estados[id] ?? null);
  const others = members.filter((m) => m.id !== currentUserId);

  const q = norm(query);
  const visibleFriends = (friends ?? []).filter(
    (f) => estadoDe(f.id) !== "miembro" && (!q || norm(f.nombre).includes(q) || norm(f.username ?? "").includes(q)),
  );
  const visibleGroups = (groups ?? []).filter((g) => !q || norm(g.nombre ?? "").includes(q));
  const totalFriends = (friends ?? []).filter((f) => estadoDe(f.id) !== "miembro").length;

  const url = codigo ? joinUrl(codigo) : null;
  const shownUrl = url?.replace(/^https?:\/\//, "") ?? "";

  const copy = () => {
    if (!url) return;
    void navigator.clipboard.writeText(url).then(() => setCopied(true)).catch(() => setCopied(false));
  };
  const shareOrCopy = () => {
    if (!url) return;
    if (canShare()) void shareLink(planTitle, url);
    else copy();
  };

  const sendOne = async (id: string) => {
    setRows((r) => ({ ...r, [id]: "sending" }));
    try {
      const sent = await invitePeople(planId, [id]);
      if (!sent.includes(id)) throw new Error("not sent");
      setEstados((e) => ({ ...e, [id]: "pendiente" }));
      setRows((r) => { const n = { ...r }; delete n[id]; return n; });
    } catch {
      setRows((r) => ({ ...r, [id]: "error" }));
    }
  };

  const cancelOne = async (id: string) => {
    setMenuFor(null);
    setEstados((e) => ({ ...e, [id]: null }));
    try {
      await cancelInvite(planId, id);
    } catch {
      setEstados((e) => ({ ...e, [id]: "pendiente" }));
    }
  };

  const sendGroup = async (g: InviteGroup) => {
    setGroupRows((r) => ({ ...r, [g.chat_id]: "sending" }));
    try {
      const sent = await inviteGroup(planId, g.chat_id);
      setEstados((e) => {
        const n = { ...e };
        for (const id of sent) n[id] = "pendiente";
        return n;
      });
      setGroupRows((r) => { const n = { ...r }; delete n[g.chat_id]; return n; });
    } catch {
      setGroupRows((r) => ({ ...r, [g.chat_id]: "error" }));
    }
  };

  /* ───────── pieces ───────── */

  const friendRow = (f: InviteFriend) => {
    const estado = estadoDe(f.id);
    const row = rows[f.id];
    const sent = estado === "pendiente" && row !== "sending";
    return (
      <li key={f.id} className="relative flex h-[60px] items-center gap-[12px]">
        <Avatar name={f.nombre} src={f.profile_image} px={40} topMargin="" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-[var(--fw-medium)] text-app">{f.nombre}</span>
          {sent && <span className="block truncate text-[13px] text-muted">Pendiente de aceptar</span>}
          {row === "error" && (
            <span className="flex items-center gap-[4px] truncate text-[13px] text-[var(--error)]">
              <AlertCircle className="size-[14px] shrink-0" aria-hidden />No se pudo enviar
            </span>
          )}
        </span>
        {sent ? (
          <button
            type="button"
            aria-label={`Invitación enviada a ${f.nombre}. Opciones`}
            aria-haspopup="menu"
            aria-expanded={menuFor === f.id}
            onClick={() => setMenuFor((m) => (m === f.id ? null : f.id))}
            className={`${ROW_BTN} border-transparent bg-[var(--surface-2)] text-muted hover:text-app`}
          >
            <Check className="size-[16px]" aria-hidden />Enviada
          </button>
        ) : (
          <button
            type="button"
            aria-label={row === "error" ? `Reintentar invitación a ${f.nombre}` : row === "sending" ? `Enviando invitación a ${f.nombre}` : `Invitar a ${f.nombre}`}
            disabled={row === "sending"}
            onClick={() => void sendOne(f.id)}
            className={`${ROW_BTN} border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]`}
          >
            {row === "sending" ? <Loader2 className="size-[16px] animate-spin motion-reduce:animate-none" aria-hidden /> : row === "error" ? "Reintentar" : "Invitar"}
          </button>
        )}
        {menuFor === f.id && (
          <div role="menu" className="absolute right-0 top-[52px] z-[5] w-[220px] rounded-[8px] border border-app bg-[var(--bg)] p-[6px] shadow-[var(--shadow-md)]">
            <button
              type="button"
              role="menuitem"
              autoFocus
              onClick={() => void cancelOne(f.id)}
              className="flex h-[44px] w-full items-center rounded-[6px] px-[10px] text-left text-[15px] text-app hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none"
            >
              Cancelar invitación
            </button>
          </div>
        )}
      </li>
    );
  };

  const groupRow = (g: InviteGroup) => {
    const people = g.miembros;
    const inPlan = people.filter((m) => estadoDe(m.id) === "miembro");
    const pending = people.filter((m) => estadoDe(m.id) === "pendiente");
    const missing = people.filter((m) => estadoDe(m.id) === null);
    const row = groupRows[g.chat_id];
    const meta = [`${people.length + 1} personas`, alreadySentence(inPlan.map((m) => m.nombre))].filter(Boolean).join(" · ");
    return (
      <li key={g.chat_id} className="flex h-[60px] items-center gap-[12px]">
        <span className="flex w-[40px] shrink-0 -space-x-[14px]">
          {people.slice(0, 3).map((m) => (
            <Avatar key={m.id} name={m.nombre} src={m.profile_image} px={26} topMargin="" className="ring-2 ring-[var(--bg)]" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-[var(--fw-medium)] text-app">{g.nombre ?? "Grupo"}</span>
          {row === "error" ? (
            <span className="flex items-center gap-[4px] truncate text-[13px] text-[var(--error)]">
              <AlertCircle className="size-[14px] shrink-0" aria-hidden />No se pudo enviar
            </span>
          ) : (
            <span className="block truncate text-[13px] text-muted">{meta}</span>
          )}
        </span>
        {missing.length === 0 ? (
          <span className={`${ROW_BTN} border-transparent bg-[var(--surface-2)] text-muted`}>
            {pending.length ? <><Check className="size-[16px]" aria-hidden />Enviada a {pending.length}</> : "Ya están"}
          </span>
        ) : (
          <button
            type="button"
            disabled={row === "sending"}
            aria-label={row === "sending" ? `Invitando a ${g.nombre ?? "el grupo"}` : `Invitar a ${missing.length} de ${g.nombre ?? "el grupo"}`}
            onClick={() => void sendGroup(g)}
            className={`${ROW_BTN} border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]`}
          >
            {row === "sending" ? <Loader2 className="size-[16px] animate-spin motion-reduce:animate-none" aria-hidden /> : row === "error" ? "Reintentar" : `Invitar a ${missing.length}`}
          </button>
        )}
      </li>
    );
  };

  const skeleton = (label: string) => (
    <div role="status" aria-label={label}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex h-[60px] items-center gap-[12px]">
          <div className="size-[40px] shrink-0 animate-pulse rounded-full bg-[var(--surface-2)] motion-reduce:animate-none" />
          <div className="h-[14px] flex-1 animate-pulse rounded-[4px] bg-[var(--surface-2)] motion-reduce:animate-none" style={{ maxWidth: `${50 + ((i * 17) % 30)}%` }} />
          <div className="h-[40px] w-[96px] animate-pulse rounded-[8px] bg-[var(--surface-2)] motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );

  const shareLabel = phone || canShare() ? "Compartir el enlace" : "Copiar el enlace";
  const emptyState = (title: string, text: string) => (
    <div className="flex flex-col items-center px-[16px] py-[32px] text-center">
      <span className="flex size-[48px] items-center justify-center rounded-full bg-[var(--surface-2)] text-muted">
        <UserRound className="size-[22px]" aria-hidden />
      </span>
      <p className="mt-[12px] text-[16px] font-[var(--fw-semibold)] text-app">{title}</p>
      <p className="mt-[4px] max-w-[300px] text-[14px] text-muted">{text}</p>
      {url && (
        <button type="button" onClick={shareOrCopy} className={`${ROW_BTN} mt-[16px] border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]`}>
          {shareLabel}
        </button>
      )}
    </div>
  );

  const list = (
    <>
      {/* Search + tabs */}
      <div className="flex h-[46px] items-center gap-[10px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface-2)] px-[12px] focus-within:border-[var(--primary)]">
        <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar amigos"
          aria-label="Buscar amigos y grupos"
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-app outline-none placeholder:text-muted"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="Borrar búsqueda" className="flex size-[32px] items-center justify-center rounded-full text-muted hover:text-app">
            <X className="size-[16px]" aria-hidden />
          </button>
        )}
      </div>
      <div role="tablist" aria-label="Invitar desde" className="mt-[8px] flex gap-[20px] border-b border-app">
        {([["amigos", "Amigos"], ["grupos", "Grupos"]] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={`min-h-[44px] border-b-2 text-[14px] font-[var(--fw-semibold)] ${tab === v ? "border-[var(--text-primary)] text-app" : "border-transparent text-muted hover:text-app"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* In the plan */}
      <button
        type="button"
        onClick={() => setView("miembros")}
        aria-label={`En el plan: ${inPlanSentence(others)}. Ver`}
        className="mt-[12px] flex h-[52px] w-full items-center gap-[12px] rounded-[8px] border border-app px-[12px] text-left hover:bg-[var(--surface-2)]"
      >
        <span className="flex -space-x-[8px]">
          {[{ id: currentUserId, nombre: "Tú", profile_image: members.find((m) => m.id === currentUserId)?.profile_image ?? null }, ...others].slice(0, 3).map((m) => (
            <Avatar key={m.id} name={m.nombre} src={m.profile_image} px={28} topMargin="" className="ring-2 ring-[var(--bg)]" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-[var(--fw-semibold)] text-muted">En el plan</span>
          <span className="block truncate text-[14px] text-app">{inPlanSentence(others)}</span>
        </span>
      </button>

      {/* People / groups */}
      <div className="mt-[12px]">
        {loadError ? (
          <div className="flex flex-col items-center py-[32px] text-center">
            <p className="text-[15px] text-app">No se pudo cargar la lista.</p>
            <button type="button" onClick={() => void load()} className={`${ROW_BTN} mt-[12px] border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]`}>Reintentar</button>
          </div>
        ) : tab === "amigos" ? (
          friends === null ? skeleton("Cargando tus amigos") : (friends.length === 0) ? (
            emptyState("Aún no tienes amigos en Frimee", "Comparte el enlace: quien lo abra entra en el plan y podréis ser amigos.")
          ) : visibleFriends.length === 0 ? (
            q ? emptyState(`Nadie con «${query.trim()}» entre tus amigos`, "Si no está en Frimee, mándale el enlace del plan.")
              : <p className="py-[24px] text-center text-[14px] text-muted">Todos tus amigos están ya en el plan.</p>
          ) : (
            <>
              <p className="flex h-[32px] items-center text-[12px] font-[var(--fw-semibold)] text-muted" aria-live="polite">
                {q ? `${visibleFriends.length} ${visibleFriends.length === 1 ? "resultado" : "resultados"}` : `Tus amigos · ${totalFriends}`}
              </p>
              <ul aria-label="Amigos">{visibleFriends.map(friendRow)}</ul>
            </>
          )
        ) : groups === null ? skeleton("Cargando tus grupos") : visibleGroups.length === 0 ? (
          <p className="py-[24px] text-center text-[14px] text-muted">{q ? `Ningún grupo con «${query.trim()}».` : "No estás en ningún grupo."}</p>
        ) : (
          <>
            <p className="flex h-[32px] items-center text-[12px] font-[var(--fw-semibold)] text-muted" aria-live="polite">
              {q ? `${visibleGroups.length} ${visibleGroups.length === 1 ? "resultado" : "resultados"}` : `Tus grupos · ${groups.length}`}
            </p>
            <ul aria-label="Grupos">{visibleGroups.map(groupRow)}</ul>
          </>
        )}
      </div>
    </>
  );

  const membersView = (
    <>
      <button type="button" onClick={() => setView("lista")} className="-ml-[8px] flex h-[44px] items-center gap-[6px] rounded-[8px] px-[8px] text-[15px] text-app hover:bg-[var(--surface-2)]">
        <ArrowLeft className="size-[18px]" aria-hidden />Volver
      </button>
      <p className="mt-[4px] flex h-[32px] items-center text-[12px] font-[var(--fw-semibold)] text-muted">En el plan · {members.length}</p>
      <ul aria-label="En el plan">
        {[...members].sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : a.nombre.localeCompare(b.nombre))).map((m) => (
          <li key={m.id} className="flex h-[60px] items-center gap-[12px]">
            <Avatar name={m.nombre} src={m.profile_image} px={40} topMargin="" />
            <span className="truncate text-[15px] text-app">{m.id === currentUserId ? "Tú" : m.nombre}</span>
          </li>
        ))}
      </ul>
    </>
  );

  const footer = (
    <div className="border-t border-app px-[16px] pb-[12px] pt-[10px]">
      <p className="mb-[6px] text-[12px] font-[var(--fw-semibold)] text-muted">Enlace del plan</p>
      <div className="flex items-center gap-[8px]">
        <div className="flex h-[52px] min-w-0 flex-1 items-center gap-[8px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface-2)] pl-[12px] pr-[6px]">
          <span className="min-w-0 flex-1 truncate text-[14px] tabular-nums text-app">{url ? shownUrl : "…"}</span>
          <button
            type="button"
            onClick={copy}
            disabled={!url}
            className="flex h-[40px] shrink-0 items-center gap-[6px] rounded-[8px] bg-[var(--text-primary)] px-[14px] text-[14px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {copied ? <><Check className="size-[16px]" aria-hidden />Copiado</> : <><Copy className="size-[16px]" aria-hidden />Copiar</>}
          </button>
        </div>
        <button type="button" aria-label="Ver código QR" title="Ver código QR" disabled={!url} onClick={() => setQrOpen(true)} className={ICON_BTN}>
          <QrCode className="size-[20px]" aria-hidden />
        </button>
        {canShare() && (
          <button type="button" aria-label="Compartir enlace" title="Compartir enlace" disabled={!url} onClick={() => url && void shareLink(planTitle, url)} className={ICON_BTN}>
            <Share2 className="size-[20px]" aria-hidden />
          </button>
        )}
      </div>
      <p className="mt-[8px] text-[13px] text-muted">Quien lo abra entra en el plan.</p>
      <span className="sr-only" aria-live="polite">{copied ? "Enlace copiado" : ""}</span>
    </div>
  );

  const qrPanel = qrOpen && url && (
    <div role="dialog" aria-label="Código QR del plan" className="absolute inset-x-0 bottom-0 z-[6] flex flex-col items-center rounded-t-[16px] border-t border-app bg-[var(--bg)] px-[16px] pb-[16px] pt-[8px] shadow-[0_-8px_24px_rgba(0,0,0,0.18)]">
      <div className="flex w-full items-center justify-between">
        <button type="button" onClick={() => setQrOpen(false)} aria-label={phone ? "Volver" : "Cerrar código QR"} className="flex size-[44px] items-center justify-center rounded-full text-muted hover:bg-[var(--surface-2)]">
          {phone ? <ArrowLeft className="size-[18px]" aria-hidden /> : <X className="size-[18px]" aria-hidden />}
        </button>
        <p className="text-[15px] font-[var(--fw-semibold)] text-app">Código QR</p>
        <span className="size-[44px]" aria-hidden />
      </div>
      {/* Always on white, also in dark mode, so any camera reads it. */}
      <div className="mt-[8px] rounded-[8px] bg-white p-[16px]">
        <QRCodeSVG value={url} size={216} level="M" bgColor="#ffffff" fgColor="#000000" />
      </div>
      <p className="mt-[14px] text-center [font-family:var(--font-display-face)] text-[24px] leading-[28px] text-app">{planTitle}</p>
      <p className="mt-[2px] text-center text-[13px] text-muted">{[planDates, inPlanSentence(others)].filter(Boolean).join(" · ")}</p>
      <p className="mt-[8px] text-center text-[14px] text-muted">Escanéalo con la cámara para unirte al plan.</p>
      <div className="mt-[14px] flex w-full gap-[8px]">
        <button type="button" onClick={copy} className={`${ROW_BTN} flex-1 border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]`}>
          {copied ? <><Check className="size-[16px]" aria-hidden />Copiado</> : "Copiar enlace"}
        </button>
        {canShare() && (
          <button type="button" onClick={() => void shareLink(planTitle, url)} className={`${ROW_BTN} flex-1 border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]`}>
            Compartir
          </button>
        )}
      </div>
    </div>
  );

  const header = (
    <div className="flex items-start justify-between gap-[8px] px-[16px] pt-[8px]">
      <div className="min-w-0">
        <h2 className="[font-family:var(--font-display-face)] text-[28px] leading-[34px] text-app">Invitar</h2>
        <p className="truncate text-[14px] text-muted">{planTitle}</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Cerrar" className="flex size-[44px] shrink-0 items-center justify-center rounded-full text-muted hover:bg-[var(--surface-2)]">
        <X className="size-[18px]" aria-hidden />
      </button>
    </div>
  );

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col" onClick={() => menuFor && setMenuFor(null)}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[16px] pb-[12px] pt-[12px]">{view === "lista" ? list : membersView}</div>
      {footer}
      {qrPanel}
    </div>
  );

  if (phone) {
    return (
      <Drawer.Root open onOpenChange={(o) => { if (!o) onClose(); }} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[100] bg-black/50" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 top-[88px] z-[101] flex flex-col rounded-t-[16px] border-t border-app bg-[var(--bg)] outline-none"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div aria-hidden className="mx-auto mt-[8px] h-[4px] w-[36px] shrink-0 rounded-full bg-[var(--border)]" />
            <Drawer.Title asChild><div>{header}</div></Drawer.Title>
            {body}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-[16px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Invitar a ${planTitle}`}
        className="flex h-[min(680px,calc(100dvh-32px))] w-full max-w-[520px] flex-col overflow-hidden rounded-[8px] border border-app bg-[var(--bg)] shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        {body}
      </div>
    </div>,
    document.body,
  );
}
