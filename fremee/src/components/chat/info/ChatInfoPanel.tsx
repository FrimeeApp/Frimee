"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban, Bell, BellOff, CalendarPlus, Camera, Check, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Link2, LogOut,
  MapPin, MessageCircle, MoreHorizontal, Pencil, Plus, Star, Trash, Trash2, User, UserMinus, Users,
} from "lucide-react";
import {
  addChatMember, leaveChat, resolveChatAvatar, resolveChatName, updateChatFoto,
  type ChatListItem,
} from "@/services/api/repositories/chat.repository";
import {
  eliminarChatEndpoint, quitarMiembroEndpoint, renombrarChatEndpoint, silenciarChatEndpoint, vaciarChatEndpoint,
  contenidoChatEndpoint, type ChatInfo, type ChatInfoPlan, type ChatNotice, type ContenidoRow, type ContenidoTipo,
} from "@/services/api/endpoints/chat.endpoint";
import { listGastosForPlanEndpoint, type GastoRow } from "@/services/api/endpoints/gastos.endpoint";
import { formatMoney } from "@/lib/formatters";
import { parseMoment } from "@/components/chat/bitacora/moments";
import { eliminarPlanEndpoint, leavePlanEndpoint } from "@/services/api/endpoints/plans.endpoint";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { uploadPlanCoverFile } from "@/services/firebase/upload";
import { notifyChatAdded } from "@/components/chat/notifyChatAdded";
import { PersonAvatar, firstName } from "@/components/chat/nuevo/people";
import { Sheet } from "@/components/chat/bitacora/Sheet";
import { InChatList, IN_CHAT_LABEL } from "@/components/chat/info/InChatList";
import { BlockConfirm } from "@/components/chat/info/BlockConfirm";
import { useBloqueos } from "@/hooks/useBloqueos";

type Member = ChatListItem["miembros"][number];

/** What the database refuses on purpose, said as it says it (fn_chat_renombrar, fn_chat_quitar_miembro…). */
const DB_MESSAGES = [
  "El nombre del grupo es obligatorio (máximo 80)",
  "Solo un admin del grupo puede quitar a alguien",
  "No eres miembro de este chat",
  "Solo quien creó el plan puede eliminarlo",
  "El plan tiene más personas: no se puede eliminar",
];

/** fn_plan_leave answers with a code instead of failing. */
const LEAVE_PLAN_REFUSED: Record<string, string> = {
  owner_cannot_leave: "Has creado el plan: no puedes salir de él.",
  last_admin: "Eres el único admin: haz admin a alguien antes de salir.",
};
function failText(e: unknown, what: string): string {
  const msg = (e as { message?: string } | null)?.message ?? "";
  const db = DB_MESSAGES.find((m) => msg.includes(m));
  if (db) return `${db}.`;
  if (typeof navigator !== "undefined" && !navigator.onLine) return `Sin conexión. ${what}.`;
  return `${what}. Inténtalo de nuevo.`;
}
const logError = (where: string, e: unknown) =>
  console.error(`[info del chat] ${where}:`, (e as { message?: string } | null)?.message ?? String(e));

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
/** «12–15 dic», «28 nov – 2 dic», «30 dic 2026 – 2 ene 2027». */
export function planRange(inicio: string, fin: string): string {
  const a = new Date(inicio);
  const b = new Date(fin);
  const now = new Date().getFullYear();
  const year = (d: Date) => (d.getFullYear() !== now || a.getFullYear() !== b.getFullYear() ? ` ${d.getFullYear()}` : "");
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return a.getDate() === b.getDate()
      ? `${a.getDate()} ${MONTHS[a.getMonth()]}${year(a)}`
      : `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}${year(a)}`;
  }
  return `${a.getDate()} ${MONTHS[a.getMonth()]}${year(a)} – ${b.getDate()} ${MONTHS[b.getMonth()]}${year(b)}`;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** «Jueves», «Sábado y domingo», «Del viernes al domingo», «5 días». */
function tripDays(inicio: string, fin: string): string {
  const a = new Date(inicio);
  const b = new Date(fin);
  const n = Math.round((startOfDay(b) - startOfDay(a)) / 86400000) + 1;
  if (n <= 1) return cap(WEEKDAYS[a.getDay()]);
  if (n === 2) return `${cap(WEEKDAYS[a.getDay()])} y ${WEEKDAYS[b.getDay()]}`;
  if (n <= 7) return `Del ${WEEKDAYS[a.getDay()]} al ${WEEKDAYS[b.getDay()]}`;
  return `${n} días`;
}

/** «hoy», «mañana», «en 13 días», «en curso», «terminado». */
function tripWhen(inicio: string, fin: string): string {
  const today = startOfDay(new Date());
  const a = startOfDay(new Date(inicio));
  const b = startOfDay(new Date(fin));
  if (b < today) return "terminado";
  if (a <= today) return a === b ? "hoy" : "en curso";
  const n = Math.round((a - today) / 86400000);
  return n === 1 ? "mañana" : `en ${n} días`;
}

/** «Amigos desde sept», «Amigos desde sept 2024». */
/** «Amigos desde hoy», «desde ayer», «desde el 12 nov»; another year: «desde el 12 nov 2024». */
function friendsSince(iso: string): string {
  const d = new Date(iso);
  const days = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (days <= 0) return "Amigos desde hoy";
  if (days === 1) return "Amigos desde ayer";
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  return `Amigos desde el ${d.getDate()} ${MONTHS[d.getMonth()]}${year}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type ChatInfoPanelProps = {
  chat: ChatListItem;
  currentUserId: string;
  /** fn_chat_info; null while it loads (or if it failed: then `infoError`). */
  info: ChatInfo | null;
  infoError?: boolean;
  onRetryInfo: () => void;
  /** «aside»: the 320 px panel next to the chat (desktop). «screen»: full screen with «Volver» (phone). */
  variant: "aside" | "screen";
  onClose: () => void;
  /** A plan's chat: its id, and whether I am one of its admins («Invitar al plan»). */
  planId?: number;
  isPlanAdmin?: boolean;
  /** Something of the chat changed here (name, photo, people, silenced): the list reloads. */
  onChanged: () => void;
  onFotoUpdated?: (foto: string) => void;
  /** I left the group or plan, or deleted the 1 a 1: back to the list. */
  onGone: () => void;
  /** «Vaciar el chat» went through: the conversation empties. */
  onEmptied: () => void;
  onCreatePlan: () => void;
  onWriteTo?: (person: Member) => void;
  /** Id of the newest photo, file, place… that arrived while open: the open list adds it. */
  inChatNewest?: number;
  /** A row of «En el chat» was pressed: go to that message in the conversation. */
  onJumpTo: (mensajeId: number) => void;
  /** Open straight on a list (e.g. «Ver destacados» after starring a message). */
  initialView?: ContenidoTipo;
  /** People added here, for the other members' panels (broadcast «member_added»). */
  onMemberAdded?: (person: Member) => void;
  /** The notice the database wrote («Ana cambió el nombre…»): shown here and shared with the others. */
  onNotice: (notice: NonNullable<ChatNotice>) => void;
};

/**
 * Chat information (boards gi-*, rules in gi-sistema). Groups, plan chats and 1 a 1 chats share it:
 * header, plans, people, «En el chat», «Avisos» and the danger zone at the end.
 */
export function ChatInfoPanel(props: ChatInfoPanelProps) {
  const { chat, currentUserId, info, variant } = props;
  const router = useRouter();
  const isGrupo = chat.tipo === "GRUPO";
  const isPlan = chat.tipo === "PLAN";
  const isDirecto = chat.tipo === "DIRECTO";
  const other = isDirecto ? chat.miembros.find((m) => m.id !== currentUserId) ?? null : null;

  // Kept here (added or removed in this panel) and caught up when the list brings new members.
  const [members, setMembers] = useState<Member[]>(() => dedupeMembers(chat.miembros, currentUserId));
  const [membersFrom, setMembersFrom] = useState(chat.miembros);
  if (membersFrom !== chat.miembros) {
    setMembersFrom(chat.miembros);
    setMembers(dedupeMembers(chat.miembros, currentUserId));
  }

  const [view, setView] = useState<"info" | "add" | ContenidoTipo>(props.initialView ?? "info");
  const isList = view !== "info" && view !== "add";
  // «‹ Fotos · 24»: the subview's name and how many there are.
  const subTitle = view === "add" ? "Añadir personas"
    : isList ? `${IN_CHAT_LABEL[view]}${info?.recuentos[view] ? ` · ${info.recuentos[view]}` : ""}` : null;
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const { bloqueados, bloquear, desbloquear } = useBloqueos();
  const [blockFor, setBlockFor] = useState<Member | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  // «Desbloquear» goes straight through (no sheet): only the error needs saying.
  const unblock = (p: Member) => {
    setBlockError(null);
    desbloquear(p.id).catch((e) => {
      logError("Error desbloqueando", e);
      setBlockError(failText(e, "No se ha desbloqueado"));
    });
  };
  // Alone in a plan: inviting is what matters, and leaving would empty it (board feedback 15 nov).
  const alone = members.length <= 1;

  const title = isGrupo ? "Información del grupo" : isPlan ? "Información del plan" : "Información del chat";
  const name = resolveChatName(chat, currentUserId);

  const body = isList ? (
    <InChatList key={view} chatId={chat.chat_id} tipo={view} total={info?.recuentos[view]} planId={props.planId} currentUserId={currentUserId} newest={props.inChatNewest} onJumpTo={props.onJumpTo} />
  ) : view === "add" ? (
    <AddPeople
      chat={chat}
      members={members}
      onNotice={props.onNotice}
      onBack={() => setView("info")}
      onAdded={(p) => {
        setMembers((prev) => [...prev, p]);
        props.onMemberAdded?.(p);
        props.onChanged();
        setView("info");
      }}
    />
  ) : (
    <div className="flex flex-col gap-[24px]">
      <Header {...props} name={name} other={other} memberCount={members.length} />

      {isPlan ? (
        <TripBlock
          planId={props.planId}
          chat={chat}
          currentUserId={currentUserId}
          members={members}
          decisiones={info?.recuentos.decisiones}
          refreshKey={props.inChatNewest}
          onJumpTo={props.onJumpTo}
          onOpenDecisiones={() => setView("decisiones")}
        />
      ) : (
        <PlansSection
          title={isDirecto ? "Planes en común" : "Planes de este grupo"}
          plans={info ? (isDirecto ? info.comun : info.planes) : null}
          emptyTitle={isDirecto ? "Aún no tenéis plan juntos" : "Aún no tenéis plan"}
          emptyText={isDirecto ? `Fechas, itinerario, gastos y álbum para los dos.` : "Fechas, itinerario, gastos y álbum para todo el grupo."}
          createLabel={isDirecto ? `Crear plan con ${firstName(other?.nombre ?? "")}`.trim() : "Crear plan con este grupo"}
          otherName={isDirecto ? firstName(other?.nombre ?? "") : null}
          onCreate={props.onCreatePlan}
          onOpen={(id) => router.push(`/plans/${id}`)}
        />
      )}

      {!isDirecto && (
        <PeopleSection
          chat={chat}
          members={members}
          info={info}
          currentUserId={currentUserId}
          isPlan={isPlan}
          canInvite={isGrupo || Boolean(props.isPlanAdmin)}
          alone={alone}
          onAdd={() => (isPlan ? router.push(`/plans/${props.planId}?invitar=1`) : setView("add"))}
          onProfile={(p) => router.push(`/profile/${p.id}`)}
          onWriteTo={props.onWriteTo}
          onRemove={(p) => setConfirm({ kind: "quitar", person: p })}
          bloqueados={bloqueados}
          onBlock={setBlockFor}
          onUnblock={unblock}
        />
      )}

      <InChatSection info={info} infoError={props.infoError} onRetry={props.onRetryInfo} onOpenList={setView} />

      <MuteSection chat={chat} info={info} onChanged={props.onChanged} />

      <section className="flex flex-col border-t border-app pt-[12px]">
        <DangerRow icon={<Trash2 className="size-[18px]" />} label="Vaciar el chat" hint={isDirecto ? "Borra los mensajes, el chat sigue en tu lista" : undefined} onClick={() => setConfirm({ kind: "vaciar" })} />
        {isPlan && alone ? (
          <DangerRow icon={<Trash2 className="size-[18px]" />} label="Eliminar el plan" hint="Eres la única persona del plan" onClick={() => setConfirm({ kind: "eliminarPlan" })} />
        ) : isDirecto ? (
          <>
            <DangerRow icon={<Trash className="size-[18px]" />} label="Eliminar chat" hint={`Desaparece de tu lista; si ${firstName(other?.nombre ?? "te")} te escribe, vuelve`} onClick={() => setConfirm({ kind: "eliminar" })} />
            {other && (bloqueados.has(other.id) ? (
              <DangerRow icon={<Ban className="size-[18px]" />} label="Desbloquear" onClick={() => unblock(other)} />
            ) : (
              <DangerRow icon={<Ban className="size-[18px]" />} label="Bloquear" onClick={() => setBlockFor(other)} />
            ))}
          </>
        ) : (
          <DangerRow
            icon={<LogOut className="size-[18px]" />}
            label={isPlan ? "Salir del plan" : "Salir del grupo"}
            hint={isPlan ? "Dejas el plan y su chat" : "Para volver, alguien tendrá que añadirte"}
            onClick={() => setConfirm({ kind: "salir" })}
          />
        )}
        {blockError && <p role="alert" className="px-[8px] text-[13px] text-[var(--error)]">{blockError}</p>}
      </section>
    </div>
  );

  return (
    <>
      {variant === "screen" ? (
        <div className="flex h-full min-h-0 flex-col bg-app">
          <header className="border-b border-app bg-app pt-mobile-safe-top">
            <div className="flex h-[56px] items-center gap-[4px] px-[4px]">
              <button type="button" onClick={subTitle ? () => setView("info") : props.onClose} aria-label={subTitle ? "Volver a la información" : "Volver al chat"} title="Volver" className="flex size-[44px] items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface-2)]">
                <ChevronLeft className="size-[22px]" aria-hidden />
              </button>
              <h1 className="[font-family:var(--font-sans)] text-[17px] font-[var(--fw-semibold)] leading-[22px] tracking-normal text-app">{subTitle ?? title}</h1>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-[8px] pb-[calc(24px+env(safe-area-inset-bottom))] pt-[20px]">{body}</div>
        </div>
      ) : (
        <aside aria-label={title} className="h-full w-[320px] shrink-0 overflow-y-auto border-l border-app bg-app px-[12px] py-[20px]">
          {subTitle && (
            <button type="button" onClick={() => setView("info")} aria-label={`Volver a la información · ${subTitle}`} className="mb-[8px] flex min-h-[44px] items-center gap-[4px] rounded-[8px] px-[4px] text-[15px] font-[var(--fw-semibold)] tabular-nums text-app hover:bg-[var(--surface-2)]">
              <ChevronLeft className="size-[18px]" aria-hidden /> {subTitle}
            </button>
          )}
          {body}
        </aside>
      )}

      {blockFor && (
        <BlockConfirm
          name={firstName(blockFor.nombre)}
          onClose={() => setBlockFor(null)}
          onConfirm={async () => { await bloquear(blockFor.id); setBlockFor(null); }}
        />
      )}

      {confirm && (
        <ConfirmAction
          confirm={confirm}
          chat={chat}
          name={name}
          other={other}
          planId={props.planId}
          onNotice={props.onNotice}
          onClose={() => setConfirm(null)}
          onDone={(kind, person) => {
            setConfirm(null);
            if (kind === "vaciar") { props.onEmptied(); return; }
            if (kind === "quitar" && person) {
              setMembers((prev) => prev.filter((m) => m.id !== person.id));
              props.onChanged();
              return;
            }
            props.onGone();
          }}
        />
      )}
    </>
  );
}

function dedupeMembers(list: Member[], me: string): Member[] {
  const seen = new Set<string>();
  return list
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.nombre.localeCompare(b.nombre, "es")));
}

/* ── Cabecera: foto (botón 56), nombre en serif 28 y lápiz; editar en el sitio ── */

function Header(props: ChatInfoPanelProps & { name: string; other: Member | null; memberCount: number }) {
  const { chat, currentUserId, info, name, other } = props;
  const router = useRouter();
  const isGrupo = chat.tipo === "GRUPO";
  const avatar = resolveChatAvatar(chat, currentUserId);
  const [foto, setFoto] = useState(avatar);
  useEffect(() => { setFoto(avatar); }, [avatar]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const subtitle = chat.tipo === "DIRECTO"
    ? (info?.amigos_desde ? friendsSince(info.amigos_desde) : "Chat 1 a 1")
    : `${chat.tipo === "PLAN" ? "Plan" : "Grupo"} · ${plural(props.memberCount, "persona", "personas")}`;

  const onFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    try {
      const { downloadUrl } = await uploadPlanCoverFile({ file, userId: currentUserId });
      await updateChatFoto(chat.chat_id, downloadUrl);
      setFoto(downloadUrl);
      props.onFotoUpdated?.(downloadUrl);
      props.onChanged();
    } catch (err) {
      logError("Error cambiando la foto", err);
      setError(failText(err, "No se ha cambiado la foto"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    const nombre = draft.trim();
    if (!nombre) { setError("El grupo necesita un nombre."); return; }
    if (nombre === name) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      const notice = await renombrarChatEndpoint(chat.chat_id, nombre);
      if (notice) props.onNotice(notice);
      setEditing(false);
      props.onChanged();
    } catch (err) {
      logError("Error renombrando", err);
      setError(failText(err, "No se ha cambiado el nombre"));
    } finally {
      setSaving(false);
    }
  };

  const photo = (
    <span className="relative flex size-[56px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-[var(--surface-2)] text-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {foto ? <img src={foto} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        : isGrupo ? <Users className="size-[24px]" aria-hidden />
        : chat.tipo === "PLAN" ? <CalendarPlus className="size-[24px]" aria-hidden />
        : <span className="text-[20px] font-[var(--fw-semibold)] text-app">{(name[0] ?? "?").toUpperCase()}</span>}
    </span>
  );

  return (
    <div>
      <div className="flex items-center gap-[12px] pl-[8px]">
        {isGrupo ? (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Cambiar la foto del grupo" title="Cambiar la foto" className="relative shrink-0 rounded-full disabled:opacity-60">
            {photo}
            <span aria-hidden className="absolute -bottom-[2px] -right-[2px] flex size-[22px] items-center justify-center rounded-full border border-app bg-[var(--bg)] text-app">
              {uploading ? <span className="block size-[10px] animate-spin rounded-full border-2 border-muted border-t-transparent motion-reduce:animate-none" /> : <Camera className="size-[12px]" />}
            </span>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFoto(e)} />
          </button>
        ) : chat.tipo === "DIRECTO" && other ? (
          <button type="button" onClick={() => router.push(`/profile/${other.id}`)} aria-label={`Ver el perfil de ${other.nombre}`} className="shrink-0 rounded-full">{photo}</button>
        ) : photo}

        {editing ? (
          <div className="min-w-0 flex-1">
            <label htmlFor="chat-info-nombre" className="block text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Nombre del grupo</label>
            <div className="mt-[4px] flex items-center gap-[6px]">
              <input
                id="chat-info-nombre"
                ref={inputRef}
                value={draft}
                maxLength={80}
                disabled={saving}
                onChange={(e) => { setDraft(e.target.value); setError(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); void save(); }
                  if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setEditing(false); setDraft(name); setError(null); }
                }}
                aria-invalid={Boolean(error)}
                className="h-[40px] min-w-0 flex-1 border-b-2 border-[var(--primary)] bg-transparent [font-family:var(--font-display-face)] text-[26px] text-app outline-none"
              />
              <button type="button" onClick={() => void save()} disabled={saving} aria-label="Guardar nombre" title="Guardar" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)] disabled:opacity-50">
                <Check className="size-[20px]" aria-hidden />
              </button>
            </div>
            <p className="mt-[4px] text-[12px] text-muted">Lo ven todos · Intro guarda, Escape cancela</p>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              {chat.tipo === "DIRECTO" && other ? (
                <button type="button" onClick={() => router.push(`/profile/${other.id}`)} className="block max-w-full truncate text-left [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-app hover:underline">{name}</button>
              ) : (
                <h2 className="truncate [font-family:var(--font-display-face)] text-[28px] leading-[32px] text-app">{name}</h2>
              )}
              <p className="text-[12px] text-muted">{subtitle}</p>
            </div>
            {isGrupo && (
              <button type="button" onClick={() => { setDraft(name); setEditing(true); setError(null); }} aria-label="Editar el nombre del grupo" title="Editar nombre" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)] hover:text-app">
                <Pencil className="size-[18px]" aria-hidden />
              </button>
            )}
          </>
        )}
      </div>
      {error && <p role="alert" className="mt-[6px] pl-[8px] text-[13px] text-[var(--error)]">{error}</p>}
    </div>
  );
}

/* ── Planes de este grupo / Planes en común ── */

function SectionTitle({ children, count, flush }: { children: React.ReactNode; count?: number; flush?: boolean }) {
  return (
    <h3 className={`${flush ? "" : "mb-[4px] px-[8px] "}flex items-baseline gap-[8px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted`}>
      {children}
      {count !== undefined && <span className="font-normal tabular-nums">{count}</span>}
    </h3>
  );
}

function PlansSection({ title, plans, emptyTitle, emptyText, createLabel, otherName, onCreate, onOpen }: {
  title: string;
  plans: ChatInfoPlan[] | null;
  emptyTitle: string;
  emptyText: string;
  createLabel: string;
  otherName: string | null;
  onCreate: () => void;
  onOpen: (id: number) => void;
}) {
  return (
    <section>
      <SectionTitle>{title}</SectionTitle>
      {plans === null ? (
        <div aria-hidden className="mx-[8px] h-[52px] animate-pulse rounded-[8px] bg-[var(--surface-2)] motion-reduce:animate-none" />
      ) : plans.length === 0 ? (
        <div className="mx-[8px] rounded-[8px] border border-[var(--chat-me-border)] bg-[var(--chat-me)] p-[14px]">
          <p className="text-[15px] font-[var(--fw-semibold)] text-app">{emptyTitle}</p>
          <p className="mt-[2px] text-[13px] leading-[1.45] text-muted">{emptyText}</p>
          <button type="button" onClick={onCreate} className="mt-[10px] inline-flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] hover:opacity-90">
            <CalendarPlus className="size-[18px]" aria-hidden />
            {createLabel}
          </button>
        </div>
      ) : (
        <>
          {plans.map((p) => (
            <button key={p.id} type="button" onClick={() => onOpen(p.id)} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] py-[4px] pl-[8px] pr-[4px] text-left hover:bg-[var(--surface-2)]">
              <DateChip iso={p.inicio_at} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-app">{otherName ? `${p.titulo} con ${otherName}` : p.titulo}</span>
                <span className="block text-[12px] tabular-nums text-muted">{planRange(p.inicio_at, p.fin_at)}</span>
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-muted" aria-hidden />
            </button>
          ))}
          <button type="button" onClick={onCreate} className="flex min-h-[44px] w-full items-center gap-[12px] rounded-[8px] pl-[8px] text-left text-[15px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]">
            <span className="flex size-[34px] items-center justify-center"><Plus className="size-[18px]" aria-hidden /></span>
            Crear otro plan
          </button>
        </>
      )}
    </section>
  );
}

function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span aria-hidden className="flex size-[40px] shrink-0 flex-col items-center justify-center gap-[2px] overflow-hidden rounded-[8px] border border-[var(--chat-me-border)] bg-[var(--chat-me)]">
      <span className="[font-family:var(--font-display-face)] text-[17px] leading-[17px] tabular-nums text-app">{d.getDate()}</span>
      <span className="text-[9px] font-[var(--fw-semibold)] uppercase leading-[9px] tracking-[0.04em] text-muted">{MONTHS[d.getMonth()]}</span>
    </span>
  );
}

/* ── El viaje (board gi-d-plan): dates, milestones and expenses of a plan's chat ── */

const HITOS_SHOWN = 3;
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** «Hoy», «Ayer», «12 nov». */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

/** A decided moment as a milestone row: «Calzada Romana · Dom 29 · en el plan», «Plan creado · Hoy · desde «Grupo»». */
function hitoText(row: ContenidoRow): { title: string; detail: string } | null {
  const m = parseMoment(row.texto);
  if (m?.type === "hito_plan") {
    const d = new Date(m.inicio_at);
    return { title: m.titulo, detail: `${WEEKDAYS_SHORT[d.getDay()]} ${d.getDate()} · en el plan` };
  }
  if (m?.type === "plan_creado") return { title: "Plan creado", detail: `${dayLabel(row.created_at)} · desde «${m.origen_nombre}»` };
  if (m?.type === "propuesta") return { title: m.titulo, detail: `${dayLabel(row.created_at)} · ${m.detalle || "propuesta aceptada"}` };
  if (m?.type === "poll") return { title: m.question, detail: `${dayLabel(row.created_at)} · encuesta cerrada` };
  return null;
}

type TripData = { hitos: ContenidoRow[]; gastos: GastoRow[] };

function TripBlock({ planId, chat, currentUserId, members, decisiones, refreshKey, onJumpTo, onOpenDecisiones }: {
  planId?: number;
  chat: ChatListItem;
  currentUserId: string;
  members: Member[];
  /** fn_chat_info's count of decisions: more than shown → «Ver los N hitos». */
  decisiones?: number;
  /** Changes when a milestone or an expense arrives in the chat: the block reloads. */
  refreshKey?: number;
  onJumpTo: (mensajeId: number) => void;
  onOpenDecisiones: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<TripData | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const chatId = chat.chat_id;

  useEffect(() => {
    if (!planId) return;
    let alive = true;
    Promise.all([contenidoChatEndpoint(chatId, "decisiones", null, HITOS_SHOWN), listGastosForPlanEndpoint(planId)])
      .then(([hitos, gastos]) => {
        if (!alive) return;
        setFailed(false);
        // Oldest first, like the board: the trip reads in order.
        setData({ hitos: [...hitos].reverse(), gastos: gastos.filter((g) => g.estado === "CONFIRMADO") });
      })
      .catch((e) => {
        if (!alive) return;
        logError("Error cargando el viaje", e);
        setFailed(true);
      });
    return () => { alive = false; };
  }, [chatId, planId, refreshKey, attempt]);

  if (!planId) return null;
  const hasDates = Boolean(chat.plan_inicio_at && chat.plan_fin_at);
  const planHref = `/plans/${planId}`;

  return (
    <div className="flex flex-col gap-[24px]">
      <section className="px-[8px]">
        <SectionTitle flush>El viaje</SectionTitle>
        <p className="mt-[4px] [font-family:var(--font-display-face)] text-[36px] leading-[40px] tabular-nums text-app">
          {hasDates ? planRange(chat.plan_inicio_at!, chat.plan_fin_at!) : chat.plan_titulo}
        </p>
        {hasDates && (
          <p className="text-[12px] text-muted">
            {[tripDays(chat.plan_inicio_at!, chat.plan_fin_at!), tripWhen(chat.plan_inicio_at!, chat.plan_fin_at!), chat.plan_ubicacion].filter(Boolean).join(" · ")}
          </p>
        )}
        <button type="button" onClick={() => router.push(planHref)} className="-ml-[4px] flex min-h-[44px] items-center gap-[4px] rounded-[8px] px-[4px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]">
          Abrir el plan <ChevronRight className="size-[16px]" aria-hidden />
        </button>
      </section>

      {failed ? (
        <p role="alert" className="flex items-center gap-[8px] px-[8px] text-[13px] text-muted">
          No se han cargado los hitos ni los gastos.
          <button type="button" onClick={() => { setFailed(false); setData(null); setAttempt((n) => n + 1); }} className="min-h-[44px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Reintentar</button>
        </p>
      ) : data === null ? (
        <div aria-hidden className="mx-[8px] h-[96px] animate-pulse rounded-[8px] bg-[var(--surface-2)] motion-reduce:animate-none" />
      ) : (
        <>
          <HitosList hitos={data.hitos} total={decisiones} onJumpTo={onJumpTo} onOpenAll={onOpenDecisiones} />
          <GastosSummary gastos={data.gastos} currentUserId={currentUserId} members={members} onOpen={() => router.push(`${planHref}?tab=gastos`)} />
        </>
      )}
    </div>
  );
}

function HitosList({ hitos, total, onJumpTo, onOpenAll }: { hitos: ContenidoRow[]; total?: number; onJumpTo: (id: number) => void; onOpenAll: () => void }) {
  const rows = hitos.map((h) => ({ id: h.id, text: hitoText(h) })).filter((r): r is { id: number; text: { title: string; detail: string } } => r.text !== null);
  // Nothing decided yet: no section (like the empty rows of «En el chat»).
  if (rows.length === 0) return null;
  return (
    <section>
      <SectionTitle>Hitos</SectionTitle>
      {rows.map(({ id, text }) => (
        <button key={id} type="button" onClick={() => onJumpTo(id)} className="flex min-h-[44px] w-full items-center rounded-[8px] py-[4px] pl-[8px] pr-[4px] text-left hover:bg-[var(--surface-2)]">
          <span aria-hidden className="ml-[4px] mr-[12px] size-[10px] shrink-0 rotate-45 rounded-[2px] border-2 border-[var(--primary)] bg-[var(--primary)]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-[var(--fw-medium)] text-app">{text.title}</span>
            <span className="block truncate text-[12px] text-muted">{text.detail}</span>
          </span>
        </button>
      ))}
      {total !== undefined && total > rows.length && (
        <button type="button" onClick={onOpenAll} className="flex min-h-[44px] items-center rounded-[8px] px-[8px] text-[14px] font-[var(--fw-semibold)] tabular-nums text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]">
          Ver los {total} hitos
        </button>
      )}
    </section>
  );
}

/** «240,00 €» and «Pagado por Marcos · te tocan 60,00 €» (several payers: «4 gastos · …»). */
function GastosSummary({ gastos, currentUserId, members, onOpen }: { gastos: GastoRow[]; currentUserId: string; members: Member[]; onOpen: () => void }) {
  if (gastos.length === 0) return null;
  // Plans keep one currency; a stray one is left out of the sum instead of mixing them.
  const moneda = gastos[0].moneda || "EUR";
  const same = gastos.filter((g) => (g.moneda || "EUR") === moneda);
  const total = same.reduce((s, g) => s + Number(g.total), 0);
  const mine = same.reduce((s, g) => s + (g.partes ?? []).filter((p) => p.user_id === currentUserId).reduce((a, p) => a + Number(p.importe), 0), 0);
  const payers = new Set(same.map((g) => g.pagado_por_user_id));
  const payerId = same[0].pagado_por_user_id;
  const payerName = payerId === currentUserId ? "ti"
    : firstName(same[0].pagado_por_nombre ?? members.find((m) => m.id === payerId)?.nombre ?? "") || "alguien";
  const who = payers.size === 1 ? `Pagado por ${payerName}` : plural(same.length, "gasto", "gastos");
  const line = mine > 0 ? `${who} · te tocan ${formatMoney(mine, moneda)}` : who;

  return (
    <section className="px-[8px]">
      <SectionTitle flush>Gastos</SectionTitle>
      <p className="mt-[4px] text-[22px] font-[var(--fw-semibold)] tabular-nums text-app">{formatMoney(total, moneda)}</p>
      <p className="text-[12px] tabular-nums text-muted">{line}</p>
      <button type="button" onClick={onOpen} className="-ml-[4px] flex min-h-[44px] items-center rounded-[8px] px-[4px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]">
        Ver cuentas
      </button>
    </section>
  );
}

/* ── Personas / Quién va ── */

const PEOPLE_FOLD = 6;

function PeopleSection({ chat, members, info, currentUserId, isPlan, canInvite, alone, onAdd, onProfile, onWriteTo, onRemove, bloqueados, onBlock, onUnblock }: {
  chat: ChatListItem;
  members: Member[];
  info: ChatInfo | null;
  currentUserId: string;
  isPlan: boolean;
  canInvite: boolean;
  alone: boolean;
  onAdd: () => void;
  onProfile: (p: Member) => void;
  onWriteTo?: (p: Member) => void;
  onRemove: (p: Member) => void;
  bloqueados: Set<string>;
  onBlock: (p: Member) => void;
  onUnblock: (p: Member) => void;
}) {
  const [all, setAll] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const iAmAdmin = Boolean(info?.admins.includes(currentUserId));
  // More than 6: the first 5 and «Ver las N personas».
  const shown = all || members.length <= PEOPLE_FOLD ? members : members.slice(0, PEOPLE_FOLD - 1);

  return (
    <section>
      <SectionTitle count={members.length}>{isPlan ? "Quién va" : "Personas"}</SectionTitle>
      {canInvite && alone ? (
        <div className="mx-[8px] mb-[4px] rounded-[8px] border border-[var(--chat-me-border)] bg-[var(--chat-me)] p-[14px]">
          <p className="text-[15px] font-[var(--fw-semibold)] text-app">{isPlan ? "Aún estás tú solo" : "Aún no hay nadie más"}</p>
          <p className="mt-[2px] text-[13px] leading-[1.45] text-muted">{isPlan ? "Invita a quien venga para organizarlo juntos." : "Añade a tus amigos para hablar en el grupo."}</p>
          <button type="button" onClick={onAdd} className="mt-[10px] inline-flex h-[44px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] hover:opacity-90">
            <Plus className="size-[18px]" aria-hidden />
            {isPlan ? "Invitar al plan" : "Añadir personas"}
          </button>
        </div>
      ) : canInvite && (
        <button type="button" onClick={onAdd} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] py-[4px] pl-[8px] pr-[4px] text-left hover:bg-[var(--surface-2)]">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-muted"><Plus className="size-[18px]" aria-hidden /></span>
          <span className="text-[15px] font-[var(--fw-semibold)] text-app">{isPlan ? "Invitar al plan" : "Añadir personas"}</span>
        </button>
      )}
      {shown.map((m) => {
        const me = m.id === currentUserId;
        const roles = [
          info?.creador_id === m.id ? (isPlan ? "Creó el plan" : "Creó el grupo") : null,
          chat.tipo === "GRUPO" && info?.admins.includes(m.id) ? "Admin" : null,
        ].filter(Boolean).join(" · ");
        return (
          <div key={m.id} className="relative flex min-h-[52px] items-center gap-[12px] pl-[8px]">
            <PersonAvatar name={m.nombre} src={m.profile_image} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] text-app">{m.nombre}{me && <span className="text-muted"> · tú</span>}</span>
              {roles && <span className="block text-[12px] text-muted">{roles}</span>}
            </span>
            {!me && (
              <PersonMenu
                person={m}
                open={menuFor === m.id}
                onToggle={(o) => setMenuFor(o ? m.id : null)}
                onProfile={() => { setMenuFor(null); onProfile(m); }}
                onWriteTo={onWriteTo && !bloqueados.has(m.id) ? () => { setMenuFor(null); onWriteTo(m); } : undefined}
                onRemove={chat.tipo === "GRUPO" && iAmAdmin ? () => { setMenuFor(null); onRemove(m); } : undefined}
                blocked={bloqueados.has(m.id)}
                onBlock={() => { setMenuFor(null); onBlock(m); }}
                onUnblock={() => { setMenuFor(null); onUnblock(m); }}
              />
            )}
          </div>
        );
      })}
      {!all && members.length > PEOPLE_FOLD && (
        <button type="button" onClick={() => setAll(true)} className="flex min-h-[44px] w-full items-center rounded-[8px] pl-[8px] text-left text-[15px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]">
          Ver las {members.length} personas
        </button>
      )}
    </section>
  );
}

/** «⋯» of a person (board gi-d-menu): Ver perfil, Escribir a…, then in red Bloquear/Desbloquear and (admins) Quitar del grupo. */
function PersonMenu({ person, open, onToggle, onProfile, onWriteTo, onRemove, blocked, onBlock, onUnblock }: {
  person: Member;
  open: boolean;
  onToggle: (open: boolean) => void;
  onProfile: () => void;
  onWriteTo?: () => void;
  onRemove?: () => void;
  blocked: boolean;
  onBlock: () => void;
  onUnblock: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const first = wrapRef.current?.querySelector<HTMLElement>("[role=menuitem]");
    first?.focus();
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) onToggle(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onToggle]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(wrapRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onToggle(false); buttonRef.current?.focus(); }
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
  };

  const item = "flex min-h-[44px] w-full items-center gap-[10px] rounded-[6px] px-[10px] text-left text-[15px] outline-none hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)]";
  return (
    <div ref={wrapRef} className="ml-auto" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onToggle(!open)}
        aria-label={`Opciones de ${person.nombre}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Opciones"
        className={`flex size-[44px] items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)] ${open ? "bg-[var(--surface-2)]" : ""}`}
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label={`Opciones de ${person.nombre}`} className="absolute right-0 top-[48px] z-10 w-[220px] rounded-[8px] border border-app bg-[var(--bg)] p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.15)]">
          <button type="button" role="menuitem" onClick={onProfile} className={`${item} text-app`}><User className="size-[18px] text-muted" aria-hidden />Ver perfil</button>
          {onWriteTo && <button type="button" role="menuitem" onClick={onWriteTo} className={`${item} text-app`}><MessageCircle className="size-[18px] text-muted" aria-hidden />Escribir a {firstName(person.nombre)}</button>}
          <div aria-hidden className="my-[4px] h-px bg-[var(--border)]" />
          <button type="button" role="menuitem" onClick={blocked ? onUnblock : onBlock} className={`${item} text-[var(--error)]`}><Ban className="size-[18px]" aria-hidden />{blocked ? "Desbloquear" : "Bloquear"}</button>
          {onRemove && (
            <button type="button" role="menuitem" onClick={onRemove} className={`${item} text-[var(--error)]`}><UserMinus className="size-[18px]" aria-hidden />Quitar del grupo</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── En el chat · Avisos · zona de peligro ── */

const IN_CHAT: Array<{ tipo: ContenidoTipo; label: string; icon: React.ReactNode }> = [
  { tipo: "fotos", label: "Fotos y vídeos", icon: <ImageIcon className="size-[18px]" aria-hidden /> },
  { tipo: "archivos", label: "Archivos", icon: <FileText className="size-[18px]" aria-hidden /> },
  { tipo: "enlaces", label: "Enlaces", icon: <Link2 className="size-[18px]" aria-hidden /> },
  { tipo: "sitios", label: "Sitios", icon: <MapPin className="size-[18px]" aria-hidden /> },
  { tipo: "decisiones", label: "Decisiones", icon: <span aria-hidden className="inline-block size-[10px] rotate-45 rounded-[2px] border-2 border-[var(--primary)] bg-[var(--primary)]" /> },
  { tipo: "destacados", label: "Destacados", icon: <Star className="size-[18px]" aria-hidden /> },
];

function InChatSection({ info, infoError, onRetry, onOpenList }: { info: ChatInfo | null; infoError?: boolean; onRetry: () => void; onOpenList: (tipo: ContenidoTipo) => void }) {
  return (
    <section>
      <SectionTitle>En el chat</SectionTitle>
      {infoError && !info ? (
        <p className="flex min-h-[44px] items-center gap-[8px] px-[8px] text-[13px] text-muted">
          No se han podido cargar.
          <button type="button" onClick={onRetry} className="min-h-[44px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Reintentar</button>
        </p>
      ) : !info ? (
        <div aria-hidden className="mx-[8px] h-[52px] animate-pulse rounded-[8px] bg-[var(--surface-2)] motion-reduce:animate-none" />
      ) : IN_CHAT.every((r) => !info.recuentos[r.tipo]) ? (
        <p className="flex min-h-[44px] items-center px-[8px] text-[14px] text-muted">Aún no habéis compartido nada.</p>
      ) : IN_CHAT.filter((r) => (info.recuentos[r.tipo] ?? 0) > 0).map((r) => {
        const n = info.recuentos[r.tipo];
        const inner = (
          <>
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-2)] text-muted">{r.icon}</span>
            <span className="min-w-0 flex-1 text-[15px] text-app">{r.label}</span>
            <span className="ml-auto flex shrink-0 items-center gap-[2px] text-[14px] tabular-nums text-muted">
              {n}
              <ChevronRight className="size-[18px]" aria-hidden />
            </span>
          </>
        );
        return (
          <button key={r.tipo} type="button" onClick={() => onOpenList(r.tipo)} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] py-[4px] pl-[8px] pr-[4px] text-left hover:bg-[var(--surface-2)]">{inner}</button>
        );
      })}
    </section>
  );
}

function MuteSection({ chat, info, onChanged }: { chat: ChatListItem; info: ChatInfo | null; onChanged: () => void }) {
  const [on, setOn] = useState<boolean>(info?.silenciado ?? chat.silenciado ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (info) setOn(info.silenciado); }, [info]);

  const toggle = async () => {
    if (busy) return;
    const next = !on;
    setOn(next);
    setBusy(true);
    setError(null);
    try {
      await silenciarChatEndpoint(chat.chat_id, next);
      onChanged();
    } catch (e) {
      logError("Error silenciando", e);
      setOn(!next);
      setError(failText(e, next ? "No se ha silenciado" : "No se ha quitado el silencio"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>Avisos</SectionTitle>
      <button type="button" role="switch" aria-checked={on} onClick={() => void toggle()} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] py-[4px] pl-[8px] pr-[4px] text-left hover:bg-[var(--surface-2)]">
        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-2)] text-muted">{on ? <BellOff className="size-[18px]" aria-hidden /> : <Bell className="size-[18px]" aria-hidden />}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] text-app">Silenciar</span>
          <span className="block text-[12px] text-muted">Ves los mensajes, sin notificaciones</span>
        </span>
        <span aria-hidden className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors motion-reduce:transition-none ${on ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`}>
          <span className={`absolute top-[3px] size-[20px] rounded-full bg-[var(--bg)] transition-[left] duration-150 motion-reduce:transition-none ${on ? "left-[21px]" : "left-[3px]"}`} />
        </span>
      </button>
      {error && <p role="alert" className="px-[8px] text-[13px] text-[var(--error)]">{error}</p>}
    </section>
  );
}

function DangerRow({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] py-[4px] pl-[8px] pr-[4px] text-left text-[var(--error)] hover:bg-[var(--surface-2)]">
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[color-mix(in_srgb,var(--error)_12%,transparent)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[15px] font-[var(--fw-semibold)]">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
    </button>
  );
}

/* ── Confirmaciones (boards gi-m-salir, gi-m-vaciar): «Cancelar» y la acción en rojo ── */

type ConfirmState = { kind: "vaciar" | "salir" | "eliminar" | "eliminarPlan" } | { kind: "quitar"; person: Member };

function ConfirmAction({ confirm, chat, name, other, planId, onNotice, onClose, onDone }: {
  confirm: ConfirmState;
  chat: ChatListItem;
  name: string;
  other: Member | null;
  planId?: number;
  onNotice: (notice: NonNullable<ChatNotice>) => void;
  onClose: () => void;
  onDone: (kind: ConfirmState["kind"], person?: Member) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isPlan = chat.tipo === "PLAN";
  const otherName = firstName(other?.nombre ?? "");

  const copy = confirm.kind === "eliminarPlan"
    ? { title: `¿Eliminar «${name}»?`, text: "Eres la única persona del plan. Se borran el plan, su itinerario, sus gastos y su chat. No se puede deshacer.", action: "Eliminar el plan", fail: "No se ha eliminado el plan" }
    : confirm.kind === "vaciar"
    ? { title: "¿Vaciar el chat?", text: "Se borran los mensajes solo para ti. Los demás los siguen viendo.", action: "Vaciar el chat", fail: "No se ha vaciado el chat" }
    : confirm.kind === "eliminar"
      ? { title: `¿Eliminar el chat con ${otherName}?`, text: `Desaparece de tu lista y se borran los mensajes para ti. Si ${otherName} te escribe, vuelve.`, action: "Eliminar chat", fail: "No se ha eliminado el chat" }
      : confirm.kind === "quitar"
        ? { title: `¿Quitar a ${firstName(confirm.person.nombre)} del grupo?`, text: `Dejará de ver los mensajes nuevos. Cualquiera del grupo puede volver a añadir a ${firstName(confirm.person.nombre)}.`, action: "Quitar del grupo", fail: "No se ha quitado del grupo" }
        : isPlan
          ? { title: `¿Salir de «${name}»?`, text: "Dejas el plan y su chat. Para volver, alguien del plan tendrá que invitarte.", action: "Salir del plan", fail: "No has salido del plan" }
          : { title: `¿Salir de «${name}»?`, text: "Dejarás de recibir sus mensajes. Para volver, alguien del grupo tendrá que añadirte.", action: "Salir del grupo", fail: "No has salido del grupo" };

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let notice: ChatNotice = null;
      if (confirm.kind === "vaciar") await vaciarChatEndpoint(chat.chat_id);
      else if (confirm.kind === "eliminar") await eliminarChatEndpoint(chat.chat_id);
      else if (confirm.kind === "quitar") notice = await quitarMiembroEndpoint(chat.chat_id, confirm.person.id);
      else if (confirm.kind === "eliminarPlan" && planId) await eliminarPlanEndpoint(planId);
      else if (isPlan && planId) {
        const r = await leavePlanEndpoint(planId);
        if (LEAVE_PLAN_REFUSED[r]) { setError(LEAVE_PLAN_REFUSED[r]); setBusy(false); return; }
      } else notice = await leaveChat(chat.chat_id);
      if (notice) onNotice(notice);
      onDone(confirm.kind, confirm.kind === "quitar" ? confirm.person : undefined);
    } catch (e) {
      logError(copy.fail, e);
      setError(failText(e, copy.fail));
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={copy.title}
      onClose={busy ? () => {} : onClose}
      maxWidth={400}
      footer={(
        <div className="flex gap-[8px]">
          <button type="button" onClick={onClose} disabled={busy} className="min-h-[46px] flex-1 rounded-[8px] border border-app px-[16px] text-[15px] font-[var(--fw-semibold)] text-app hover:bg-[var(--surface-2)] disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => void run()} disabled={busy} className="min-h-[46px] flex-1 rounded-[8px] bg-[var(--error)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] hover:opacity-90 disabled:opacity-60">{busy ? "…" : copy.action}</button>
        </div>
      )}
    >
      <p className="text-[15px] leading-[1.5] text-muted">{copy.text}</p>
      {error && <p role="alert" className="mt-[8px] text-[13px] text-[var(--error)]">{error}</p>}
    </Sheet>
  );
}

/* ── Añadir personas (tus amigos que no están) ── */

function AddPeople({ chat, members, onNotice, onBack, onAdded }: { chat: ChatListItem; members: Member[]; onNotice: (n: NonNullable<ChatNotice>) => void; onBack: () => void; onAdded: (p: Member) => void }) {
  const [friends, setFriends] = useState<PublicUserProfileRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const memberIds = members.map((m) => m.id).join(",");

  useEffect(() => {
    let alive = true;
    fetchActiveFriends()
      .then((all) => { if (alive) setFriends(all.filter((f) => !memberIds.split(",").includes(f.id))); })
      .catch((e) => { logError("Error cargando amigos", e); if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, [memberIds]);

  const add = async (f: PublicUserProfileRow) => {
    if (adding) return;
    setAdding(f.id);
    setError(null);
    try {
      const notice = await addChatMember(chat.chat_id, f.id);
      if (notice) onNotice(notice);
      notifyChatAdded([f.id], chat.chat_id);
      onAdded({ id: f.id, nombre: f.nombre, username: f.username, profile_image: f.profile_image });
    } catch (e) {
      logError("Error añadiendo a alguien", e);
      setError(failText(e, `No se ha añadido a ${firstName(f.nombre)}`));
      setAdding(null);
    }
  };

  return (
    <div>
      {loadError ? (
        <p className="flex min-h-[44px] items-center gap-[8px] px-[8px] text-[14px] text-muted">
          No se han podido cargar tus amigos.
          <button type="button" onClick={onBack} className="min-h-[44px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Volver</button>
        </p>
      ) : friends === null ? (
        <p className="px-[8px] py-[12px] text-[14px] text-muted">Cargando tus amigos…</p>
      ) : friends.length === 0 ? (
        <p className="px-[8px] py-[12px] text-[14px] text-muted">Todos tus amigos ya están en el grupo.</p>
      ) : friends.map((f) => (
        <button key={f.id} type="button" onClick={() => void add(f)} disabled={Boolean(adding)} className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] py-[4px] pl-[8px] pr-[8px] text-left hover:bg-[var(--surface-2)] disabled:opacity-60">
          <PersonAvatar name={f.nombre} src={f.profile_image} size={34} />
          <span className="min-w-0 flex-1 truncate text-[15px] text-app">{f.nombre}</span>
          <span className="shrink-0 text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">{adding === f.id ? "Añadiendo…" : "Añadir"}</span>
        </button>
      ))}
      {error && <p role="alert" className="px-[8px] pt-[6px] text-[13px] text-[var(--error)]">{error}</p>}
    </div>
  );
}
