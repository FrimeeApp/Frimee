"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState, useCallback, Fragment, type ButtonHTMLAttributes } from "react";
import { buildTimeline, chapterLabel, inTimeOrder, tripRange, tripStatus, type ChapterLabel } from "@/components/chat/bitacora/timeline";
import { DayChapter } from "@/components/chat/bitacora/DayChapter";
import { ChatRuler, type RulerMark } from "@/components/chat/bitacora/ChatRuler";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { notifyChatAdded } from "@/components/chat/notifyChatAdded";
import {
  listChats,
  editMensaje,
  getChatMiembros,
  listMensajes,
  sendMensaje,
  sendBotMensaje,
  markChatRead,
  reactMensaje,
  pollVote,
  closePoll,
  resolveChatName,
  resolveChatAvatar,
  formatChatTime,
  type ChatListItem,
  type MensajeRow,
  type PollCierre,
  pollVotos,
} from "@/services/api/repositories/chat.repository";
import {
  getReaccionesEndpoint,
  pinMensajeEndpoint,
  getPinnedEndpoint,
  getChatIndiceEndpoint,
  getChatLecturasEndpoint,
  getSugerenciasEndpoint,
  completarSugerenciaEndpoint,
  type PlanCompletado,
  registrarGastoChatEndpoint,
  aceptarPropuestaEndpoint,
  anadirAlPlanEndpoint,
  deshacerAnadirEndpoint,
  type Sugerencia,
  listMensajesTramoEndpoint,
  listMensajesDespuesEndpoint,
  type ChatIndice,
  destacarMensajeEndpoint,
  getMisDestacadosEndpoint,
  resolverPropuestaEndpoint,
  type ReaccionResumen,
  getChatInfoEndpoint,
  eliminarMensajeEndpoint,
  type ChatInfo,
} from "@/services/api/endpoints/chat.endpoint";
import { parseMoment, momentPreview, momentAsAssistantText, formatEuros, noticeText, deletedText, type Moment, type ProposalMoment, type PlanCreatedMoment, type PlanMarkMoment, type PollMoment as PollData } from "@/components/chat/bitacora/moments";
import { ChatInfoPanel } from "@/components/chat/info/ChatInfoPanel";
import { Sheet, useIsPhone } from "@/components/chat/bitacora/Sheet";
import { PollMoment, emitPollVote, pollState, pollWinner, type PollPlanAction } from "@/components/chat/bitacora/PollMoment";
import { matchesText } from "@/lib/text-search";
import { getOpenChat, setOpenChat } from "@/lib/open-chat";
import { CallLine } from "@/components/chat/bitacora/CallLine";
import { TripSummaryCard, ExpenseCard, PlanItemCard } from "@/components/chat/bitacora/MomentCards";
import { PlaceCard } from "@/components/chat/bitacora/PlaceCard";
import { FrimeeProposal } from "@/components/chat/bitacora/FrimeeProposal";
import { MessageActions, DiamondIcon } from "@/components/chat/bitacora/MessageActions";
import { useRouter } from "next/navigation";
import { PlaceSheet, ExpenseSheet, InvitePlanSheet } from "@/components/chat/bitacora/AttachSheets";
import { AddToPlanPanel, type PanelPrefill } from "@/components/chat/bitacora/AddToPlanPanel";
import { PlanMarkLine } from "@/components/chat/bitacora/PlanMarkLine";
import { CreatePlanFlow, CopySeparator, PlanCreatedMark, useMisPlanIds, type Guarda } from "@/components/chat/bitacora/PlanFromChat";
import { isSuggestionCandidate } from "@/components/chat/bitacora/sugerencias";
import { uploadAudioBlob, uploadAudioFile, uploadDocumentFile, uploadMediaFile } from "@/services/firebase/upload";
import { createRealtimeTopic } from "@/lib/realtime";
import AudioPlayer from "@/components/common/AudioPlayer";
import { CameraModal } from "@/components/chat/CameraModal";
import { PollCreatorModal } from "@/components/chat/PollCreatorModal";
import { PLAN_WRITE_COMMANDS, VALID_TASK_CATEGORIES } from "@/components/chat/chat.constants";
import { crearTareaEndpoint, misTareasEndpoint, todasTareasEndpoint, updateEstadoTareaEndpoint, recordarEndpoint, type TareaRow } from "@/services/api/endpoints/tareas.endpoint";
import { fetchTopesEndpoint, getBalancesForPlanEndpoint, listGastosForPlanEndpoint, setPresupuestoEndpoint } from "@/services/api/endpoints/gastos.endpoint";
import { parseAmount } from "@/lib/money-input";
import { promoteToAdminEndpoint, demoteAdminEndpoint, expulsarPlanEndpoint, salirPlanEndpoint } from "@/services/api/endpoints/plans.endpoint";
import { callFrimeeAssistant, type FrimeeHistoryEntry } from "@/services/api/endpoints/frimee.endpoint";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { useBloqueos } from "@/hooks/useBloqueos";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { LinkifiedText } from "@/components/chat/bitacora/LinkifiedText";
import dynamic from "next/dynamic";

import { isPlanFinished as planFinished } from "@/lib/plan-dates";
import { FlightLine } from "@/components/flights/FlightLine";
import { useFriendFlight } from "@/components/flights/flight-data";
const EmojiMartPicker = dynamic(() => import("@emoji-mart/react"), { ssr: false });

// Shown over the input in plan chats so people find out about the @frimee assistant.
// They go away once the user asks it something or closes them (remembered per browser).
const AI_HINTS_KEY = "frimee-ai-hints-dismissed";
const AI_SUGGESTIONS = [
  { label: "¿Qué tiempo hará?", prompt: "@frimee ¿qué tiempo va a hacer durante el viaje?" },
  { label: "¿Cómo vamos de cuentas?", prompt: "@frimee ¿cómo vamos de cuentas? ¿quién debe más?" },
  { label: "Ideas para cenar", prompt: "@frimee proponnos 3 sitios para cenar y haz una encuesta para votar" },
];
import {
  Ban,
  Smile, Pin, Camera, Send as LucideSend, PlusCircle, Mic,
  File, Video, Music, BarChart2, Edit, ChevronLeft, Users,
  Phone, Download, X, Sparkles, MapPin, Receipt, CalendarDays, CalendarPlus, Info, Image as ImageIcon,
} from "lucide-react";

/** What the pinned bar says for a message without text (chat-19): a small icon and what it is. */
function pinnedSummary(m: MensajeRow): { icon: React.ReactNode; text: string } {
  const cls = "size-[14px] shrink-0 text-muted";
  if (m.audio_url) return { icon: <Mic className={cls} aria-hidden />, text: "Nota de voz" };
  if (m.image_url) {
    const video = Boolean(m.image_type?.startsWith("video/"));
    return { icon: video ? <Video className={cls} aria-hidden /> : <ImageIcon className={cls} aria-hidden />, text: m.texto?.trim() || (video ? "Vídeo" : "Foto") };
  }
  if (m.document_url) return { icon: <File className={cls} aria-hidden />, text: m.document_name || "Documento" };
  return { icon: null, text: momentPreview(m.texto) ?? m.texto };
}

const CHAT_ICON_BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-full transition-[background-color,color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] disabled:pointer-events-none disabled:opacity-40 active:scale-95";
const CHAT_ICON_BUTTON_TONE = {
  muted: "text-muted hover:bg-surface hover:text-app",
  primary: "text-[var(--primary)] hover:bg-[var(--primary)]/10",
  danger: "text-red-500 hover:bg-red-500/10",
} as const;
const CHAT_ICON_BUTTON_SIZE = {
  sm: "size-9",
  md: "size-10",
} as const;

type ChatIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  label: string;
  size?: keyof typeof CHAT_ICON_BUTTON_SIZE;
  tone?: keyof typeof CHAT_ICON_BUTTON_TONE;
};

/** What «Añadir al plan» hands to the add-activity sheet (read from the message or its card). */
export type PlanPrefill = { fecha?: string; hora?: string; horaFin?: string; tipo?: string; lugar?: string; lat?: number; lng?: number };

/** Plan card kind → activity type. */
const CARD_TIPO: Record<string, string> = {
  vuelo: "VUELO", tren: "TREN", bus: "BUS", barco: "BARCO", alojamiento: "HOTEL", restaurante: "RESTAURANTE", actividad: "ACTIVIDAD",
};

/** Long press opens reactions and actions (board s-sistema · Gestos). */
const LONG_PRESS_MS = 350;
const LAST_REACTION_KEY = "frimee:ultima-reaccion";

function ChatIconButton({
  label,
  size = "md",
  tone = "muted",
  className,
  children,
  ...props
}: ChatIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[
        CHAT_ICON_BUTTON_BASE,
        CHAT_ICON_BUTTON_SIZE[size],
        CHAT_ICON_BUTTON_TONE[tone],
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </button>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateLabel(date: Date): string {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((todayMidnight.getTime() - dateMidnight.getTime()) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  const sameYear = date.getFullYear() === now.getFullYear();
  const sameMonth = sameYear && date.getMonth() === now.getMonth();
  if (!sameYear) return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  if (!sameMonth) return date.toLocaleDateString("es-ES", { day: "numeric", month: "long" });
  return date.toLocaleDateString("es-ES", { day: "numeric" });
}

/** How a «Se eliminó» moment is written; «bloqueado» is only ever drawn, never stored. */
const TAPADO = JSON.stringify({ type: "eliminado", por: "bloqueado" });

/**
 * In groups and plans, what someone I blocked writes is drawn as «Mensaje de una persona bloqueada»
 * (only plain messages: their polls, expenses, notices and calls stay as they are):
 * no text, media or reply, and (being an «eliminado» moment) no actions or reactions. Quotes of
 * those messages too. In their 1 a 1 (bloqueados = null) what they said before stays as it was.
 */
function taparBloqueados<T extends MensajeRow>(list: T[], bloqueados: Set<string> | null, me: string): T[] {
  if (!bloqueados || bloqueados.size === 0) return list;
  const tapados = new Set(list.filter((m) => m.sender_id !== me && bloqueados.has(m.sender_id)
    && !m.tipo?.startsWith("call_") && !parseMoment(m.texto)).map((m) => m.id));
  return list.map((m) => {
    if (tapados.has(m.id)) {
      return { ...m, texto: TAPADO, audio_url: null, document_url: null, document_name: null, image_url: null, image_type: null, reply_to_id: null, reply_texto: null, reply_sender_nombre: null };
    }
    if (m.reply_to_id != null && tapados.has(m.reply_to_id)) return { ...m, reply_texto: TAPADO };
    return m;
  });
}

export function ChatConversation({
  chat,
  currentUserId,
  onBack,
  backOnPhoneOnly,
  onNewMessage,
  onStartCall,
  onJoinCall,
  inCall,
  onFotoUpdated,
  registerCallReload,
  containerClassName,
  embedded,
  planInfo,
  planId,
  isAdmin,
  onAbrirActividad,
  onLeave,
  onMembersChanged,
  onOpenChat,
  initialMessageId,
  onChatChanged,
  onWriteTo,
  onRenamed,
}: {
  chat: ChatListItem;
  currentUserId: string;
  onBack: () => void;
  /** Messages page: from md the list is beside the chat, so «‹» only on phones. */
  backOnPhoneOnly?: boolean;
  onNewMessage: (msg: MensajeRow) => void;
  onStartCall?: (tipo: "audio" | "video") => void;
  onJoinCall?: (llamadaId: number, roomName: string, tipo: "audio" | "video") => void;
  inCall?: boolean;
  onFotoUpdated?: (foto: string) => void;
  registerCallReload?: (fn: () => void) => void;
  containerClassName?: string;
  embedded?: boolean;
  planInfo?: { titulo: string; inicio_at: string; fin_at: string; ubicacion_nombre: string };
  planId?: number;
  isAdmin?: boolean;
  onAbrirActividad?: (titulo: string, extra?: PlanPrefill) => void;
  onLeave?: () => void;
  onMembersChanged?: () => void;
  /** Opens another chat (the plan made from this one, or the original from its copy). */
  onOpenChat?: (chatId: string) => void;
  /** Open at this message (a result of the Messages search) instead of at the bottom. */
  initialMessageId?: number;
  /** Name, photo, people or silence changed (here or from someone else's notice): reload the list. */
  onChatChanged?: () => void;
  /** «Escribir a Ana» from the chat information: her 1 a 1 chat. */
  onWriteTo?: (person: ChatListItem["miembros"][number]) => void;
  /** The group got a new name (a notice arrived): show it before the list reloads. */
  onRenamed?: (nombre: string) => void;
}) {
  type LocalMsg = MensajeRow & { _key?: number };
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  // Who I blocked: their group messages are covered, and in their 1 a 1 I cannot write.
  const { bloqueados, desbloquear } = useBloqueos();
  const [unblockError, setUnblockError] = useState<string | null>(null);
  // Who I blocked, only in a 1 a 1 (null elsewhere): read inside the realtime handlers.
  const bloqueoRef = useRef<{ set: Set<string>; directo: boolean }>({ set: bloqueados, directo: false });
  useEffect(() => { bloqueoRef.current = { set: bloqueados, directo: chat.tipo === "DIRECTO" }; }, [bloqueados, chat.tipo]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestIdRef = useRef<number | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingTaskListRef = useRef<TareaRow[]>([]);
  // clientId: one per confirmation, so a retry never registers it twice.
  type PendingGasto = { clientId: string; planId: number; titulo: string; total: number; pagadoPorId: string; pagadoPorNombre: string; participantes: { user_id: string; nombre: string }[] };
  const pendingGastoRef = useRef<PendingGasto | null>(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  // Hidden until read from localStorage, so it never flashes for someone who closed it.
  const [aiHintsDismissed, setAiHintsDismissed] = useState(true);
  useEffect(() => {
    try {
      setAiHintsDismissed(localStorage.getItem(AI_HINTS_KEY) === "1");
    } catch {
      setAiHintsDismissed(false);
    }
  }, []);
  const dismissAiHints = () => {
    setAiHintsDismissed(true);
    try {
      localStorage.setItem(AI_HINTS_KEY, "1");
    } catch {
      // Blocked storage: hidden for this visit only.
    }
  };
  // Chat information (boards gi-*): a 320 px panel next to the chat on desktop, full screen on phones.
  const [showInfo, setShowInfo] = useState(false);
  // The panel opened straight on a list («Ver destacados»); null = the usual information.
  const [infoStart, setInfoStart] = useState<"destacados" | null>(null);
  const [infoKey, setInfoKey] = useState(0);
  const [starToast, setStarToast] = useState(false);
  useEffect(() => {
    if (!starToast) return;
    const t = setTimeout(() => setStarToast(false), 5000);
    return () => clearTimeout(t);
  }, [starToast]);
  const isPhone = useIsPhone();
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [chatInfoError, setChatInfoError] = useState(false);
  const loadChatInfo = useCallback(() => {
    setChatInfoError(false);
    getChatInfoEndpoint(chat.chat_id)
      .then(setChatInfo)
      .catch((e) => { console.error("[chat] Error leyendo la información del chat:", (e as { message?: string })?.message ?? String(e)); setChatInfoError(true); });
  }, [chat.chat_id]);
  useEffect(() => { setChatInfo(null); loadChatInfo(); }, [loadChatInfo]);
  // The whole chat (its outer box, padding included): where a poll draw's board plays (po-*-cine).
  const [drawHost, setDrawHost] = useState<HTMLDivElement | null>(null);
  // This chat is on screen: the app-wide listener does not announce its draws again.
  useEffect(() => {
    setOpenChat(chat.chat_id);
    return () => { if (getOpenChat() === chat.chat_id) setOpenChat(null); };
  }, [chat.chat_id]);
  // Admin of this chat: of its plan, or of its group (fn_chat_info). The DB checks it again.
  const iAmAdmin = Boolean(isAdmin) || Boolean(chatInfo?.admins.includes(currentUserId));
  // «Eliminar»: for me, or for everyone (mine; an admin's with anyone's).
  const [deleting, setDeleting] = useState<MensajeRow | null>(null);
  // A notice arriving now (someone renamed, added, removed or left): the panel and the list catch up.
  const lastSeenIdRef = useRef<number | null>(null);
  // The newest message that belongs to «En el chat»: an open list there adds what is newer.
  const [inChatNewest, setInChatNewest] = useState(0);
  useEffect(() => { lastSeenIdRef.current = null; }, [chat.chat_id]);
  // The message menu: where it opens (over the action bar, or at the pointer) and whether it is only the reactions.
  const router = useRouter();
  // What @frimee saw in each message (activity / expense), and which ones were already asked about.
  const [sugerencias, setSugerencias] = useState<Record<number, Sugerencia>>({});
  const askedRef = useRef<Set<number>>(new Set());
  // Messages @frimee is reading right now (the model is working: seconds, more the first time).
  const [reading, setReading] = useState<Set<number>>(new Set());
  // «Añadir al plan» panel: the message, where it opens (desktop) and one id per opening (no duplicates).
  // `ctx`: @frimee re-reading that message with the conversation around it (chat-sugerencias · completar).
  const [addPanel, setAddPanel] = useState<{
    msg: MensajeRow; anchor: { x: number; y: number } | null; clientId: string;
    ctx: { status: "loading" } | { status: "done"; plan: PlanCompletado | null } | { status: "failed" } | null;
  } | null>(null);
  // «Crear plan» from this chat (chats without a plan); `guarda` = what was being added, if anything.
  // From the diamond: the message (to fall back to «añadir a un plan que ya tienes») and what it says.
  const [createPlan, setCreatePlan] = useState<{
    guarda: Guarda | null;
    msg?: MensajeRow;
    anchor?: { x: number; y: number } | null;
    inicial?: { titulo?: string; fecha?: string; lugar?: string } | null;
    leerOrigen?: boolean;
  } | null>(null);
  // After adding: «Añadido a «Plan» · Ver · Deshacer» for a few seconds.
  const [addedToast, setAddedToast] = useState<{ planId: number; planTitulo: string; mensajeId: number } | null>(null);
  useEffect(() => {
    if (!addedToast) return;
    const t = setTimeout(() => setAddedToast(null), 8000);
    return () => clearTimeout(t);
  }, [addedToast]);
  const [expensePrefill, setExpensePrefill] = useState<{ titulo: string; importe: number; pagador: string | null } | null>(null);
  // How far the others have read (fn_chat_lecturas): «visto» when all of them read past a message.
  const [lecturas, setLecturas] = useState<Array<{ user_id: string; last_read_at: string | null }>>([]);
  const loadLecturasRef = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true;
    const load = () => {
      void getChatLecturasEndpoint(chat.chat_id)
        .then((rows) => { if (alive) setLecturas(rows); })
        .catch((e) => console.error("[chat] Error leyendo lecturas:", (e as { message?: string })?.message ?? String(e)));
    };
    loadLecturasRef.current = load;
    load();
    return () => { alive = false; };
  }, [chat.chat_id]);
  // The one message in the tab order (roving focus); the latest one until you move.
  const [focusMsgId, setFocusMsgId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: MensajeRow; x: number; y: number; place?: "above" | "cursor"; reactionsOnly?: boolean } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MensajeRow | null>(null);
  const [editingMsg, setEditingMsg] = useState<MensajeRow | null>(null);
  // Everyone's reactions per message: emoji, count and whether one of them is mine.
  const [reactions, setReactions] = useState<Record<number, ReaccionResumen[]>>({});
  const [attachSheet, setAttachSheet] = useState<null | "lugar" | "gasto" | "plan">(null);
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MensajeRow | null>(null);
  const { isClosing: forwardClosing, requestClose: closeForwardModal } = useModalCloseAnimation(() => setForwardMsg(null), !!forwardMsg);
  const [forwardChats, setForwardChats] = useState<ChatListItem[]>([]);
  const [forwardSending, setForwardSending] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiContainerRef = useRef<HTMLDivElement | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  // A send that failed (chat-27): said above the composer, with «Reintentar» when it can be redone.
  const [sendError, setSendError] = useState<{ text: string; retry?: () => void } | null>(null);
  // «Solo lo ves tú» (po-sistema): what a command could not do, over the composer; gone on the next send.
  const [ephemeral, setEphemeral] = useState<string | null>(null);
  // «/cerrar»: the highlighted poll in its list, and how each one is going (votes per option).
  const [cerrarActive, setCerrarActive] = useState(0);
  const [cerrarCounts, setCerrarCounts] = useState<Record<number, number[]>>({});
  const sendFail = (what: string) =>
    typeof navigator !== "undefined" && !navigator.onLine ? `Sin conexión: ${what}.` : `${what.charAt(0).toUpperCase()}${what.slice(1)}. Inténtalo de nuevo.`;
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeRef = useRef<{ startX: number; startY: number; el: HTMLElement; triggered: boolean; moved: boolean; t0: number } | null>(null);
  const lastTapRef = useRef<{ id: number; t: number } | null>(null);
  const lastTouchAtRef = useRef(0);
  // Hold the mic to record: release sends, slide left cancels, slide up locks.
  const [recordHold, setRecordHold] = useState<{ dx: number; locked: boolean } | null>(null);
  const micPointerTypeRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sentMsgIdsRef = useRef<Set<number>>(new Set());
  const supabaseRef = useRef(createBrowserSupabaseClient());
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; });
  // Same for onLeave: a new function from the parent must not resubscribe the channel.
  const onLeaveRef = useRef(onLeave);
  useEffect(() => { onLeaveRef.current = onLeave; });
  const onBackRef = useRef(onBack);
  useEffect(() => { onBackRef.current = onBack; });

  const name = resolveChatName(chat, currentUserId);
  const avatar = resolveChatAvatar(chat, currentUserId);

  // Ongoing group call banner
  type OngoingCall = { id: number; room_name: string; tipo: "audio" | "video" };
  const [ongoingCall, setOngoingCall] = useState<OngoingCall | null>(null);
  useEffect(() => {
    setOngoingCall(null); // reset when chat changes
    if (chat.tipo !== "GRUPO") return;
    const sb = supabaseRef.current;
    // Initial query — only calls started in the last 15 min (realtime handles live updates)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    void sb.from("llamadas")
      .select("id, room_name, tipo")
      .eq("chat_id", chat.chat_id)
      .in("estado", ["ringing", "active"])
      .gte("iniciada_at", fifteenMinutesAgo)
      .order("iniciada_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          const row = data as { id: number; room_name: string; tipo: "audio" | "video" };
          setOngoingCall({ id: row.id, room_name: row.room_name, tipo: row.tipo });
        }
      });
    // Realtime updates
    const ch = sb.channel(createRealtimeTopic("llamadas-grupo", chat.chat_id))
      .on("postgres_changes", { event: "*", schema: "public", table: "llamadas", filter: `chat_id=eq.${chat.chat_id}` }, (payload) => {
        const row = payload.new as { id: number; room_name: string; tipo: "audio" | "video"; estado: string } | undefined;
        if (row?.estado === "ringing" || row?.estado === "active") {
          setOngoingCall({ id: row.id, room_name: row.room_name, tipo: row.tipo });
        } else if (row?.estado === "ended" || row?.estado === "missed") {
          setOngoingCall(null);
        }
      })
      .subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [chat.chat_id, chat.tipo]);

  // Register reload function for call records
  useEffect(() => {
    registerCallReload?.(() => {
      void listMensajes({ chatId: chat.chat_id, limit: 50 }).then((fresh) => {
        setMessages(fresh);
        if (fresh.length > 0) oldestIdRef.current = fresh[0].id;
        isNearBottomRef.current = true;
      });
    });
  }, [chat.chat_id, registerCallReload]);

  useEffect(() => {
    // The index first: it reads your last read before markChatRead moves it.
    const indicePromise = getChatIndiceEndpoint(chat.chat_id)
      .then(setIndice)
      .catch((e) => console.error("[chat] Error leyendo el índice:", (e as { message?: string })?.message ?? String(e)));
    void (async () => {
      try {
        const data = await listMensajes({ chatId: chat.chat_id, limit: 50 });
        setMessages(data);
        if (data.length > 0) oldestIdRef.current = data[0].id;
        setHasMore(data.length === 50);
        // Reactions, pin and stars never block the conversation: each one may fail on its own.
        void loadReactionsRef.current();
        void getPinnedEndpoint(chat.chat_id).then(setPinnedId).catch((e) => console.error("[chat] Error leyendo el fijado:", (e as { message?: string })?.message ?? String(e)));
        void getMisDestacadosEndpoint(chat.chat_id).then((ids) => setStarredIds(new Set(ids))).catch((e) => console.error("[chat] Error leyendo destacados:", (e as { message?: string })?.message ?? String(e)));
      } catch (e) {
        console.error("[chat] Error cargando mensajes:", e);
      } finally {
        setLoading(false);
      }
    })();
    void indicePromise.finally(() => markChatRead(chat.chat_id).then(() => {
      window.dispatchEvent(new Event("frimee:chat-unread-changed"));
      void channelRef.current?.send({ type: "broadcast", event: "read", payload: { user_id: currentUserId } });
    }));
  }, [chat.chat_id, currentUserId]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const topic = `msg:${chat.chat_id}`;
    // supabase.channel() returns an existing channel with the same topic, even one that
    // is already subscribed, and adding callbacks to it throws. removeChannel() is async,
    // so after a quick remount the previous channel can still be there: remove it first.
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = async () => {
      const stale = supabase.getChannels().find((c) => c.topic === `realtime:${topic}`);
      if (stale) await supabase.removeChannel(stale);
      if (cancelled) return;

      channel = supabase
      .channel(topic)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as MensajeRow;
        // The sender broadcasts it themselves: in a 1 a 1 with someone I blocked it must not show
        // (the database already keeps it from me; in groups it is drawn covered).
        const bloqueo = bloqueoRef.current;
        if (bloqueo.directo && bloqueo.set.has(msg.sender_id)) return;
        if (sentMsgIdsRef.current.has(msg.id)) {
          sentMsgIdsRef.current.delete(msg.id);
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        onNewMessageRef.current(bloqueo.directo ? msg : taparBloqueados([msg], bloqueo.set, currentUserId)[0]);
        void markChatRead(chat.chat_id).then(() => {
          window.dispatchEvent(new Event("frimee:chat-unread-changed"));
          void channelRef.current?.send({ type: "broadcast", event: "read", payload: { user_id: currentUserId } });
        });
      })
      .on("broadcast", { event: "edit_message" }, ({ payload }) => {
        const { id, texto } = payload as { id: number; texto: string };
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, texto } : m)));
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        // With `texto`: deleted for everyone, it stays as «Se eliminó este mensaje». Without: an older app.
        const { id, texto } = payload as { id: number; texto?: string };
        setMessages((prev) => (texto
          ? prev.map((m) => (m.id !== id ? m : { ...m, texto, audio_url: null, document_url: null, document_name: null, image_url: null, image_type: null, tipo: "text" }))
          : prev.filter((m) => m.id !== id)));
        setPinnedId((p) => (p === id ? null : p));
      })
      .on("broadcast", { event: "kick_member" }, ({ payload }) => {
        const { user_id } = payload as { user_id: string };
        if (user_id === currentUserId) (onLeaveRef.current ?? onBackRef.current)?.();
      })
      .on("broadcast", { event: "poll_vote" }, ({ payload }) => {
        const { mensaje_id } = payload as { mensaje_id: number; option_index: number };
        emitPollVote(mensaje_id);
      })
      .on("broadcast", { event: "reactions_changed" }, () => { void loadReactionsRef.current(); })
      // Someone read the chat: refresh the «visto» checks.
      .on("broadcast", { event: "read" }, () => { loadLecturasRef.current(); })
      .on("broadcast", { event: "pin_changed" }, ({ payload }) => {
        const { mensaje_id } = payload as { mensaje_id: number | null };
        setPinnedId(mensaje_id);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `chat_id=eq.${chat.chat_id}` },
        (payload) => {
          const msg = payload.new as MensajeRow;
          // Only what the database writes on its own: call records and notices (renamed, added,
          // removed, left). People's messages arrive by broadcast from whoever sent them.
          if (!msg.tipo?.startsWith("call_") && parseMoment(msg.texto)?.type !== "aviso") return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            isNearBottomRef.current = true;
            return [...prev, msg];
          });
          onNewMessageRef.current(msg);
        }
      )
      .subscribe();
      channelRef.current = channel;
    };
    void subscribe();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chat.chat_id, currentUserId]);

  const isNearBottomRef = useRef(true);
  const observerReadyRef = useRef(false);
  // «Ir a lo último» (board m-recorrer): away from the end, and how many arrived meanwhile.
  const [awayFromEnd, setAwayFromEnd] = useState(false);
  const [newWhileAway, setNewWhileAway] = useState(0);
  const lastMsgIdRef = useRef<number | null>(null);
  // The whole chat for the ruler (fn_chat_indice), and the loaded stretch when it is not the latest
  // one (after jumping to an old milestone): its position and last message.
  const [indice, setIndice] = useState<ChatIndice | null>(null);
  const [detached, setDetached] = useState<{ start: number; endId: number } | null>(null);
  const detachedRef = useRef(detached);
  useEffect(() => { detachedRef.current = detached; }, [detached]);
  // While an old stretch loads: the day it belongs to, for the loading rows.
  const [jumping, setJumping] = useState<ChapterLabel | null>(null);
  const [loadingNewer, setLoadingNewer] = useState(false);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setLoadingMore(false);
    setHasMore(true);
    oldestIdRef.current = null;
    isNearBottomRef.current = true;
    observerReadyRef.current = false;
    setAwayFromEnd(false);
    setNewWhileAway(0);
    lastMsgIdRef.current = null;
    setIndice(null);
    setDetached(null);
    setJumping(null);
  }, [chat.chat_id]);

  // Follow the reader: new messages only pull the view down when you are at the end.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const fromEnd = container.scrollHeight - container.scrollTop - container.clientHeight;
      isNearBottomRef.current = fromEnd < 120;
      setAwayFromEnd(fromEnd > container.clientHeight / 2);
      if (fromEnd < 120) setNewWhileAway(0);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // @frimee reads the loaded text messages once, in batches, after the chat settles.
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      const ids = messages
        .filter((m) => isSuggestionCandidate(m) && !askedRef.current.has(m.id))
        .map((m) => m.id)
        .slice(-60);
      if (ids.length === 0) return;
      ids.forEach((id) => askedRef.current.add(id));
      void getSugerenciasEndpoint(chat.chat_id, ids, (asking) => setReading((prev) => new Set([...prev, ...asking])))
        .then((rows) => setSugerencias((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.mensaje_id] = r;
          return next;
        }))
        .catch((e) => {
          ids.forEach((id) => askedRef.current.delete(id));
          console.error("[chat] Error leyendo sugerencias:", (e as { message?: string })?.message ?? String(e));
        })
        .finally(() => setReading((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.delete(id));
          return next;
        }));
    }, 800);
    return () => clearTimeout(t);
  }, [messages, loading, chat.chat_id]);

  // Count what others send while you read further up.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    const prevId = lastMsgIdRef.current;
    lastMsgIdRef.current = last.id;
    if (prevId === null || last.id === prevId || last.id < 0) return;
    if (!isNearBottomRef.current && last.sender_id !== currentUserId) setNewWhileAway((n) => n + 1);
  }, [messages, currentUserId]);


  // Phones: the keyboard opens or closes (NativeSystemUi). If you were at the end of the chat, the
  // last messages stay in view right above it instead of being covered.
  useEffect(() => {
    const onKeyboard = () => {
      const container = scrollContainerRef.current;
      if (!container || !isNearBottomRef.current) return;
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    };
    window.addEventListener("frimee:keyboard", onKeyboard);
    return () => window.removeEventListener("frimee:keyboard", onKeyboard);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!observerReadyRef.current) {
      // Primera carga: saltar al fondo instantáneamente
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
      // Activar observer después de un tick para que el scroll esté asentado
      setTimeout(() => { observerReadyRef.current = true; }, 100);
    } else if (isNearBottomRef.current && !detachedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  // In an old stretch: load newer messages when its end comes into view, until the latest.
  useEffect(() => {
    const sentinel = bottomSentinelRef.current;
    if (!sentinel || !detached) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      const d = detachedRef.current;
      if (!entry.isIntersecting || loadingNewer || !d) return;
      setLoadingNewer(true);
      try {
        const newer = await listMensajesDespuesEndpoint(chat.chat_id, d.endId, 50);
        isNearBottomRef.current = false;
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const real = [...prev.filter((m) => m.id > 0), ...newer.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
          return [...real, ...prev.filter((m) => m.id < 0)];
        });
        setDetached(newer.length < 50 ? null : { ...d, endId: newer[newer.length - 1].id });
      } catch (e) {
        console.error("[chat] Error cargando mensajes nuevos:", (e as { message?: string })?.message ?? String(e));
      } finally {
        setLoadingNewer(false);
      }
    }, { root: scrollContainerRef.current, threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [chat.chat_id, detached, loadingNewer]);

  // Load more (older) messages when sentinel enters viewport
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || !hasMore || !observerReadyRef.current) return;
      const oldestId = oldestIdRef.current;
      if (!oldestId) return;
      setLoadingMore(true);
      isNearBottomRef.current = false;
      try {
        const older = await listMensajes({ chatId: chat.chat_id, limit: 50, cursorId: oldestId });
        if (older.length === 0) { setHasMore(false); return; }
        const container = scrollContainerRef.current;
        const prevScrollHeight = container?.scrollHeight ?? 0;
        setMessages((prev) => [...older, ...prev]);
        oldestIdRef.current = older[0].id;
        setDetached((d) => (d ? { ...d, start: Math.max(0, d.start - older.length) } : d));
        if (older.length < 50) setHasMore(false);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevScrollHeight;
        });
      } catch (e) {
        console.error("[chat] Error cargando más mensajes:", e);
      } finally {
        setLoadingMore(false);
      }
    }, { root: scrollContainerRef.current, threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [chat.chat_id, loadingMore, hasMore, loading]);

  useEffect(() => {
    if (!forwardMsg) { setForwardChats([]); return; }
    void listChats().then(setForwardChats);
  }, [forwardMsg]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleOutside = (e: MouseEvent) => {
      if (emojiContainerRef.current && !emojiContainerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showEmojiPicker]);

  const handleEmojiSelect = useCallback((emoji: { native: string }) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const newText = input.value.slice(0, start) + emoji.native + input.value.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + emoji.native.length;
      input.setSelectionRange(pos, pos);
    });
  }, []);

  const closeOverlays = () => {
    setContextMenu(null);
    setShowAttachMenu(false);
    setShowEmojiPicker(false);
    // Let go of the focus a message's bar or menu took, so nothing stays highlighted.
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest("article")) active.blur();
  };
  const logError = (what: string, e: unknown) => console.error(`[chat] ${what}:`, (e as { message?: string })?.message ?? String(e));

  // ── Reactions, pin and stars (phase 2: stored, and the pin is shared by the whole chat) ──
  const loadReactions = async () => {
    try {
      const rows = await getReaccionesEndpoint(chat.chat_id);
      const map: Record<number, ReaccionResumen[]> = {};
      for (const r of rows) (map[r.mensaje_id] ??= []).push(r);
      setReactions(map);
    } catch (e) {
      logError("Error leyendo reacciones", e);
    }
  };
  const loadReactionsRef = useRef(loadReactions);
  useEffect(() => { loadReactionsRef.current = loadReactions; });

  const myReactionOf = (msgId: number) => reactions[msgId]?.find((r) => r.mia)?.emoji ?? null;

  /** emoji "" removes mine. One reaction per person, as before. */
  const reactTo = (msgId: number, emoji: string) => {
    if (msgId < 0) return;
    if (emoji) {
      try { localStorage.setItem(LAST_REACTION_KEY, emoji); } catch { /* storage blocked: keep the default */ }
    }
    const prev = reactions;
    setReactions((all) => {
      const list = (all[msgId] ?? [])
        .map((r) => (r.mia ? { ...r, total: r.total - 1, mia: false } : { ...r }))
        .filter((r) => r.total > 0);
      if (emoji) {
        const same = list.find((r) => r.emoji === emoji);
        if (same) { same.total += 1; same.mia = true; } else list.push({ mensaje_id: msgId, emoji, total: 1, mia: true });
      }
      return { ...all, [msgId]: list };
    });
    void reactMensaje(msgId, emoji)
      .then(() => channelRef.current?.send({ type: "broadcast", event: "reactions_changed", payload: { mensaje_id: msgId } }))
      .catch((e) => { setReactions(prev); logError("Error guardando reacción", e); });
  };

  /**
   * «Añadir al plan» (rombo, P) and «Registrar como gasto» (G) only where they make sense: a shared
   * place or plan card, or a text where @frimee saw an activity or an expense (mensaje_sugerencias,
   * filled by the chat-sugerencias function). The sheet opens with what was read, to review.
   */
  const planFrom = (m: MensajeRow): ({ titulo: string } & PlanPrefill) | null => {
    const mo = parseMoment(m.texto);
    // A shared place: its name and coordinates as they are.
    if (mo?.type === "lugar") return { titulo: mo.nombre, lugar: mo.nombre, lat: mo.lat, lng: mo.lng };
    if (mo?.type === "tarjeta") return { titulo: mo.titulo, tipo: CARD_TIPO[mo.kind], lugar: mo.lugar ?? undefined };
    // A decided poll (po-sistema): the winning option; the panel lets you pick what it is. A yes/no
    // poll is about its question («¿Partido mañana?» → «Partido mañana»), never a place called «Sí».
    // This is only the fallback: the panel asks @frimee to read the poll with its conversation.
    if (mo?.type === "poll") {
      const w = pollWinner(mo);
      if (!w) return null;
      if (/^(s[ií]|no)\b/i.test(w.trim())) return { titulo: mo.question.replace(/^[¿¡\s]+|[?!.\s]+$/g, "") };
      return { titulo: w, lugar: w };
    }
    const s = sugerencias[m.id]?.plan;
    return s?.es_plan && s.titulo
      ? { titulo: s.titulo, fecha: s.fecha || undefined, hora: s.hora || undefined, tipo: s.tipo || undefined, lugar: s.lugar || undefined }
      : null;
  };
  const gastoFrom = (m: MensajeRow) => {
    const g = sugerencias[m.id]?.gasto;
    return g?.es_gasto && g.importe ? { titulo: g.concepto ?? "", importe: g.importe, pagador: m.sender_id } : null;
  };
  // In a plan's chat, any member adds to the plan; in a chat without a plan, «¿Dónde la guardo?».
  const canPlan = true;
  // A chat without a plan only makes plans (activities are talked about in the plan's chat), and a
  // message a plan was already made from loses its diamond for everyone («Plan creado» links to it).
  // The message a plan was made from is sealed for everyone: filled diamond, «En «X» · Abrir».
  const sellados = new Map<number, { plan: PlanCreatedMoment; hitoId: number }>();
  for (const x of messages) {
    const mo = parseMoment(x.texto);
    if (mo?.type === "plan_creado" && mo.origen_mensaje_id) sellados.set(mo.origen_mensaje_id, { plan: mo, hitoId: x.id });
  }
  // What was already added to the plan from a message (its «hito_plan» mark): never twice.
  const anadidos = new Map<number, PlanMarkMoment>();
  for (const x of messages) {
    const mo = parseMoment(x.texto);
    if (mo?.type === "hito_plan" && mo.origen_id) anadidos.set(mo.origen_id, mo);
  }
  const puedePlan = (m: MensajeRow) => canPlan && !sellados.has(m.id) && !anadidos.has(m.id);
  // Who joined a plan after it was made is not in its mark: ask which plans you are in now.
  const misPlanes = useMisPlanIds(currentUserId, !planId && sellados.size > 0);
  const enSellado = (s: { plan: PlanCreatedMoment }) =>
    s.plan.miembros.some((x) => x.id === currentUserId) || Boolean(misPlanes?.has(s.plan.plan_id));
  /** A sealed diamond: its plan (members) or its «Plan creado» mark, where «Pedir unirme» is. */
  const abrirSellado = (s: { plan: PlanCreatedMoment; hitoId: number }) => {
    closeOverlays();
    if (enSellado(s)) { router.push(`/plans/${s.plan.plan_id}`); return; }
    document.getElementById(`msg-${s.hitoId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };
  const selladoLabel = (s: { plan: PlanCreatedMoment }) =>
    `En «${s.plan.titulo}» · ${enSellado(s) ? "Abrir" : "Pedir unirme"}`;
  const goAddToPlan = (targetPlanId: number, p: { titulo: string } & PlanPrefill) => {
    const q = new URLSearchParams({ tab: "itinerario", nuevaActividad: p.titulo.trim().slice(0, 80) });
    if (p.fecha) q.set("fecha", p.fecha);
    if (p.hora) q.set("hora", p.hora);
    if (p.tipo) q.set("tipo", p.tipo);
    if (p.lugar) q.set("lugar", p.lugar);
    if (p.lat != null && p.lng != null) { q.set("lat", String(p.lat)); q.set("lng", String(p.lng)); }
    router.push(`/plans/${targetPlanId}?${q.toString()}`);
  };
  /**
   * The diamond. In a chat without a plan, what @frimee marks is a trip being proposed: it opens
   * «Crear plan» filled from the message (board m-grupo-plan: new plan first, an existing one below).
   */
  const addToPlan = (m: MensajeRow, anchor: { x: number; y: number } | null = null) => {
    if (!planId) {
      closeOverlays();
      const p = planFrom(m);
      // A poll's question + winner is read by @frimee; what is filled now is only a fallback.
      const leerOrigen = parseMoment(m.texto)?.type === "poll";
      setCreatePlan({ guarda: null, msg: m, anchor, leerOrigen, inicial: p ? { titulo: p.titulo, fecha: p.fecha, lugar: p.lugar } : null });
      return;
    }
    openAddPanel(m, anchor);
  };
  /** Opens the «Añadir al plan» panel (it fills in with what @frimee read, or waits for it). */
  const openAddPanel = (m: MensajeRow, anchor: { x: number; y: number } | null = null) => {
    closeOverlays();
    // A shared place or plan card is already exact; a text or a decided poll is read again with its
    // conversation (a poll's date or place is often in the question or the messages around it).
    const mo = parseMoment(m.texto);
    const conContexto = mo?.type !== "lugar" && mo?.type !== "tarjeta";
    setAddPanel({ msg: m, anchor, clientId: crypto.randomUUID(), ctx: conContexto ? { status: "loading" } : null });
    if (!conContexto) return;
    const settle = (ctx: { status: "done"; plan: PlanCompletado | null } | { status: "failed" }) =>
      setAddPanel((p) => (p && p.msg.id === m.id && p.ctx?.status === "loading" ? { ...p, ctx } : p));
    // Never keep the panel waiting: after 8 s it opens with what was read from the message alone.
    const timer = setTimeout(() => settle({ status: "failed" }), 8000);
    completarSugerenciaEndpoint(chat.chat_id, m.id)
      .then((plan) => settle({ status: "done", plan }))
      .catch((e) => { console.error("[chat] completar sugerencia:", e); settle({ status: "failed" }); })
      .finally(() => clearTimeout(timer));
  };
  const barAnchor = (e: React.MouseEvent<HTMLElement>) => {
    const r = (e.currentTarget.closest<HTMLElement>("[role=toolbar]") ?? e.currentTarget).getBoundingClientRect();
    return { x: r.right, y: r.top };
  };
  const registerExpense = (m: MensajeRow) => {
    const g = gastoFrom(m);
    if (!planId || !g) return;
    closeOverlays();
    setExpensePrefill(g);
    setAttachSheet("gasto");
  };

  /** Double tap (board s-sistema · Gestos): react with the last emoji used; again removes it. */
  const reactWithLast = (msgId: number) => {
    let emoji = "❤️";
    try { emoji = localStorage.getItem(LAST_REACTION_KEY) || emoji; } catch { /* storage blocked */ }
    reactTo(msgId, myReactionOf(msgId) === emoji ? "" : emoji);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
  };

  const togglePin = (msgId: number) => {
    const next = pinnedId === msgId ? null : msgId;
    const prev = pinnedId;
    setPinnedId(next);
    void pinMensajeEndpoint(chat.chat_id, next)
      .then(() => channelRef.current?.send({ type: "broadcast", event: "pin_changed", payload: { mensaje_id: next } }))
      .catch((e) => { setPinnedId(prev); logError("Error fijando mensaje", e); });
  };

  const toggleStar = (msgId: number) => {
    const flip = (set: Set<number>) => { const n = new Set(set); if (n.has(msgId)) n.delete(msgId); else n.add(msgId); return n; };
    const adding = !starredIds.has(msgId);
    setStarredIds(flip);
    // chat-20: starring says where they go, so it does not look like nothing happened.
    if (adding) { setAddedToast(null); setStarToast(true); } else setStarToast(false);
    void destacarMensajeEndpoint(msgId)
      .then(() => loadChatInfo())
      .catch((e) => { setStarredIds(flip); setStarToast(false); logError("Error destacando mensaje", e); });
  };

  /** Sends a moment (place, card, expense) as one of my messages; throws so the sheet can say so. */
  const sendMoment = async (moment: Moment) => {
    const texto = JSON.stringify(moment);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId, _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto });
      const realMsg: LocalMsg = { ...tempMsg, id: newId };
      sentMsgIdsRef.current.add(newId);
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      throw e;
    }
  };

  /** Shows a message the server created for me (same as a sent one: local, broadcast, list). */
  const showMyServerMessage = (id: number, texto: string, scroll = true) => {
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const msg: LocalMsg = { id, _key: id, sender_id: currentUserId, sender_nombre: me?.nombre ?? "", sender_profile_image: me?.profile_image ?? null, texto, created_at: new Date().toISOString() };
    sentMsgIdsRef.current.add(id);
    void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: msg });
    setMessages((prev) => (prev.some((m) => m.id === id) ? prev : [...prev, msg]));
    onNewMessageRef.current(msg);
    if (scroll) requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  /** An expense and its card, in one transaction (never one without the other, never twice). */
  const registerChatExpense = async (input: { clientId: string; planId: number; titulo: string; total: number; pagadoPor: string; participantes: string[]; texto?: string }) => {
    const r = await registrarGastoChatEndpoint({ ...input, chatId: chat.chat_id });
    showMyServerMessage(r.mensaje_id, r.texto);
  };

  // ── @frimee proposals: the plan changes only when someone accepts ──
  /** tarea and actividad create plan items, which only admins may do (checked again in the DB). */
  const proposalNeedsAdmin = (p: ProposalMoment) => p.kind === "tarea" || p.kind === "actividad";

  const replaceMsgTexto = (id: number, texto: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, texto } : m)));
    void channelRef.current?.send({ type: "broadcast", event: "edit_message", payload: { id, texto } });
  };

  /** What the line «Lucía añadió …» adds after the name: day and time of the activity. */
  const proposalResult = (p: ProposalMoment): string | null => {
    const pl = p.payload ?? {};
    if (p.kind === "actividad" && typeof pl.inicio === "string") {
      const d = new Date(pl.inicio);
      const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
      if (planInfo) {
        const start = new Date(planInfo.inicio_at);
        const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
        const day = Math.round((dayStart(d) - dayStart(start)) / 86_400_000) + 1;
        if (day >= 1) return `Día ${day}, ${time}`;
      }
      return `${d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })}, ${time}`;
    }
    return null;
  };

  const resolveProposal = async (msg: MensajeRow, p: ProposalMoment, accept: boolean) => {
    const meName = (chat.miembros.find((m) => m.id === currentUserId)?.nombre ?? "").split(" ")[0] || "Alguien";
    const resultado = accept ? proposalResult(p) : null;
    if (accept) {
      // Accept and do it in one transaction (fn_propuesta_aceptar): if anything fails, it stays pending.
      try {
        const r = await aceptarPropuestaEndpoint(msg.id, resultado);
        replaceMsgTexto(msg.id, r.texto);
        if (r.claimed && r.poll_id && r.poll_texto) showMyServerMessage(r.poll_id, r.poll_texto);
      } catch (e) {
        logError("Error aplicando propuesta", e);
        const local: LocalMsg = { id: -Date.now(), _key: -Date.now(), sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "No pude aplicarlo al plan. Inténtalo de nuevo.", created_at: new Date().toISOString(), tipo: "bot" };
        setMessages((prev) => [...prev, local]);
      }
      return;
    }
    let claimed: boolean;
    try {
      claimed = await resolverPropuestaEndpoint(msg.id, "descartada");
    } catch (e) {
      logError("Error resolviendo propuesta", e);
      return;
    }
    if (!claimed) {
      // Someone got there first: show what they did.
      const fresh = await listMensajes({ chatId: chat.chat_id, limit: 50 }).catch(() => null);
      const updated = fresh?.find((m) => m.id === msg.id);
      if (updated) setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, texto: updated.texto } : m)));
      return;
    }
    const resolved: ProposalMoment = { ...p, estado: "descartada", resuelta_por: currentUserId, resuelta_por_nombre: meName, resuelta_at: new Date().toISOString(), resultado: null };
    replaceMsgTexto(msg.id, JSON.stringify(resolved));
  };

  /**
   * Turns a plan-changing command of @frimee into a proposal, parsed now so that accepting runs
   * exactly what the group saw. Returns a text instead when the command cannot be understood.
   */
  const buildProposal = async (cmd: string, reply: string): Promise<ProposalMoment | string> => {
    const name = cmd.slice(1).trim().split(/\s+/)[0]?.toLowerCase();
    const base = { type: "propuesta" as const, reply, command: cmd, estado: "pendiente" as const };
    const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
    const first = (n: string) => n.split(" ")[0] || n;
    const fallback = reply || "No lo he entendido bien. ¿Me lo dices de otra forma?";

    if (name === "gasto") {
      // handleCommand validates and parses it (payer, amount, people) into pendingGastoRef.
      pendingGastoRef.current = null;
      const check = await handleCommand(cmd);
      const g = pendingGastoRef.current as PendingGasto | null;
      pendingGastoRef.current = null;
      if (!g) return reply ? `${reply}\n\n${check}` : check;
      const n = g.participantes.length;
      return {
        ...base, kind: "gasto",
        titulo: `${cap(g.titulo)} · ${formatEuros(g.total)}`,
        detalle: `Pagó ${first(g.pagadoPorNombre)} · ${n > 1 ? `a partes iguales entre ${n} · ${formatEuros(g.total / n)} cada uno` : "para una persona"}`,
        payload: { titulo: cap(g.titulo), total: g.total, pagado_por_id: g.pagadoPorId, participantes: g.participantes.map((x) => x.user_id) },
      };
    }

    if (name === "tarea") {
      const tokens = cmd.slice(1).trim().split(/\s+/).slice(1);
      const mentionIdx = tokens.findIndex((t) => t.startsWith("@"));
      const categoria = tokens.find((t) => (CATEGORIAS_VALIDAS as readonly string[]).includes(t.toLowerCase()))?.toLowerCase() ?? "otro";
      const miembro = mentionIdx === -1 ? undefined
        : chat.miembros.find((m) => m.nombre.toLowerCase().startsWith(tokens[mentionIdx].slice(1).toLowerCase()));
      const titulo = tokens.filter((t, i) => i !== mentionIdx && t.toLowerCase() !== categoria).join(" ").trim();
      if (!miembro || !titulo) return fallback;
      return {
        ...base, kind: "tarea", titulo: cap(titulo), detalle: `Para ${first(miembro.nombre)} · ${categoria}`,
        payload: { titulo: cap(titulo), asignado_id: miembro.id, categoria },
      };
    }

    if (name === "actividad") {
      const [titulo, when, lugar, detalle] = cmd.slice("/actividad".length).split("|").map((x) => x.trim());
      // «2026-11-29T10:00» without a zone reads as local time, which is what @frimee means.
      const start = when ? new Date(when) : null;
      if (!titulo || !start || Number.isNaN(start.getTime())) return fallback;
      const day = start.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" });
      const time = start.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
      return {
        ...base, kind: "actividad", titulo: cap(titulo),
        detalle: [`${day}, ${time}`, lugar, detalle].filter(Boolean).join(" · "),
        payload: { titulo: cap(titulo), inicio: start.toISOString(), lugar: lugar ?? "", detalle: detalle ?? "" },
      };
    }
    return fallback;
  };

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setHighlightedId(msgId);
    setTimeout(() => setHighlightedId(null), 2000);
  };

  // Opened from a search result: once the first page is in, go to that message (loading its
  // stretch if it is older than what came in). After the open-at-the-bottom scroll.
  const jumpToMessageRef = useRef<(id: number) => void>(() => {});
  jumpToMessageRef.current = (id: number) => {
    if (document.getElementById(`msg-${id}`)) scrollToMessage(id);
    else void revealMessageRef.current(id);
  };
  const revealMessageRef = useRef<(id: number) => Promise<void>>(async () => {});
  const initialJumpDoneRef = useRef(false);
  useEffect(() => {
    if (!initialMessageId || loading || initialJumpDoneRef.current) return;
    initialJumpDoneRef.current = true;
    const t = setTimeout(() => jumpToMessageRef.current(initialMessageId), 150);
    return () => clearTimeout(t);
  }, [initialMessageId, loading]);
  const cancelEdit = () => { setEditingMsg(null); setText(""); };
  const cancelReply = () => setReplyingTo(null);

  const getFreshMembers = async (): Promise<typeof chat.miembros> => {
    try {
      const fresh = await getChatMiembros(chat.chat_id);
      return fresh.map((m) => ({ id: m.id, nombre: m.nombre, username: m.username, profile_image: m.profile_image }));
    } catch {
      return chat.miembros;
    }
  };

  const CATEGORIAS_VALIDAS = VALID_TASK_CATEGORIES;

  const isPlanFinished = planInfo?.fin_at ? planFinished(planInfo.fin_at) : false;

  const fmtEstado = (e: string) =>
    ({ hecho: "Hecho", pendiente: "Pendiente", en_progreso: "En progreso" }[e] ?? e);

  const WRITE_COMMANDS = PLAN_WRITE_COMMANDS;

  /** A new poll from me (/votar, «Repetir la encuesta»). False if it could not be sent. */
  const sendPollMessage = async (question: string, options: string[], expiresAt?: string): Promise<boolean> => {
    const texto = JSON.stringify({ type: "poll", question, options, expires_at: expiresAt });
    const me = chat.miembros.find((m) => m.id === currentUserId);
    // Not -Date.now(): the /votar line written just before uses that same millisecond as its key.
    const tempId = -Date.now() - 7;
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto });
      const realMsg: MensajeRow = { ...tempMsg, id: newId };
      sentMsgIdsRef.current.add(newId);
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      return true;
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return false;
    }
  };

  /** What closing or deciding a poll leaves: its new texto, and the hidden «poll_cerrada» for the list. */
  const applyPollCierre = (pollId: number, r: Partial<PollCierre>) => {
    if (r.poll_texto) replaceMsgTexto(pollId, r.poll_texto);
    if (r.aviso_id && r.aviso_texto) showMyServerMessage(r.aviso_id, r.aviso_texto, false);
  };

  const handleCommand = async (cmd: string): Promise<string> => {
    const parts = cmd.slice(1).trim().split(/\s+/);
    const name = parts[0]?.toLowerCase();

    if (isPlanFinished && WRITE_COMMANDS.has(name)) {
      return "Este plan ya ha finalizado, no se pueden crear ni modificar elementos.";
    }

    if (name === "info") {
      if (!planInfo) return "Este comando solo está disponible en el chat de un plan.";
      const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
      };
      const miembros = chat.miembros.map((m) => m.nombre).join(", ");
      return [
        planInfo.titulo,
        `Fechas: ${formatDate(planInfo.inicio_at)} – ${formatDate(planInfo.fin_at)}`,
        `Destino: ${planInfo.ubicacion_nombre}`,
        `Miembros (${chat.miembros.length}): ${miembros}`,
      ].join("\n");
    }

    if (name === "tarea") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      if (!isAdmin) return "Solo el admin puede crear tareas.";

      const tokens = parts.slice(1);
      const mentionIdx = tokens.findIndex((t) => t.startsWith("@"));
      const categoriaToken = tokens.find((t) => (CATEGORIAS_VALIDAS as readonly string[]).includes(t.toLowerCase()));

      if (mentionIdx === -1) return "Indica a quién asignar la tarea. Ej: /tarea comprar billetes @usuario vuelo";
      if (!categoriaToken) return `Indica la categoría. Categorías: ${CATEGORIAS_VALIDAS.join(", ")}`;

      const mentionName = tokens[mentionIdx].slice(1).toLowerCase();
      const miembro = chat.miembros.find((m) => m.nombre.toLowerCase().startsWith(mentionName));
      if (!miembro) return `${tokens[mentionIdx]} no está en este plan.`;

      const titulo = tokens
        .filter((_, i) => i !== mentionIdx && tokens[i] !== categoriaToken)
        .join(" ")
        .trim();
      if (!titulo) return "Indica el título de la tarea. Ej: /tarea comprar billetes @usuario vuelo";

      try {
        await crearTareaEndpoint({ planId, titulo, asignadoUserId: miembro.id, categoria: categoriaToken.toLowerCase() });
        return `Tarea creada: ${titulo} → @${miembro.nombre} [${categoriaToken.toLowerCase()}]`;
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? "";
        if (msg.includes("not_admin")) return "Solo el admin puede crear tareas.";
        if (msg.includes("not_member")) return "Ese usuario no está en este plan.";
        return "No pude crear la tarea, inténtalo de nuevo.";
      }
    }

    if (name === "tareas") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      const todas = parts[1]?.toLowerCase() === "todas";
      try {
        if (todas) {
          const tareas = await todasTareasEndpoint(planId);
          if (tareas.length === 0) return "No hay tareas en este plan todavía.";
          return "Tareas del plan:\n" + tareas.map((t) => `• ${t.titulo} → @${t.asignado_nombre} [${fmtEstado(t.estado)}]`).join("\n");
        } else {
          const tareas = await misTareasEndpoint(planId);
          if (tareas.length === 0) return "No tienes tareas en este plan.";
          pendingTaskListRef.current = tareas;
          return "Tus tareas:\n" + tareas.map((t, i) => `${i + 1}. ${t.titulo} [${fmtEstado(t.estado)}]`).join("\n");
        }
      } catch {
        return "No pude obtener las tareas, inténtalo de nuevo.";
      }
    }

    if (name === "hecho" || name === "pendiente" || name === "en_progreso") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      const estadoMap: Record<string, string> = { hecho: "hecho", pendiente: "pendiente", en_progreso: "en_progreso" };
      const nuevoEstado = estadoMap[name];
      const numStr = parts[1];

      if (!numStr) {
        try {
          const tareas = await misTareasEndpoint(planId);
          if (tareas.length === 0) return "No tienes tareas en este plan.";
          pendingTaskListRef.current = tareas;
          return `Tus tareas:\n${tareas.map((t, i) => `${i + 1}. ${t.titulo} [${fmtEstado(t.estado)}]`).join("\n")}\nResponde con /${name} 1, /${name} 2...`;
        } catch {
          return "No pude obtener las tareas, inténtalo de nuevo.";
        }
      }

      const num = parseInt(numStr, 10);
      const lista = pendingTaskListRef.current;
      if (isNaN(num) || num < 1 || num > lista.length) {
        return lista.length > 0
          ? lista.length === 1
            ? `Numero invalido. Usa /${name} 1`
            : `Numero invalido. Usa /${name} 1 – /${name} ${lista.length}`
          : `Usa primero /${name} sin numero para ver tu lista de tareas.`;
      }

      const tarea = lista[num - 1];
      if (tarea.estado === nuevoEstado) return `Esa tarea ya estaba en estado "${nuevoEstado}".`;

      try {
        await updateEstadoTareaEndpoint(tarea.id, nuevoEstado);
        pendingTaskListRef.current = lista.map((t, i) => i === num - 1 ? { ...t, estado: nuevoEstado } : t);
        return `Tarea actualizada: ${tarea.titulo} → ${nuevoEstado}`;
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? "";
        if (msg.includes("not_authorized")) return "Solo el asignado o el admin puede cambiar el estado de esta tarea.";
        return "No pude actualizar la tarea, inténtalo de nuevo.";
      }
    }

    if (name === "saldo") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      try {
        const balances = await getBalancesForPlanEndpoint(planId);
        if (balances.length === 0) return "No hay gastos registrados en este plan.";

        const meDeben = balances.filter((b) => b.to_user_id === currentUserId);
        const debo = balances.filter((b) => b.from_user_id === currentUserId);

        if (meDeben.length === 0 && debo.length === 0) return "No tienes deudas pendientes en este plan.";

        const lines: string[] = ["Tu saldo:"];
        for (const b of meDeben) lines.push(`  ${b.from_nombre ?? "Alguien"} te debe ${formatEuros(b.importe)}`);
        for (const b of debo) lines.push(`  Debes ${formatEuros(b.importe)} a ${b.to_nombre ?? "Alguien"}`);

        const total = meDeben.reduce((s, b) => s + b.importe, 0) - debo.reduce((s, b) => s + b.importe, 0);
        lines.push(`  Balance total: ${total >= 0 ? "+" : ""}${formatEuros(total)}`);
        return lines.join("\n");
      } catch {
        return "No pude obtener tu saldo, inténtalo de nuevo.";
      }
    }

    if (name === "presupuesto") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      try {
        const { grupo } = await fetchTopesEndpoint(planId);
        const arg = parts.slice(1).join(" ").trim();

        // «/presupuesto»: cómo va el presupuesto del grupo.
        if (!arg) {
          if (!grupo) return "Este plan aún no tiene presupuesto. Quien administra el plan lo pone con /presupuesto 2000.";
          const gastos = await listGastosForPlanEndpoint(planId);
          const spent = gastos.filter((g) => g.estado === "CONFIRMADO").reduce((sum, g) => sum + Number(g.total), 0);
          const pct = Math.round((spent / grupo.limite) * 100);
          return spent > grupo.limite
            ? `Presupuesto del grupo: ${formatEuros(grupo.limite)}. Lleváis ${formatEuros(spent)} (${pct} %): os habéis pasado ${formatEuros(spent - grupo.limite)}.`
            : `Presupuesto del grupo: ${formatEuros(grupo.limite)}. Lleváis ${formatEuros(spent)} (${pct} %): quedan ${formatEuros(grupo.limite - spent)}.`;
        }

        // «/presupuesto 2000» o «/presupuesto quitar»: solo quien administra el plan.
        const quitar = /^(quitar|borrar|ninguno)$/i.test(arg);
        const amount = quitar ? null : parseAmount(arg);
        if (!quitar && (amount === null || amount <= 0)) return "Indica un importe válido. Ej: /presupuesto 2000";
        await setPresupuestoEndpoint(planId, amount, grupo?.moneda ?? "EUR");
        return amount === null ? "Presupuesto quitado." : `Presupuesto del grupo: ${formatEuros(amount)}.`;
      } catch (e) {
        const msg = (e as { message?: string })?.message ?? "";
        if (msg.includes("administra el plan")) return "El presupuesto del grupo lo pone quien administra el plan.";
        return "No pude con el presupuesto, inténtalo de nuevo.";
      }
    }

    if (name === "deudas") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      try {
        const balances = await getBalancesForPlanEndpoint(planId);
        if (balances.length === 0) return "No hay deudas pendientes en este plan.";
        const lines = ["Deudas del plan:", ...balances.map((b) => `  ${b.from_nombre ?? "?"} → ${b.to_nombre ?? "?"}: ${formatEuros(b.importe)}`)];
        return lines.join("\n");
      } catch {
        return "No pude obtener las deudas, inténtalo de nuevo.";
      }
    }

    if (name === "gasto") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      const tokens = parts.slice(1);
      const mentions = tokens.filter((t) => t.startsWith("@"));
      const amountToken = tokens.find((t) => /^\d+([.,]\d+)?€?$/.test(t));

      if (!amountToken) return "Indica el importe. Ej: /gasto vuelos 420€";
      const total = parseFloat(amountToken.replace("€", "").replace(",", "."));
      if (isNaN(total) || total <= 0) return "El importe debe ser un número válido.";

      const concepto = tokens
        .filter((t) => t !== amountToken && !t.startsWith("@"))
        .join(" ")
        .trim();
      if (!concepto) return "Indica el concepto. Ej: /gasto vuelos 420€";

      const me = chat.miembros.find((m) => m.id === currentUserId);

      let pagador: { user_id: string; nombre: string };
      let participantes: { user_id: string; nombre: string }[];

      if (mentions.length === 0) {
        pagador = { user_id: currentUserId, nombre: me?.nombre ?? "Tú" };
        participantes = chat.miembros.map((m) => ({ user_id: m.id, nombre: m.nombre }));
      } else {
        const resolveM = (mention: string) => {
          const n = mention.slice(1).toLowerCase();
          return (
            chat.miembros.find((m) => m.nombre.toLowerCase() === n) ??
            chat.miembros.find((m) => m.nombre.toLowerCase().split(" ")[0] === n) ??
            chat.miembros.find((m) => m.nombre.toLowerCase().startsWith(n))
          );
        };
        const pagadorMiembro = resolveM(mentions[0]);
        if (!pagadorMiembro) return `${mentions[0]} no está en este plan.`;
        pagador = { user_id: pagadorMiembro.id, nombre: pagadorMiembro.nombre };

        if (mentions.length === 1) {
          participantes = chat.miembros.map((m) => ({ user_id: m.id, nombre: m.nombre }));
        } else {
          const resueltos = mentions.map(resolveM);
          const invalido = mentions.find((_, i) => !resueltos[i]);
          if (invalido) return `${invalido} no está en este plan.`;
          participantes = resueltos.map((m) => ({ user_id: m!.id, nombre: m!.nombre }));
        }
      }

      const nombresParticipantes = participantes.map((p) => p.nombre).join(", ");

      pendingGastoRef.current = { clientId: crypto.randomUUID(), planId, titulo: concepto, total, pagadoPorId: pagador.user_id, pagadoPorNombre: pagador.nombre, participantes };

      return [
        `Confirmar gasto:`,
        `${concepto.charAt(0).toUpperCase() + concepto.slice(1)} · ${formatEuros(total)}`,
        `Pago: ${pagador.nombre}`,
        `Divide entre: ${nombresParticipantes} (${formatEuros(total / participantes.length)} cada uno)`,
        ``,
        `Responde "s" para confirmar o "n" para cancelar`,
      ].join("\n");
    }

    if (name === "ayuda") {
      const esPlan = Boolean(planInfo);
      const lines = [
        "/info — detalles del plan",
        "/ayuda — lista de comandos",
      ];
      if (esPlan) {
        lines.push(
          "/tareas — tus tareas pendientes",
          "/tareas todas — todas las tareas del plan",
          "/hecho [n] · /pendiente [n] · /en_progreso [n] — cambiar estado de tarea",
          "/saldo — tu balance en el plan",
          "/deudas — todas las deudas del plan",
          "/votar [pregunta] [op1] [op2]... — crear una votación",
          "/voto [n] — votar en la encuesta activa",
          "/cerrar [n] — cerrar una votación activa",
          "/salir — abandonar el plan",
        );
        if (isAdmin) {
          lines.push(
            "/tarea [título] @usuario [categoría] — crear una tarea",
            "/gasto [concepto] [importe]€ — registrar un gasto equitativo",
            "/pagar @usuario [importe]€ — registrar un pago",
            "/presupuesto — ver o establecer el presupuesto",
            "/recordar @usuario — recordar deudas o tareas pendientes",
            "/admin @usuario — promover a admin",
            "/deadmin @usuario — quitar rol de admin",
            "/expulsar @usuario — expulsar a un miembro",
          );
        }
      }
      return lines.join("\n");
    }

    if (name === "votar") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      const rawText = cmd.slice("/votar".length + 1).trim();
      const qIdx = rawText.indexOf("?");
      if (qIdx === -1) return "Indica la pregunta y al menos dos opciones. Ej: /votar ¿Vamos al Coliseo? Sí No";

      const question = rawText.slice(0, qIdx + 1).trim();
      // Soporta opciones entre comillas: "Restaurante de pescaito" "Chiringuito de playa"
      const restRaw = rawText.slice(qIdx + 1).trim();
      const quotedParts = [...restRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      const restParts = quotedParts.length >= 2 ? quotedParts : restRaw.split(/\s+/).filter(Boolean);

      const lastPart = restParts[restParts.length - 1] ?? "";
      let expiresAt: string | undefined;
      if (/^\d/.test(lastPart)) {
        const validTime = /^(\d+)([hd])$/.exec(lastPart);
        if (!validTime) return "Formato de tiempo no válido. Usa h para horas o d para días. Ej: 24h, 3d";
        const [, num, unit] = validTime;
        expiresAt = new Date(Date.now() + parseInt(num) * (unit === "h" ? 3_600_000 : 86_400_000)).toISOString();
        restParts.pop();
      }

      // Written by the app: «Sí» with its accent, however it was typed.
      const options = restParts.map((o) => (/^s[ií]$/i.test(o) ? "Sí" : /^no$/i.test(o) ? "No" : o));
      if (options.length < 2) return "Indica al menos dos opciones. Ej: /votar ¿Vamos al Coliseo? Sí No";

      if (!(await sendPollMessage(question, options, expiresAt))) return "No pude crear la votación, inténtalo de nuevo.";
      return "";
    }

    if (name === "voto") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      const token = parts[1] ?? "";

      const activePolls = messages
        .filter((m) => m.texto && isPollMessage(m.texto) && m.id > 0)
        .map((m) => ({ msg: m, poll: JSON.parse(m.texto) as { question: string; options: string[]; expires_at?: string; closed?: boolean } }))
        .filter(({ poll }) => !poll.closed && (!poll.expires_at || new Date(poll.expires_at) >= new Date()));

      if (activePolls.length === 0) return "No hay ninguna votación activa en este plan.";

      // Varias activas sin especificar encuesta → listar
      if (activePolls.length > 1 && !token.includes("-")) {
        const lines = ["Hay varias votaciones activas. Usa /voto [encuesta]-[opción]:"];
        activePolls.forEach(({ poll }, i) => {
          lines.push(`  ${i + 1}. ${poll.question} (${poll.options.map((o, j) => `${j + 1}=${o}`).join(", ")})`);
        });
        lines.push(`Ej: /voto 1-1 vota la opción 1 de la encuesta 1`);
        return lines.join("\n");
      }

      let pollIndex = 0;
      let optionNum: number;

      if (token.includes("-")) {
        const [pStr, oStr] = token.split("-");
        pollIndex = parseInt(pStr ?? "") - 1;
        optionNum = parseInt(oStr ?? "");
      } else {
        optionNum = parseInt(token);
      }

      if (isNaN(pollIndex) || pollIndex < 0 || pollIndex >= activePolls.length)
        return `Encuesta no válida. Usa un número entre 1 y ${activePolls.length}.`;

      const { msg: pollMsg, poll } = activePolls[pollIndex];

      if (isNaN(optionNum) || optionNum < 1)
        return `Indica el número de opción. Ej: /voto ${activePolls.length > 1 ? `${pollIndex + 1}-` : ""}1`;

      const optionIdx = optionNum - 1;
      if (optionIdx >= poll.options.length)
        return `Opción no válida. Usa /voto ${activePolls.length > 1 ? `${pollIndex + 1}-` : ""}1 – /voto ${activePolls.length > 1 ? `${pollIndex + 1}-` : ""}${poll.options.length}`;

      try {
        const r = await pollVote(pollMsg.id, optionIdx);
        if (r.cerrada) applyPollCierre(pollMsg.id, r);
        emitPollVote(pollMsg.id);
        void channelRef.current?.send({ type: "broadcast", event: "poll_vote", payload: { mensaje_id: pollMsg.id, option_index: optionIdx } });
        return `Voto registrado: ${poll.options[optionIdx]}`;
      } catch {
        return "Ya has votado en esta encuesta o no se pudo registrar el voto.";
      }
    }

    if (name === "recordar") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      const mention = parts.slice(1).find((t) => t.startsWith("@"));
      if (!mention) return "Indica a quién recordar. Ej: /recordar @Sarah";

      const miembros = await getFreshMembers();
      const n = mention.slice(1).toLowerCase();
      const target =
        miembros.find((m) => m.nombre.toLowerCase() === n) ??
        miembros.find((m) => m.nombre.toLowerCase().split(" ")[0] === n) ??
        miembros.find((m) => m.nombre.toLowerCase().startsWith(n));
      if (!target) return `${mention} no está en este plan.`;
      if (target.id === currentUserId) return "No puedes enviarte un recordatorio a ti mismo.";

      try {
        const result = await recordarEndpoint({
          planId,
          fromUserId: currentUserId,
          toUserId: target.id,
        });
        if (result < 0) return `Ya enviaste un recordatorio a ${target.nombre} hoy. Quedan ${Math.abs(result)}h.`;
        if (result === 0) return `${target.nombre} no tiene deudas ni tareas pendientes.`;
        return `Recordatorio enviado a ${target.nombre}.`;
      } catch {
        return "No pude enviar el recordatorio, inténtalo de nuevo.";
      }
    }

    if (name === "admin") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      if (!isAdmin) return "Solo los admins pueden promover a otros admins.";

      const mention = parts.slice(1).find((t) => t.startsWith("@"));
      if (!mention) return "Indica a quién promover. Ej: /admin @usuario";

      const miembros = await getFreshMembers();
      const n = mention.slice(1).toLowerCase();
      const target =
        miembros.find((m) => m.nombre.toLowerCase() === n) ??
        miembros.find((m) => m.nombre.toLowerCase().split(" ")[0] === n) ??
        miembros.find((m) => m.nombre.toLowerCase().startsWith(n));
      if (!target) return `${mention} no está en este plan.`;
      if (target.id === currentUserId) return "Ya eres admin.";

      try {
        const result = await promoteToAdminEndpoint(planId, target.id);
        if (result === "not_admin") return "Solo los admins pueden promover a otros admins.";
        if (result === "target_not_member") return `${target.nombre} no está en este plan.`;
        if (result === "already_admin") return `${target.nombre} ya es admin.`;
        onMembersChanged?.();
        return `${target.nombre} ahora es admin del plan.`;
      } catch {
        return "No pude promover al usuario, inténtalo de nuevo.";
      }
    }

    if (name === "deadmin") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      if (!isAdmin) return "Solo los admins pueden quitar permisos de admin.";

      const mention = parts.slice(1).find((t) => t.startsWith("@"));
      if (!mention) return "Indica a quién quitar el rol de admin. Ej: /deadmin @usuario";

      const miembros = await getFreshMembers();
      const n = mention.slice(1).toLowerCase();
      const target =
        miembros.find((m) => m.nombre.toLowerCase() === n) ??
        miembros.find((m) => m.nombre.toLowerCase().split(" ")[0] === n) ??
        miembros.find((m) => m.nombre.toLowerCase().startsWith(n));
      if (!target) return `${mention} no está en este plan.`;
      if (target.id === currentUserId) return "No puedes quitarte el rol de admin a ti mismo.";

      try {
        const result = await demoteAdminEndpoint(planId, target.id);
        if (result === "not_admin") return "Solo los admins pueden quitar permisos de admin.";
        if (result === "cannot_demote_self") return "No puedes quitarte el rol de admin a ti mismo.";
        if (result === "cannot_demote_owner") return "No puedes quitar el rol de admin al creador del plan.";
        if (result === "target_not_member") return `${target.nombre} no está en este plan.`;
        if (result === "not_admin_target") return `${target.nombre} no es admin.`;
        onMembersChanged?.();
        return `${target.nombre} ya no es admin del plan.`;
      } catch {
        return "No pude quitar el rol de admin, inténtalo de nuevo.";
      }
    }

    if (name === "expulsar") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      if (!isAdmin) return "Solo los admins pueden expulsar miembros.";

      const mention = parts.slice(1).find((t) => t.startsWith("@"));
      if (!mention) return "Indica a quién expulsar. Ej: /expulsar @usuario";

      const miembros = await getFreshMembers();
      const n = mention.slice(1).toLowerCase();
      const target =
        miembros.find((m) => m.nombre.toLowerCase() === n) ??
        miembros.find((m) => m.nombre.toLowerCase().split(" ")[0] === n) ??
        miembros.find((m) => m.nombre.toLowerCase().startsWith(n));
      if (!target) return `${mention} no está en este plan.`;
      if (target.id === currentUserId) return "No puedes expulsarte a ti mismo. Usa /salir para abandonar el plan.";

      try {
        const { resultado: result, aviso } = await expulsarPlanEndpoint(planId, target.id);
        if (result === "not_admin") return "Solo los admins pueden expulsar miembros.";
        if (result === "cannot_kick_self") return "No puedes expulsarte a ti mismo.";
        if (result === "cannot_kick_owner") return "No puedes expulsar al creador del plan.";
        if (result === "target_not_member") return `${target.nombre} no está en este plan.`;
        if (aviso) showMyServerMessage(aviso.mensaje_id, aviso.texto);
        void channelRef.current?.send({ type: "broadcast", event: "kick_member", payload: { user_id: target.id } });
        onMembersChanged?.();
        // The notice already says it («Quitaste a Ana del plan»).
        return aviso ? "" : `${target.nombre} ha sido expulsado del plan.`;
      } catch {
        return "No pude expulsar al usuario, inténtalo de nuevo.";
      }
    }

    if (name === "salir") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      try {
        const { resultado: result, aviso } = await salirPlanEndpoint(planId);
        if (result === "not_member") return "No eres miembro de este plan.";
        if (result === "owner_cannot_leave") return "El creador del plan no puede abandonarlo.";
        if (result === "last_admin") return "Eres el único admin. Promueve a otro miembro con /admin @usuario antes de salir.";
        // The others see «Ana salió del plan» live; then out of a chat that is no longer mine
        // (Messages has no onLeave: back to the list).
        if (aviso) showMyServerMessage(aviso.mensaje_id, aviso.texto);
        (onLeave ?? onBack)?.();
        return "";
      } catch {
        return "No pude abandonar el plan, inténtalo de nuevo.";
      }
    }

    if (name === "cerrar") {
      const openPolls = messages
        .filter((m) => m.texto && isPollMessage(m.texto) && m.id > 0)
        .map((m) => ({ msg: m, poll: JSON.parse(m.texto) as PollData }))
        .filter(({ poll }) => !poll.copiada_at && pollState(poll) === "abierta");

      if (openPolls.length === 0) return "No hay ninguna encuesta abierta en este chat.";

      let targetPoll: typeof openPolls[0];
      if (openPolls.length === 1) {
        targetPoll = openPolls[0];
      } else {
        const numStr = parts[1];
        if (!numStr) {
          const lines = ["Hay varias encuestas abiertas. Indica cuál cerrar con /cerrar [n]:"];
          openPolls.forEach(({ poll }, i) => lines.push(`  ${i + 1}. ${poll.question}`));
          return lines.join("\n");
        }
        const num = parseInt(numStr, 10);
        if (isNaN(num) || num < 1 || num > openPolls.length)
          return `Indica un número entre 1 y ${openPolls.length}.`;
        targetPoll = openPolls[num - 1];
      }

      const { msg: pollMsg } = targetPoll;

      const isBotPoll = pollMsg.sender_id === "frimee" || pollMsg.sender_id === null;
      if (!isBotPoll && pollMsg.sender_id !== currentUserId && !iAmAdmin)
        return "Solo quien creó la encuesta o un admin puede cerrarla.";

      try {
        applyPollCierre(pollMsg.id, await closePoll(pollMsg.id));
        emitPollVote(pollMsg.id);
      } catch (err) {
        console.error("[cerrar] fn_poll_close:", (err as { message?: string })?.message ?? String(err));
        return "No se ha cerrado la encuesta. Inténtalo de nuevo.";
      }
      return "";
    }

    return "Comando no reconocido. Usa /ayuda para ver los disponibles.";
  };

  const isConfirm = (t: string) => /^(@frimee\s+)?(s[ií]?|yes|ok|dale|venga|crea(la)?|adelante)\b/i.test(t.trim());
  const isCancel  = (t: string) => /^(@frimee\s+)?(no?|cancelar?)\b/i.test(t.trim());

  // override: send this text instead of the input's (the @frimee suggestions use it).
  const onSend = async (override?: string) => {
    // Writing from an old stretch: back to the latest messages first.
    if (detachedRef.current) await goToLatest();
    const trimmed = (override ?? text).trim();
    if (!trimmed || sending) return;
    setSendError(null);
    setEphemeral(null);

    if (pendingGastoRef.current && (isConfirm(trimmed) || isCancel(trimmed))) {
      const pending = pendingGastoRef.current;
      pendingGastoRef.current = null;
      if (isCancel(trimmed)) {
        const botMsg: LocalMsg = { id: -Date.now(), _key: -Date.now(), sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "Gasto cancelado.", created_at: new Date().toISOString(), tipo: "bot" };
        setMessages((prev) => [...prev, botMsg]);
        setText("");
        return;
      }
      setText("");
      try {
        // The expense and the message in one transaction; the id is the pending one's.
        await registerChatExpense({
          clientId: pending.clientId,
          planId: pending.planId,
          titulo: pending.titulo,
          total: pending.total,
          pagadoPor: pending.pagadoPorId,
          participantes: pending.participantes.map((p) => p.user_id),
          // No text: the server writes the expense card ({"type":"gasto"}), not «Gasto registrado: …».
        });
      } catch {
        const botMsg: LocalMsg = { id: -Date.now(), _key: -Date.now(), sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "No pude registrar el gasto, inténtalo de nuevo.", created_at: new Date().toISOString(), tipo: "bot" };
        setMessages((prev) => [...prev, botMsg]);
      }
      return;
    }

    if (/\@frimee\b/i.test(trimmed) && !trimmed.startsWith("/")) {
      setText("");
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const now = Date.now();
      const thinkingKey = -(now + 1);
      const thinkingMsg: LocalMsg = {
        id: thinkingKey, _key: thinkingKey,
        sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null,
        texto: "…",
        // A moment after the question, so the timeline (sorted by time) keeps it below it.
        created_at: new Date(now + 1000).toISOString(),
        tipo: "bot",
      };

      // Build conversation history: last 6 messages between this user and Frimee
      const frimeeHistory: FrimeeHistoryEntry[] = messages
        .filter((m) => {
          if (!m.texto || m.texto === "…") return false;
          try { const p = JSON.parse(m.texto); if (p.type && p.type !== "propuesta") return false; } catch { /* not JSON */ }
          const isBot = m.sender_id === "frimee" || m.sender_id === null || m.tipo === "bot";
          return isBot || m.sender_id === currentUserId;
        })
        .slice(-6)
        .map((m) => ({
          role: m.sender_id === currentUserId ? "user" : "assistant",
          content: momentAsAssistantText(m.texto) ?? m.texto,
        }));

      // Mostrar mensaje del usuario al instante con ID temporal
      const tempUserKey = -now;
      const userMsgOptimistic: LocalMsg = {
        id: tempUserKey, _key: tempUserKey,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsgOptimistic, thinkingMsg]);

      // GPS y guardado en DB en paralelo, sin bloquear la UI
      const [userMsgId, userLocation] = await Promise.all([
        sendMensaje({ chatId: chat.chat_id, texto: trimmed }),
        typeof navigator !== "undefined" && navigator.geolocation
          ? new Promise<{ lat: number; lng: number } | undefined>((resolve) => {
              const timer = setTimeout(() => resolve(undefined), 3500);
              navigator.geolocation.getCurrentPosition(
                (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
                () => { clearTimeout(timer); resolve(undefined); },
                { maximumAge: 300_000, timeout: 3000 }
              );
            })
          : Promise.resolve(undefined),
      ]);

      const userMsg: LocalMsg = { ...userMsgOptimistic, id: userMsgId, _key: userMsgId };
      sentMsgIdsRef.current.add(userMsgId);
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: userMsg });
      setMessages((prev) => prev.map((m) => m.id === tempUserKey ? userMsg : m));
      onNewMessageRef.current(userMsg);

      try {
        const result = await callFrimeeAssistant({
          message: trimmed,
          members: chat.miembros.map((m) => ({ id: m.id, nombre: m.nombre })),
          planInfo: planInfo ? { titulo: planInfo.titulo, ubicacion_nombre: planInfo.ubicacion_nombre, inicio_at: planInfo.inicio_at, fin_at: planInfo.fin_at } : undefined,
          isAdmin,
          userId: currentUserId,
          planId: planId ?? undefined,
          history: frimeeHistory.length > 0 ? frimeeHistory : undefined,
          userLocation,
        });

        let replyText = result.reply;
        // Encuesta pedida explícitamente: se crea después de guardar la respuesta,
        // para que en el chat salga primero el mensaje de Frimee y debajo la encuesta.
        let pollToCreate: string | null = null;

        // Si la IA quiere crear una encuesta:
        // - Si el usuario la pidió explícitamente → crear directamente
        // - Si la IA la propone por su cuenta (ej: tras recomendaciones) → pedir confirmación
        const userAskedForPoll = /votar|encuesta|votaci[oó]n|vota(mos|d|r)|decidid|que vote/i.test(trimmed);

        if (result.command?.startsWith("/votar")) {
          const rawText = result.command.slice("/votar".length + 1).trim();
          const qIdx = rawText.indexOf("?");
          if (qIdx !== -1) {
            const question = rawText.slice(0, qIdx + 1).trim();
            const restRaw = rawText.slice(qIdx + 1).trim();
            const quotedParts = [...restRaw.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
            const options = quotedParts.length >= 2 ? quotedParts : restRaw.split(/\s+/).filter(Boolean);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            const pollTexto = JSON.stringify({ type: "poll", question, options, expires_at: expiresAt });

            if (userAskedForPoll) {
              // Crear directamente sin confirmación (justo después de la respuesta)
              pollToCreate = pollTexto;
            } else {
              // @frimee lo sugiere por su cuenta: queda como propuesta que cualquiera puede aceptar.
              const proposal: ProposalMoment = {
                type: "propuesta", kind: "encuesta", reply: replyText, titulo: question,
                detalle: options.join(" · "), command: result.command, estado: "pendiente",
                payload: { question, options },
              };
              replyText = JSON.stringify(proposal);
            }
          }
        } else if (result.command && !planId && /^\/(plan|actividad)\b/i.test(result.command)) {
          // ia-09: a chat without a plan makes plans, and anyone can: the create flow opens for
          // whoever asked, filled with what @frimee understood (nothing is created until they confirm).
          const [titulo, when, lugar] = result.command.replace(/^\/(plan|actividad)\s*/i, "").split("|").map((x) => x.trim());
          const fecha = /^\d{4}-\d{2}-\d{2}/.test(when ?? "") ? when.slice(0, 10) : undefined;
          closeOverlays();
          setCreatePlan({ guarda: null, inicial: { titulo: titulo || undefined, fecha, lugar: lugar || undefined } });
          replyText = "Te dejo el plan preparado: revisa los datos y créalo.";
        } else if (result.command && planId && !isAdmin && /^\/tarea\b/i.test(result.command)) {
          // ia-09: only the plan's admins create tasks (activities: any member): no card they
          // cannot accept, and no «ya está en el plan».
          const adminNames = chat.miembros
            .filter((m) => chatInfo?.admins.includes(m.id) && m.id !== currentUserId)
            .map((m) => m.nombre.split(" ")[0]);
          const que = "crear tareas";
          replyText = `Solo un admin del plan puede ${que}.${adminNames.length > 0 ? ` Pídeselo a ${adminNames.length > 1 ? `${adminNames.slice(0, -1).join(", ")} o ${adminNames[adminNames.length - 1]}` : adminNames[0]}.` : ""}`;
        } else if (result.command && /^\/(gasto|tarea|actividad)\b/i.test(result.command)) {
          const proposal = await buildProposal(result.command, replyText);
          // ia-09: the same proposal still pending (e.g. «perfecto, deja esta hora») → no second card.
          const repetida = typeof proposal !== "string" && messages.some((m) => {
            const mo = parseMoment(m.texto);
            return mo?.type === "propuesta" && mo.estado === "pendiente" && mo.kind === proposal.kind
              && mo.titulo.toLowerCase() === proposal.titulo.toLowerCase() && mo.detalle === proposal.detalle;
          });
          replyText = repetida
            ? "Ya está propuesta arriba: acéptala en la tarjeta para guardarla."
            : typeof proposal === "string" ? proposal : JSON.stringify(proposal);
        } else if (result.command) {
          const cmdResult = await handleCommand(result.command);
          if (cmdResult) replyText = cmdResult;

          // Si @Frimee votó en nombre del usuario → mensaje público visible para todos
          if (result.command.startsWith("/voto") && cmdResult?.startsWith("Voto registrado:")) {
            const opcion = cmdResult.replace("Voto registrado: ", "");
            const publicTexto = `@Frimee ha votado "${opcion}" en nombre de @${me?.nombre ?? "alguien"}`;
            const newId = await sendMensaje({ chatId: chat.chat_id, texto: publicTexto });
            const publicMsg: LocalMsg = { id: newId, _key: newId, sender_id: currentUserId, sender_nombre: me?.nombre ?? "", sender_profile_image: me?.profile_image ?? null, texto: publicTexto, created_at: new Date().toISOString() };
            void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: publicMsg });
            setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, publicMsg]);
            onNewMessageRef.current(publicMsg);
          }
        }

        // Primero el reply de la IA, luego (si aplica) la encuesta
        const botMsgId = await sendBotMensaje(chat.chat_id, replyText || "…");
        setMessages((prev) => prev.map((m) =>
          m.id === thinkingKey ? { ...m, id: botMsgId, _key: botMsgId, texto: replyText || "…" } : m
        ));
        // Live for the others too (it was only saved: they saw it after reloading).
        const botMsg: LocalMsg = { id: botMsgId, _key: botMsgId, sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: replyText || "…", created_at: new Date().toISOString(), tipo: "bot" };
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: botMsg });
        onNewMessageRef.current(botMsg);

        if (pollToCreate) {
          try {
            const newId = await sendBotMensaje(chat.chat_id, pollToCreate);
            const pollMsg: LocalMsg = { id: newId, _key: newId, sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: pollToCreate, created_at: new Date().toISOString(), tipo: "bot" };
            void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: pollMsg });
            setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, pollMsg]);
            onNewMessageRef.current(pollMsg);
          } catch {
            const errorId = await sendBotMensaje(chat.chat_id, "No pude crear la encuesta, inténtalo de nuevo.");
            const errorMsg: LocalMsg = { id: errorId, _key: errorId, sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "No pude crear la encuesta, inténtalo de nuevo.", created_at: new Date().toISOString(), tipo: "bot" };
            setMessages((prev) => prev.some((m) => m.id === errorId) ? prev : [...prev, errorMsg]);
            void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: errorMsg });
          }
        }
      } catch {
        setMessages((prev) => prev.map((m) =>
          m.id === thinkingKey ? { ...m, texto: "No pude procesar tu mensaje, inténtalo de nuevo." } : m
        ));
      }
      return;
    }

    // «/cerrar» is not a message (po-sistema): it runs and leaves the composer; if it cannot do
    // anything, the answer is only for you.
    if (/^\/cerrar\b/i.test(trimmed)) {
      setText("");
      const reply = await handleCommand(trimmed);
      if (reply) setEphemeral(reply);
      return;
    }

    if (trimmed.startsWith("/")) {
      setText("");
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const cmdKey = -Date.now();
      const userMsg: LocalMsg = {
        id: cmdKey,
        _key: cmdKey,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      const reply = await handleCommand(trimmed);
      if (reply) {
        const botMsg: LocalMsg = {
          id: cmdKey - 1,
          _key: cmdKey - 1,
          sender_id: "frimee",
          sender_nombre: "Frimee",
          sender_profile_image: null,
          texto: reply,
          created_at: new Date().toISOString(),
          tipo: "bot",
        };
        setMessages((prev) => [...prev, botMsg]);
      }
      return;
    }

    if (editingMsg) {
      setText("");
      setSending(true);
      try {
        await editMensaje(editingMsg.id, trimmed);
        setMessages((prev) => prev.map((m) => (m.id === editingMsg.id ? { ...m, texto: trimmed } : m)));
        void channelRef.current?.send({ type: "broadcast", event: "edit_message", payload: { id: editingMsg.id, texto: trimmed } });
        setEditingMsg(null);
      } catch (e) {
        console.error("[chat] Error editando:", (e as { message?: string })?.message ?? String(e));
        setText(trimmed);
        setSendError({ text: sendFail("no se ha guardado el cambio") });
      } finally {
        setSending(false);
      }
      return;
    }

    setText("");
    setSending(true);
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: trimmed, replyToId: replyingTo?.id ?? null });
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const newMsg: MensajeRow = {
        id: newId,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: trimmed,
        created_at: new Date().toISOString(),
        reply_to_id: replyingTo?.id ?? null,
        reply_texto: replyingTo?.texto ?? null,
        reply_sender_nombre: replyingTo?.sender_id === currentUserId ? "Tú" : (replyingTo?.sender_nombre ?? null),
      };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: newMsg });
      setMessages((prev) => {
        if (prev.some((m) => m.id === newId)) return prev;
        return [...prev, newMsg];
      });
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      onNewMessageRef.current(newMsg);
      setReplyingTo(null);
    } catch (e) {
      console.error("[chat] Error enviando:", (e as { message?: string })?.message ?? String(e));
      setText(trimmed);
      setSendError({ text: sendFail("no se ha enviado el mensaje"), retry: () => void onSend(trimmed) });
    } finally {
      setSending(false);
    }
  };

  /** Throws on failure: the delete sheet says it and stays open. */
  const handleDeleteMsg = async (msg: MensajeRow, paraTodos: boolean) => {
    await eliminarMensajeEndpoint(msg.id, paraTodos);
    if (paraTodos) {
      const texto = JSON.stringify({ type: "eliminado", por: msg.sender_id === currentUserId ? "autor" : "admin" });
      setMessages((prev) => prev.map((m) => (m.id !== msg.id ? m : { ...m, texto, audio_url: null, document_url: null, document_name: null, image_url: null, image_type: null, tipo: "text" })));
      setPinnedId((p) => (p === msg.id ? null : p));
      void channelRef.current?.send({ type: "broadcast", event: "delete_message", payload: { id: msg.id, texto } });
      onChatChanged?.();
    } else {
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    }
    loadChatInfo();
  };
  /** «Eliminar para todos»: my messages, or anyone's for a group's or plan's admin. Never a deleted one. */
  const canDeleteForAll = (m: MensajeRow) => m.id > 0 && parseMoment(m.texto)?.type !== "eliminado"
    && (m.sender_id === currentUserId
      || (chat.tipo === "GRUPO" && Boolean(chatInfo?.admins.includes(currentUserId)))
      || (chat.tipo === "PLAN" && Boolean(isAdmin)));
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.id < 0) return;
    const seen = lastSeenIdRef.current;
    lastSeenIdRef.current = Math.max(seen ?? 0, last.id);
    if (seen === null || last.id <= seen) return;
    const mo = parseMoment(last.texto);
    if (mo?.type !== "aviso") {
      // Something for «En el chat» (photo, video, file, place, link, decision): the counts and the
      // open list catch up without reloading (board gi-40).
      const content = Boolean(last.image_url || last.document_url) || mo?.type === "lugar" || mo?.type === "hito_plan"
        || mo?.type === "plan_creado" || mo?.type === "gasto" || (!mo && /https?:\/\//i.test(last.texto ?? ""));
      if (content) { loadChatInfo(); setInChatNewest(last.id); }
      return;
    }
    // The new name at once (header and list); the full list reload comes after.
    if (mo.clase === "renombrado" && mo.nombre) onRenamed?.(mo.nombre);
    loadChatInfo();
    onChatChanged?.();
    // Removed from the group by an admin: the chat is no longer mine.
    if (mo.clase === "quitado" && mo.user_id === currentUserId) onBack();
  }, [messages, loadChatInfo, onChatChanged, onRenamed, currentUserId, onBack]);
  // A deleted message has no actions but «Eliminar para mí»: any way of opening its menu opens that.
  useEffect(() => {
    if (contextMenu && parseMoment(contextMenu.msg.texto)?.type === "eliminado") {
      setDeleting(contextMenu.msg);
      setContextMenu(null);
    }
  }, [contextMenu]);

  const handleForward = async (targetChatId: string) => {
    if (!forwardMsg || forwardSending) return;
    setForwardSending(targetChatId);
    try {
      await sendMensaje({ chatId: targetChatId, texto: forwardMsg.texto });
      setForwardMsg(null);
    } catch (e) {
      console.error("[chat] Error reenviando:", e);
    } finally {
      setForwardSending(null);
    }
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.start(200);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      console.error("[chat] No se pudo acceder al micrófono");
    }
  };

  const handleCancelRecording = () => {
    setRecordHold(null);
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  /** Touch: hold to record. A mouse click (or the keyboard) keeps the old tap-to-start. */
  const onMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    micPointerTypeRef.current = e.pointerType;
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    const hold = { x: e.clientX, y: e.clientY, t0: Date.now(), released: false, locked: false, cancelled: false };
    setAudioError(null);
    setRecordHold({ dx: 0, locked: false });
    // On window: the mic button is replaced by the recording bar while the finger stays down.
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
    const onMove = (ev: PointerEvent) => {
      if (hold.locked || hold.cancelled) return;
      const dx = ev.clientX - hold.x;
      const dy = ev.clientY - hold.y;
      if (dx < -80) {
        hold.cancelled = true;
        stop();
        handleCancelRecording();
        if (navigator.vibrate) navigator.vibrate(20);
      } else if (dy < -60) {
        hold.locked = true;
        stop();
        setRecordHold({ dx: 0, locked: true });
        if (navigator.vibrate) navigator.vibrate(15);
      } else {
        setRecordHold({ dx: Math.min(0, dx), locked: false });
      }
    };
    const onUp = () => {
      stop();
      hold.released = true;
      if (hold.cancelled || hold.locked) return;
      if (Date.now() - hold.t0 < 350) {
        handleCancelRecording();
        setAudioError("Mantén pulsado para grabar");
        return;
      }
      if (mediaRecorderRef.current) handleSendRecording();
    };
    const onCancel = () => { stop(); hold.cancelled = true; handleCancelRecording(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    void handleStartRecording().then(() => {
      // Let go (or cancelled) while the microphone was still opening: nothing to send.
      if (hold.cancelled || (hold.released && !hold.locked)) handleCancelRecording();
    });
  };

  const handleSendRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.onstop = async () => {
      const chunks = [...audioChunksRef.current];
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      recorder.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      setRecordingSeconds(0);
      setRecordHold(null);
      setAudioError(null);
      if (blob.size < 100) { setAudioError("Grabación demasiado corta"); return; }

      // UI optimista: mostrar el mensaje inmediatamente con URL local
      const localUrl = URL.createObjectURL(blob);
      const tempId = -Date.now();
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const tempMsg: LocalMsg = {
        id: tempId,
        _key: tempId,
        sender_id: currentUserId,
        sender_nombre: me?.nombre ?? "",
        sender_profile_image: me?.profile_image ?? null,
        texto: "",
        created_at: new Date().toISOString(),
        audio_url: localUrl,
      };
      setMessages((prev) => [...prev, tempMsg]);
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

      try {
        const { downloadUrl } = await uploadAudioBlob({ blob, userId: currentUserId });
        const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, audioUrl: downloadUrl });
        const realMsg: MensajeRow = { ...tempMsg, id: newId, audio_url: downloadUrl };
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
        setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
        onNewMessageRef.current(realMsg);
        URL.revokeObjectURL(localUrl);
      } catch (e) {
        console.error("[chat] Error enviando nota de voz:", e);
        setAudioError("Error al enviar. Inténtalo de nuevo.");
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        URL.revokeObjectURL(localUrl);
      }
    };
    recorder.stop();
  };

  const handleSendDocument = async (file: File) => {
    setSendError(null);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto: "",
      created_at: new Date().toISOString(),
      document_url: "__uploading__",
      document_name: file.name,
    };
    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadDocumentFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, documentUrl: downloadUrl, documentName: file.name, documentSize: file.size });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, document_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
    } catch (e) {
      console.error("[chat] Error enviando documento:", (e as { message?: string })?.message ?? String(e));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError({ text: sendFail(`no se ha enviado «${file.name}»`), retry: () => void handleSendDocument(file) });
    }
  };

  const handleSendMedia = async (file: File) => {
    setSendError(null);
    const localUrl = URL.createObjectURL(file);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto: "",
      created_at: new Date().toISOString(),
      image_url: localUrl,
      image_type: file.type,
    };
    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadMediaFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, imageUrl: downloadUrl, imageType: file.type });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, image_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
      URL.revokeObjectURL(localUrl);
    } catch (e) {
      console.error("[chat] Error enviando media:", (e as { message?: string })?.message ?? String(e));
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError({ text: sendFail(file.type.startsWith("video") ? "no se ha enviado el vídeo" : "no se ha enviado la foto"), retry: () => void handleSendMedia(file) });
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleCreatePoll = async (question: string, options: string[]) => {
    const texto = JSON.stringify({ type: "poll", question, options });
    setShowPollCreator(false);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    try {
      const newId = await sendMensaje({ chatId: chat.chat_id, texto });
      const realMsg: MensajeRow = { ...tempMsg, id: newId };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
    } catch (e) {
      console.error("[chat] Error creando encuesta:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleSendAudioFile = async (file: File) => {
    const localUrl = URL.createObjectURL(file);
    const tempId = -Date.now();
    const me = chat.miembros.find((m) => m.id === currentUserId);
    const tempMsg: LocalMsg = {
      id: tempId,
      _key: tempId,
      sender_id: currentUserId,
      sender_nombre: me?.nombre ?? "",
      sender_profile_image: me?.profile_image ?? null,
      texto: "",
      created_at: new Date().toISOString(),
      audio_url: localUrl,
    };
    setMessages((prev) => [...prev, tempMsg]);
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadAudioFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, audioUrl: downloadUrl });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, audio_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
      URL.revokeObjectURL(localUrl);
    } catch (e) {
      console.error("[chat] Error enviando audio:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      URL.revokeObjectURL(localUrl);
    }
  };

  // «/cerrar» (board po-m-comando): the open polls I can close, filtered by what follows the command.
  // «/cerrar 2» keeps working for whoever knows it.
  const cerrarQuery = /^\/cerrar(?:\s+(.*))?$/i.exec(text.trimStart());
  const cerrarText = (cerrarQuery?.[1] ?? "").trim();
  const cerrarOptions = !cerrarQuery || /^\d+$/.test(cerrarText) ? [] : messages.flatMap((m) => {
    if (m.id <= 0) return [];
    const p = parseMoment(m.texto);
    if (p?.type !== "poll" || p.copiada_at || pollState(p) !== "abierta") return [];
    const mayClose = m.sender_id === currentUserId || m.sender_id === null || m.sender_id === "frimee" || m.tipo === "bot" || iAmAdmin;
    return mayClose && (!cerrarText || matchesText(p.question, cerrarText)) ? [{ msg: m, poll: p }] : [];
  });
  const cerrarOpen = cerrarOptions.length > 0;
  const cerrarIds = cerrarOptions.map((o) => o.msg.id).join(",");
  useEffect(() => {
    if (!cerrarIds) return;
    let alive = true;
    for (const id of cerrarIds.split(",").map(Number)) {
      if (cerrarCounts[id]) continue;
      const opts = (parseMoment(messages.find((m) => m.id === id)?.texto) as PollData | null)?.options ?? [];
      pollVotos(id)
        .then((vs) => { if (alive) setCerrarCounts((c) => ({ ...c, [id]: opts.map((_, i) => vs.filter((v) => v.option_index === i).length) })); })
        .catch(() => { /* the row just shows no tally */ });
    }
    return () => { alive = false; };
    // Counts are fetched once per poll while the list is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cerrarIds]);
  useEffect(() => { setCerrarActive(0); }, [cerrarIds]);
  /** «2 de 4 votos · empate ahora mismo» / «· gana viernes 28» / «· nadie ha votado». */
  const cerrarTally = (id: number, poll: PollData) => {
    const c = cerrarCounts[id];
    if (!c) return "\u00a0";
    const total = c.reduce((a, b) => a + b, 0);
    const max = Math.max(0, ...c);
    const top = c.map((n, i) => (n === max && max > 0 ? i : -1)).filter((i) => i >= 0);
    const how = top.length === 0 ? "nadie ha votado" : top.length === 1 ? `gana ${poll.options[top[0]]}` : "empate ahora mismo";
    return `${total} de ${Math.max(chat.miembros.length, total)} votos · ${how}`;
  };
  const closeFromCommand = async (m: MensajeRow) => {
    setText("");
    setEphemeral(null);
    try {
      applyPollCierre(m.id, await closePoll(m.id));
      emitPollVote(m.id);
    } catch (e) {
      console.error("[cerrar] fn_poll_close:", (e as { message?: string })?.message ?? String(e));
      setEphemeral("No se ha cerrado la encuesta. Inténtalo de nuevo.");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (cerrarOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const n = cerrarOptions.length;
        setCerrarActive((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void closeFromCommand(cerrarOptions[Math.min(cerrarActive, cerrarOptions.length - 1)].msg);
        return;
      }
      if (e.key === "Escape") { e.preventDefault(); setText(""); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); }
    // ↑ on an empty composer edits your last message (board s-sistema · Gestos).
    if (e.key === "ArrowUp" && !text && !editingMsg) {
      const last = [...messages].reverse().find((m) => m.sender_id === currentUserId && m.id > 0 && !m.tipo?.startsWith("call_")
        && !parseMoment(m.texto) && !m.audio_url && !m.document_url && !m.image_url);
      if (last) { e.preventDefault(); setEditingMsg(last); setText(last.texto); }
    }
    if (e.key === "Escape") { cancelEdit(); cancelReply(); closeOverlays(); }
  };

  const infoLabel = chat.tipo === "GRUPO" ? "Información del grupo" : chat.tipo === "PLAN" ? "Información del plan" : "Información del chat";
  /** «Ver destacados» (the notice, or the ★ of a message): the panel open on my starred messages. */
  const openStarred = () => {
    closeOverlays();
    setStarToast(false);
    setInfoStart("destacados");
    setInfoKey((k) => k + 1);
    setShowInfo(true);
  };

  const infoPanel = (variant: "aside" | "screen") => (
    <ChatInfoPanel
      key={infoKey}
      initialView={infoStart ?? undefined}
      chat={chat}
      currentUserId={currentUserId}
      info={chatInfo}
      infoError={chatInfoError}
      onRetryInfo={loadChatInfo}
      variant={variant}
      onClose={() => { setShowInfo(false); setInfoStart(null); }}
      planId={planId}
      isPlanAdmin={isAdmin}
      onChanged={() => { loadChatInfo(); onChatChanged?.(); }}
      onFotoUpdated={onFotoUpdated}
      onGone={onBack}
      onEmptied={() => {
        // Only for me (fn_chat_vaciar): the conversation, the ruler and the pin start again empty.
        setMessages([]);
        setHasMore(false);
        oldestIdRef.current = null;
        setPinnedId(null);
        setDetached(null);
        void getChatIndiceEndpoint(chat.chat_id).then(setIndice).catch((e) => console.error("[chat] Error leyendo el índice:", (e as { message?: string })?.message ?? String(e)));
        loadChatInfo();
        onChatChanged?.();
      }}
      onCreatePlan={() => { if (isPhone) setShowInfo(false); closeOverlays(); setCreatePlan({ guarda: null }); }}
      onWriteTo={onWriteTo}
      inChatNewest={inChatNewest}
      onJumpTo={(id) => {
        // Phone: the info covers the chat, so back to it first; desktop: the panel stays open.
        if (isPhone) setShowInfo(false);
        setTimeout(() => jumpToMessageRef.current(id), isPhone ? 150 : 0);
      }}
      onNotice={(n) => showMyServerMessage(n.mensaje_id, n.texto)}
      onMemberAdded={(p) => { void channelRef.current?.send({ type: "broadcast", event: "member_added", payload: { user_id: p.id, nombre: p.nombre, profile_image: p.profile_image } }); }}
    />
  );

  // Vuelo de la otra persona (solo en chats 1 a 1): línea fija arriba, plegada o desplegada.
  const otherFlight = useFriendFlight(chat.tipo === "DIRECTO" ? chat.miembros.find((m) => m.id !== currentUserId)?.id : null);

  if (showInfo && isPhone) {
    return <div className={containerClassName ?? "flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]"}>{infoPanel("screen")}</div>;
  }

  const pinnedMsg = pinnedId ? messages.find((m) => m.id === pinnedId) ?? null : null;

  const hasAskedFrimee = messages.some(
    (m) => m.sender_id === currentUserId && /@frimee\b/i.test(m.texto ?? ""),
  );
  const showAiHints = Boolean(planId) && !editingMsg && !text && !aiHintsDismissed && !hasAskedFrimee;

  // Bitácora: chapters per day and turns per person (see bitacora/timeline.ts).
  // In a plan's chat the days count towards the trip («faltan 14 días», «Día 2»).
  const trip = planInfo ? { start: new Date(planInfo.inicio_at), end: new Date(planInfo.fin_at) } : null;
  // Shown in time order: a message created out of order (the plan's welcome before the guest demo's
  // backdated ones) would otherwise open the same day twice.
  // In an old stretch, what arrives meanwhile waits below it until you go back to the latest.
  const timelineMessages = taparBloqueados(
    inTimeOrder(detached ? messages.filter((m) => m.id > 0 && m.id <= detached.endId) : messages),
    chat.tipo === "DIRECTO" ? null : bloqueados,
    currentUserId,
  );
  const blockedOther = chat.tipo === "DIRECTO"
    ? chat.miembros.find((m) => m.id !== currentUserId && bloqueados.has(m.id)) ?? null
    : null;
  const timeline = buildTimeline(timelineMessages, trip);
  const tabStopId = focusMsgId != null && timelineMessages.some((m) => m.id === focusMsgId)
    ? focusMsgId
    : [...timelineMessages].reverse().find((m) => m.id > 0)?.id ?? null;
  // Who reacted. The backend gives totals and whether yours is in: names only in 1 a 1.
  const otherName = chat.miembros.find((m) => m.id !== currentUserId)?.nombre?.split(" ")[0] || "Alguien";
  const reactionWho = (r: { total: number; mia: boolean }) => {
    if (r.mia) return r.total === 1 ? "Tú" : isDirectChat ? `Tú y ${otherName}` : `Tú y ${r.total - 1} más`;
    return isDirectChat ? otherName : `${r.total} ${r.total === 1 ? "persona" : "personas"}`;
  };
  const reactionLabel = (r: { emoji: string; total: number; mia: boolean }) => {
    if (r.mia && r.total === 1) return `Reaccionaste con ${r.emoji}. Toca para quitarla`;
    if (r.mia) return `${reactionWho(r)} reaccionasteis con ${r.emoji}. Toca para quitar la tuya`;
    return `${reactionWho(r)} ${r.total === 1 ? "reaccionó" : "reaccionaron"} con ${r.emoji}. Toca para reaccionar igual`;
  };
  // The ruler covers the whole chat (fn_chat_indice) plus what arrived after reading it.
  const loadedReal = messages.filter((m) => m.id > 0);
  const indexMaxId = indice?.max_id ?? 0;
  const arrived = indice ? loadedReal.filter((m) => m.id > indexMaxId).sort((a, b) => a.id - b.id) : [];
  const rulerTotal = indice ? indice.total + arrived.length : loadedReal.length;
  const dayFromString = (d: string) => {
    const [y, mo, day] = d.split("-").map(Number);
    return new Date(y, mo - 1, day);
  };
  // Same rule as fn_momento_decidido (the «Decisiones» count): with a saved result only «decidida»
  // counts (a tie is not a decision); older polls without it, closed or past their date.
  const pollDecided = (p: PollData) => (p.resultado
    ? p.resultado === "decidida"
    : Boolean(p.closed || (p.expires_at && new Date(p.expires_at) < new Date())));
  const rulerMarks: RulerMark[] = [];
  if (indice) {
    for (const d of indice.dias) {
      rulerMarks.push({ kind: "day", id: d.primer_id, ord: d.desde, label: chapterLabel(dayFromString(d.dia), new Date(), trip) });
    }
    for (const h of indice.hitos) {
      // A loaded message knows its current state (a poll closed, a proposal accepted or dismissed).
      const loaded = loadedReal.find((m) => m.id === h.id);
      const mo = loaded ? parseMoment(loaded.texto) : null;
      if (mo?.type === "propuesta" && mo.estado === "descartada") continue;
      // Closed without votes: not a milestone (po-sistema), as in fn_chat_indice.
      if (mo?.type === "poll" && mo.resultado === "sin_votos") continue;
      const decided = mo?.type === "poll" ? pollDecided(mo) : mo?.type === "propuesta" ? mo.estado === "aceptada" : h.estado === "decidido";
      rulerMarks.push({ kind: "hito", id: h.id, ord: h.ord, label: h.titulo ?? (h.tipo === "poll" ? "Encuesta" : "Propuesta de Frimee"), decided });
    }
    // New since the index (realtime): their days and milestones join the ruler without reloading.
    let lastDay = indice.dias.length > 0 ? indice.dias[indice.dias.length - 1].dia : null;
    arrived.forEach((m, k) => {
      const ord = indice.total + k;
      const at = m.created_at ? new Date(m.created_at) : new Date();
      const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
      if (key !== lastDay) {
        lastDay = key;
        rulerMarks.push({ kind: "day", id: m.id, ord, label: chapterLabel(at, new Date(), trip) });
      }
      const mo = parseMoment(m.texto);
      if (mo?.type === "poll") { if (mo.resultado !== "sin_votos") rulerMarks.push({ kind: "hito", id: m.id, ord, label: mo.question, decided: pollDecided(mo) }); }
      else if (mo?.type === "propuesta" && mo.estado !== "descartada") rulerMarks.push({ kind: "hito", id: m.id, ord, label: mo.titulo, decided: mo.estado === "aceptada" });
      else if (mo?.type === "hito_plan") rulerMarks.push({ kind: "hito", id: m.id, ord, label: mo.titulo, decided: true });
      else if (mo?.type === "plan_creado") rulerMarks.push({ kind: "hito", id: m.id, ord, label: `Plan creado: ${mo.titulo}`, decided: true });
    });
  }
  rulerMarks.sort((a, b) => a.ord - b.ord);
  // Where the loaded stretch sits among all the messages.
  const loadedCount = detached ? loadedReal.filter((m) => m.id <= detached.endId).length : loadedReal.length;
  const loadedFrom = detached ? detached.start : Math.max(0, rulerTotal - loadedCount);

  const dayLabelFor = (id: number) => {
    const d = indice ? [...indice.dias].reverse().find((x) => x.primer_id <= id) : null;
    return d ? chapterLabel(dayFromString(d.dia), new Date(), trip) : null;
  };

  /** Jump to an old message: load only the stretch around it, not everything in between. */
  const revealMessage = async (id: number) => {
    setJumping(dayLabelFor(id) ?? { title: "Cargando", subtitle: "" });
    try {
      const rows = await listMensajesTramoEndpoint(chat.chat_id, id, 25, 25);
      if (rows.length === 0) return;
      const latestKnown = Math.max(indexMaxId, ...loadedReal.map((m) => m.id));
      const last = rows[rows.length - 1];
      isNearBottomRef.current = false;
      setMessages(rows.map((r) => {
        const { orden, ...m } = r;
        void orden;
        return m;
      }));
      oldestIdRef.current = rows[0].id;
      setHasMore(rows[0].orden > 0);
      setDetached(last.id < latestKnown ? { start: rows[0].orden, endId: last.id } : null);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 2000);
    } catch (e) {
      console.error("[chat] Error saltando al mensaje:", (e as { message?: string })?.message ?? String(e));
    } finally {
      setJumping(null);
    }
  };
  revealMessageRef.current = revealMessage;

  /** «Ir a lo último»: from an old stretch, load the latest messages again. */
  const goToLatest = async () => {
    const wasDetached = Boolean(detachedRef.current);
    if (wasDetached) {
      try {
        const data = await listMensajes({ chatId: chat.chat_id, limit: 50 });
        setMessages(data);
        if (data.length > 0) oldestIdRef.current = data[0].id;
        setHasMore(data.length === 50);
        setDetached(null);
      } catch (e) {
        console.error("[chat] Error volviendo a lo último:", (e as { message?: string })?.message ?? String(e));
        return;
      }
    }
    isNearBottomRef.current = true;
    setNewWhileAway(0);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: reduce || wasDetached ? "auto" : "smooth" })));
  };
  const otherMembers = chat.miembros.filter((m) => m.id !== currentUserId).map((m) => m.nombre.split(" ")[0]);
  const headerSubtitle = trip
    ? `${chat.miembros.length} personas · ${tripStatus(trip)}`
    : chat.tipo === "GRUPO"
      ? `Grupo · ${otherMembers.length > 3 ? `${otherMembers.slice(0, 3).join(", ")} y ${otherMembers.length - 3} más` : `${otherMembers.join(", ")} y tú`}`
      : null;
  const isDirectChat = chat.tipo === "DIRECTO";

  return (
    <div ref={setDrawHost} className={`relative ${containerClassName ?? "flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]"} md:flex-row`}>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ paddingBottom: "var(--keyboard-height, 0px)" }}>
      {/* Poll creator modal */}
      {showPollCreator && (
        <PollCreatorModal
          onClose={() => setShowPollCreator(false)}
          onCreate={(question, options) => void handleCreatePoll(question, options)}
        />
      )}

      {/* Camera modal */}
      {showCamera && (
        <CameraModal
          onCapture={(file) => { setShowCamera(false); void handleSendMedia(file); }}
          onClose={() => setShowCamera(false)}
        />
      )}
      {/* Actions on a message: reactions on top, then the actions (sheet on phones). */}
      {contextMenu && (() => {
        const m = contextMenu.msg;
        const mine = m.sender_id === currentUserId;
        const t = m.created_at ? new Date(m.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
        const isCall = Boolean(m.tipo?.startsWith("call_"));
        const plain = !parseMoment(m.texto) && !m.audio_url && !m.document_url && !m.image_url && !isCall;
        const preview = momentPreview(m.texto)
          ?? (m.audio_url ? "Nota de voz" : m.document_url ? (m.document_name ?? "Documento") : m.image_url ? (m.image_type?.startsWith("video/") ? "Vídeo" : "Foto") : isCall ? "Llamada" : m.texto);
        return (
          <MessageActions
            author={mine ? "Tú" : m.tipo === "bot" ? "Frimee" : m.sender_nombre}
            preview={preview}
            meta={mine ? `Tu mensaje · ${t}` : t}
            isMe={mine}
            canEdit={mine && plain}
            canCopy={plain}
            isPinned={pinnedId === m.id}
            isStarred={starredIds.has(m.id)}
            myReaction={myReactionOf(m.id)}
            anchor={{ x: contextMenu.x, y: contextMenu.y, place: contextMenu.place }}
            reactionsOnly={contextMenu.reactionsOnly}
            onClose={closeOverlays}
            onReact={(emoji) => { reactTo(m.id, emoji); closeOverlays(); }}
            onReply={() => { setReplyingTo(m); closeOverlays(); setTimeout(() => inputRef.current?.focus(), 50); }}
            onEdit={() => { setEditingMsg(m); setText(m.texto); closeOverlays(); setTimeout(() => inputRef.current?.focus(), 50); }}
            onForward={() => { setForwardMsg(m); closeOverlays(); }}
            onCopy={() => { void navigator.clipboard.writeText(m.texto); closeOverlays(); }}
            onPin={() => { togglePin(m.id); closeOverlays(); }}
            onStar={() => { toggleStar(m.id); closeOverlays(); }}
            onDelete={() => { setDeleting(m); closeOverlays(); }}
            onAddToPlan={sellados.has(m.id) ? () => abrirSellado(sellados.get(m.id)!)
              : puedePlan(m) && (planFrom(m) || reading.has(m.id)) ? () => addToPlan(m, { x: contextMenu.x, y: contextMenu.y }) : undefined}
            addToPlanLabel={sellados.has(m.id) ? selladoLabel(sellados.get(m.id)!) : planId ? undefined : "Crear plan con esto"}
            addToPlanSealed={sellados.has(m.id)}
            onRegisterExpense={planId && gastoFrom(m) ? () => registerExpense(m) : undefined}
          />
        );
      })()}

      {deleting && (
        <DeleteMessageSheet
          msg={deleting}
          forAll={canDeleteForAll(deleting)}
          onClose={() => setDeleting(null)}
          onDelete={async (paraTodos) => { await handleDeleteMsg(deleting, paraTodos); setDeleting(null); }}
        />
      )}

      {/* Adjuntar: sitio, gasto y del plan */}
      {addPanel && (() => {
        const m = addPanel.msg;
        const base = planFrom(m);
        // With the conversation it wins field by field (an empty field there means «not clear»).
        const ctxPlan = addPanel.ctx?.status === "done" ? addPanel.ctx.plan : null;
        const prefill: ({ titulo: string } & PlanPrefill) | null = ctxPlan
          ? { titulo: ctxPlan.titulo || base?.titulo || "", fecha: ctxPlan.fecha || undefined, hora: ctxPlan.hora || undefined,
              horaFin: ctxPlan.hora_fin || undefined, tipo: ctxPlan.tipo || base?.tipo, lugar: ctxPlan.lugar || undefined }
          : base;
        const mo = parseMoment(m.texto);
        const status: "thinking" | "ready" | "failed" =
          addPanel.ctx?.status === "loading" ? "thinking" : prefill ? "ready" : reading.has(m.id) ? "thinking" : "failed";
        const personas = isDirectChat ? `2 · ${otherName} y tú` : `${chat.miembros.length} · todo el grupo`;
        return (
          <AddToPlanPanel
            status={status}
            prefill={prefill}
            suggested={mo?.type !== "lugar" && mo?.type !== "tarjeta" && mo?.type !== "poll"}
            plan={planId && planInfo ? { id: planId, titulo: planInfo.titulo, inicio_at: planInfo.inicio_at, fin_at: planInfo.fin_at, ubicacion_nombre: planInfo.ubicacion_nombre } : null}
            currentUserId={currentUserId}
            personas={personas}
            anchor={addPanel.anchor}
            onClose={() => setAddPanel(null)}
            onAdd={async (v) => {
              const r = await anadirAlPlanEndpoint({
                clientId: addPanel.clientId, chatId: chat.chat_id, planId: v.planId, titulo: v.titulo, tipo: v.tipo,
                inicio: v.inicio, fin: v.fin, ubicacionNombre: v.ubicacionNombre, lat: v.lat, lng: v.lng, origenId: m.id,
              });
              showMyServerMessage(r.mensaje_id, r.texto);
              const mark = parseMoment(r.texto);
              setAddedToast({ planId: v.planId, planTitulo: mark?.type === "hito_plan" ? mark.plan_titulo ?? "el plan" : "el plan", mensajeId: r.mensaje_id });
            }}
            onCreatePlan={planId ? undefined : (g) => { setAddPanel(null); setCreatePlan({ guarda: g }); }}
            onMoreOptions={(targetId, p: PanelPrefill) => {
              setAddPanel(null);
              const full = { titulo: p.titulo ?? "", fecha: p.fecha, hora: p.hora, tipo: p.tipo, lugar: p.lugar, lat: p.lat, lng: p.lng };
              if (targetId === planId && onAbrirActividad) onAbrirActividad(full.titulo.slice(0, 80), full);
              else goAddToPlan(targetId, full);
            }}
          />
        );
      })()}
      {createPlan && (
        <CreatePlanFlow
          chat={chat}
          currentUserId={currentUserId}
          guarda={createPlan.guarda}
          inicial={createPlan.inicial ?? null}
          origenId={createPlan.msg?.id ?? null}
          leerOrigen={createPlan.leerOrigen ?? false}
          onClose={() => setCreatePlan(null)}
          onCreated={(r, g) => {
            setCreatePlan(null);
            // Realtime here is a broadcast from the app: the mark reaches whoever has this chat open,
            // and the people added see the plan's chat in their list without reloading.
            showMyServerMessage(r.hito_id, r.hito_texto);
            notifyChatAdded(r.miembros, r.chat_id);
            // What was being added goes into the new plan (its mark lands in the plan's chat).
            const save = g?.fecha && g.hora
              ? (() => {
                  const start = new Date(`${g.fecha}T${g.hora}:00`);
                  return anadirAlPlanEndpoint({
                    clientId: crypto.randomUUID(), chatId: r.chat_id, planId: r.plan_id, titulo: g.titulo, tipo: g.tipo ?? "ACTIVIDAD",
                    inicio: start.toISOString(), fin: new Date(start.getTime() + (g.durMin && g.durMin > 0 ? g.durMin : 60) * 60_000).toISOString(),
                    ubicacionNombre: g.lugar ?? "", lat: g.lat ?? null, lng: g.lng ?? null,
                  }).catch((e) => console.error("[chat] guardar en el plan nuevo:", e));
                })()
              : Promise.resolve();
            void save.finally(() => {
              if (onOpenChat) onOpenChat(r.chat_id);
              else router.push(`/messages?chat=${r.chat_id}`);
            });
          }}
        />
      )}
      {attachSheet === "lugar" && <PlaceSheet onClose={() => setAttachSheet(null)} onSend={(place) => sendMoment(place)} />}
      {attachSheet === "gasto" && planId && (
        <ExpenseSheet
          members={chat.miembros.map((m) => ({ id: m.id, nombre: m.nombre }))}
          currentUserId={currentUserId}
          initial={expensePrefill ?? undefined}
          onClose={() => { setAttachSheet(null); setExpensePrefill(null); }}
          onRegister={(input) => registerChatExpense({ ...input, planId })}
        />
      )}
      {attachSheet === "plan" && !planId && (
        <InvitePlanSheet
          currentUserId={currentUserId}
          onClose={() => setAttachSheet(null)}
          onSend={(card) => sendMoment(card)}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && <ImageLightbox
        url={lightboxUrl}
        imageUrls={messages.filter((m) => m.image_url && !m.image_type?.startsWith("video/")).map((m) => m.image_url!)}
        onClose={() => setLightboxUrl(null)}
      />}

      {/* Forward modal */}
      {forwardMsg && (
        <div data-closing={forwardClosing ? "true" : "false"} className="app-modal-overlay absolute inset-0 z-50 flex items-end justify-center md:items-center" onClick={closeForwardModal}>
          <div className="app-modal-panel w-full max-w-[360px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]" onClick={(e) => e.stopPropagation()}>
            <p className="mb-[var(--space-3)] text-body-sm font-[var(--fw-semibold)] text-app">Reenviar a...</p>
            <div className="max-h-[280px] space-y-[1px] overflow-y-auto">
              {forwardChats.filter((c) => c.chat_id !== chat.chat_id).map((c) => {
                const cname = resolveChatName(c, currentUserId);
                const cavatar = resolveChatAvatar(c, currentUserId);
                return (
                  <button
                    key={c.chat_id}
                    type="button"
                    onClick={() => void handleForward(c.chat_id)}
                    disabled={!!forwardSending}
                    className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface disabled:opacity-50"
                  >
                    <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                      {cavatar ? <NextImage src={cavatar} alt={cname} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : c.tipo === "GRUPO" ? <GroupIcon className="size-[14px] text-muted" /> : (cname[0] ?? "?").toUpperCase()}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-body-sm text-app">{cname}</p>
                    {forwardSending === c.chat_id && <span className="text-[14px] text-muted">...</span>}
                  </button>
                );
              })}
              {forwardChats.filter((c) => c.chat_id !== chat.chat_id).length === 0 && (
                <p className="py-[var(--space-4)] text-center text-body-sm text-muted">No hay otros chats</p>
              )}
            </div>
            <button type="button" onClick={closeForwardModal} className="mt-[var(--space-3)] w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header (Bitácora): who, in serif; in a plan's chat, its date and where the trip stands */}
      {!embedded && (
        <div className="border-b border-app bg-app pt-mobile-safe-top md:pt-0">
          <div className="flex min-h-[56px] min-w-0 items-center gap-[4px] px-[4px] md:min-h-[64px] md:px-[var(--space-2)]">
            <button type="button" onClick={onBack} className={`flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app transition-colors hover:bg-surface ${backOnPhoneOnly ? "md:hidden" : ""}`} aria-label="Volver">
              <BackIcon className="size-[22px]" />
            </button>
            <button type="button" onClick={() => { setInfoStart(null); setShowInfo((v) => (isPhone ? true : !v)); }} aria-label={`${name}. ${infoLabel}`} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-[var(--space-3)] rounded-[8px] px-1 text-left transition-colors hover:bg-surface">
              {trip ? (
                <span aria-hidden className="flex size-[36px] shrink-0 flex-col items-center justify-center rounded-[8px] border border-[var(--chat-me-border)] bg-[var(--chat-me)] leading-none">
                  <span className="[font-family:var(--font-display-face)] text-[18px] tabular-nums text-app">{trip.start.getDate()}</span>
                  <span className="mt-[2px] text-[9px] font-[var(--fw-semibold)] uppercase tracking-[0.04em] text-muted">{trip.start.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}</span>
                </span>
              ) : (
                <span className="flex size-[36px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-[var(--surface-2)] text-[14px] font-[var(--fw-semibold)] text-app">
                  {avatar ? <NextImage src={avatar} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : chat.tipo === "GRUPO" ? <GroupIcon className="size-[16px] text-muted" /> : (name[0] ?? "?").toUpperCase()}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate [font-family:var(--font-display-face)] text-[23px] leading-[26px] text-app">{name}</span>
                {headerSubtitle && <span className="block truncate text-[12px] text-muted">{headerSubtitle}</span>}
              </span>
            </button>
            {!planId && chat.tipo !== "PLAN" && (
              <ChatIconButton label="Crear plan con este chat" onClick={() => { closeOverlays(); setCreatePlan({ guarda: null }); }}>
                <CalendarPlus className="size-[21px]" />
              </ChatIconButton>
            )}
            {!blockedOther && (
              <>
                <ChatIconButton label="Iniciar llamada de voz" onClick={() => onStartCall?.("audio")}>
                  <PhoneCallIcon className="size-[22px]" />
                </ChatIconButton>
                <ChatIconButton label="Iniciar videollamada" onClick={() => onStartCall?.("video")}>
                  <VideoCallIcon className="size-[23px]" />
                </ChatIconButton>
              </>
            )}
            <ChatIconButton label={infoLabel} aria-pressed={showInfo} onClick={() => { setInfoStart(null); setShowInfo((v) => !v); }} className="hidden md:inline-flex">
              <Info className="size-[21px]" />
            </ChatIconButton>
          </div>
        </div>
      )}

      {otherFlight && <FlightLine flight={otherFlight} chatId={chat.chat_id} maxWidth={640} column={780} />}
      {embedded && onStartCall && (
        <div className="flex items-center justify-end gap-1 px-[var(--space-3)] pt-2 md:hidden">
          <ChatIconButton label="Iniciar llamada de voz" size="sm" onClick={() => onStartCall("audio")}>
            <PhoneCallIcon className="size-[20px]" />
          </ChatIconButton>
          <ChatIconButton label="Iniciar videollamada" size="sm" onClick={() => onStartCall("video")}>
            <VideoCallIcon className="size-[21px]" />
          </ChatIconButton>
        </div>
      )}

      {/* Ongoing group call banner — hide when already in the call */}
      {ongoingCall && !inCall && (
        <div className="flex items-center gap-[var(--space-3)] border-b border-app bg-surface px-[var(--space-3)] py-[10px]">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-500/15 text-green-500">
            <Phone className="size-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-[var(--fw-semibold)] text-app">Llamada en curso</p>
            <p className="text-[14px] text-muted">{ongoingCall.tipo === "video" ? "Videollamada" : "Llamada de voz"}</p>
          </div>
          <button
            type="button"
            onClick={() => onJoinCall?.(ongoingCall.id, ongoingCall.room_name, ongoingCall.tipo)}
            className="shrink-0 rounded-full bg-green-500 px-4 py-1.5 text-sm font-[var(--fw-semibold)] text-white transition-colors hover:bg-green-600"
          >
            Unirse
          </button>
        </div>
      )}

      {/* Pinned message banner */}
      {pinnedMsg && (
        <div className="flex items-center gap-[var(--space-2)] border-b border-app bg-[var(--surface)] pl-[var(--space-4)] pr-[4px]">
          <button type="button" onClick={() => scrollToMessage(pinnedMsg.id)} className="flex min-h-[44px] min-w-0 flex-1 items-center gap-[8px] text-left">
            <PinIcon className="size-[13px] shrink-0 text-[var(--chat-accent-text)]" aria-hidden />
            <span className="shrink-0 text-[12px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Fijado</span>
            {(() => {
              const p = pinnedSummary(pinnedMsg);
              return (
                <span className="flex min-w-0 flex-1 items-center gap-[6px]">
                  {p.icon}
                  <span className="min-w-0 flex-1 truncate text-[14px] text-app">{p.text}</span>
                </span>
              );
            })()}
          </button>
          <button type="button" onClick={() => togglePin(pinnedMsg.id)} aria-label="Desfijar" className="flex size-[44px] shrink-0 items-center justify-center rounded-full text-muted hover:bg-[var(--surface-2)]">
            <X className="size-[14px]" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollContainerRef} tabIndex={-1} className="outline-none scrollbar-thin min-h-0 flex-1 pr-[8px] md:pr-[48px] overflow-x-hidden overflow-y-auto pb-[var(--space-2)] pt-[var(--space-2)]" onClick={closeOverlays}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Cargando...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Sé el primero en escribir</div>
        ) : (
          <div className="relative mx-auto flex min-h-full w-full max-w-[780px] flex-col justify-end pb-[16px]">
            {/* pb: room for the hover action bar (42 px) of a one-line last message, so it never
                pokes out of the scroller and makes the scrollbar (and the whole chat) jump. */}
            {/* The spine of the Bitácora: one line that holds the whole conversation */}
            <div aria-hidden className="pointer-events-none absolute bottom-0 left-[27px] top-0 w-px bg-[var(--border)]" />
            {/* Sentinel para infinite scroll hacia arriba */}
            <div ref={topSentinelRef} className="h-px" />
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="size-5 animate-spin rounded-full border-2 border-app border-t-transparent" />
              </div>
            )}
            {timelineMessages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUserId;
              const isBot = msg.tipo === "bot";
              const slot = timeline[idx];
              const startsTurn = slot?.startsTurn ?? true;
              const endsTurn = slot?.endsTurn ?? true;
              const startsBurst = slot?.startsBurst ?? true;
              const endsBurst = slot?.endsBurst ?? true;
              // An exchange of quick messages: one time at its start, no repeated headers inside it.
              const inBurst = slot?.inBurst ?? false;
              const timeHere = inBurst ? endsBurst : endsTurn;
              // My read checks: also at the end of each run of mine inside a burst (the burst's one
              // time may sit under someone else's message, and mine would never say «visto»).
              const checkHere = timeHere || (inBurst && endsTurn);
              const msgDate = msg.created_at ? new Date(msg.created_at) : null;
              const msgTime = msgDate ? msgDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false }) : formatChatTime(msg.created_at);
              const isCallRecord = Boolean(msg.tipo?.startsWith("call_"));
              const moment = parseMoment(msg.texto);
              // Cards carry their own frame: no tinted block around them, not even mine.
              const isCard = Boolean(moment && moment.type !== "poll" && moment.type !== "propuesta");
              const isRichContent = isCallRecord || Boolean(msg.audio_url || msg.document_url || msg.image_url) || Boolean(moment);
              const msgReactions = reactions[msg.id] ?? [];
              const isStarred = starredIds.has(msg.id);
              // In 1 a 1 the avatar on the spine is enough; groups and plans name each turn.
              const showName = startsTurn && (isBot || !isDirectChat);
              // Desktop: the menu opens over the action bar, right-aligned to it.
              const openFromBar = (e: React.MouseEvent<HTMLButtonElement>, reactionsOnly = false) => {
                e.stopPropagation();
                const bar = e.currentTarget.closest<HTMLElement>("[role=toolbar]") ?? e.currentTarget;
                const rect = bar.getBoundingClientRect();
                setContextMenu({ msg, x: rect.right, y: rect.top, place: "above", reactionsOnly });
              };
              const onBubbleTouchStart = (e: React.TouchEvent) => {
                const t = e.touches[0];
                lastTouchAtRef.current = Date.now();
                swipeRef.current = { startX: t.clientX, startY: t.clientY, el: e.currentTarget as HTMLElement, triggered: false, moved: false, t0: Date.now() };
                longPressTimerRef.current = setTimeout(() => {
                  setContextMenu({ msg, x: t.clientX, y: t.clientY + 4 });
                  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(40);
                }, LONG_PRESS_MS);
              };
              const onBubbleTouchMove = (e: React.TouchEvent) => {
                const s = swipeRef.current;
                if (!s) return;
                const t = e.touches[0];
                const dx = t.clientX - s.startX;
                const dy = Math.abs(t.clientY - s.startY);
                // A finger that barely moves is still a tap or a long press.
                if (Math.abs(dx) < 8 && dy < 8) return;
                s.moved = true;
                if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                if (dy > Math.abs(dx) + 8) { swipeRef.current = null; return; }
                // Right on any message replies (board s-sistema · Gestos), mine included.
                if (dx <= 0) return;
                const clamped = Math.min(dx, 80);
                s.el.style.transform = `translateX(${clamped}px)`;
                s.el.style.transition = "none";
                if (Math.abs(dx) >= 64 && !s.triggered) {
                  s.triggered = true;
                  setReplyingTo(msg);
                  closeOverlays();
                  setTimeout(() => inputRef.current?.focus(), 50);
                  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
                }
              };
              const onBubbleTouchEnd = () => {
                if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                const s = swipeRef.current;
                // Two quick taps on the same message: react with the last emoji.
                if (s && !s.moved && Date.now() - s.t0 < 300 && msg.id > 0) {
                  const prev = lastTapRef.current;
                  if (prev && prev.id === msg.id && Date.now() - prev.t < 320) {
                    lastTapRef.current = null;
                    reactWithLast(msg.id);
                  } else {
                    lastTapRef.current = { id: msg.id, t: Date.now() };
                  }
                }
                if (s) {
                  s.el.style.transition = "transform 0.25s ease";
                  s.el.style.transform = "translateX(0)";
                  swipeRef.current = null;
                }
              };
              // Desktop action bar (board d-acciones): on hover, or with the keyboard focus (:focus-visible,
              // so a click never leaves it showing). Inside the row, 4 px from its top, so it never covers the
              // message above. Mine: 8 px left of the block, at its top (on the right it would cover it).
              const barBesideBlock = isMe && moment?.type !== "poll" && moment?.type !== "gasto";
              const menuOpenHere = contextMenu?.msg.id === msg.id;
              const hoverBar = !isBot && msg.id > 0 && moment?.type !== "eliminado" ? (
                <div
                  role="toolbar"
                  aria-label="Acciones"
                  // Inside my block: a double click here is not «react with the last emoji».
                  onDoubleClick={(e) => e.stopPropagation()}
                  className={`absolute z-[3] hidden gap-[2px] rounded-[8px] border border-app bg-[var(--bg)] p-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.12)] md:group-hover/msg:flex md:group-has-[:focus-visible]/msg:flex ${barBesideBlock ? "right-full top-0 mr-[8px]" : "right-[16px] top-[4px]"} ${menuOpenHere ? "md:flex" : ""}`}
                >
                  <button type="button" aria-label="Reaccionar" title="Reaccionar" onClick={(e) => openFromBar(e, true)} className="flex size-[36px] items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-app">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /></svg>
                  </button>
                  <button type="button" aria-label="Responder" title="Responder · R" onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); setTimeout(() => inputRef.current?.focus(), 0); }} className="flex size-[36px] items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-app">
                    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
                  </button>
                  {puedePlan(msg) && !planFrom(msg) && reading.has(msg.id) && (
                    <button type="button" aria-label="Añadir al plan (Frimee está leyendo el mensaje)" title="Frimee está leyendo este mensaje…" onClick={(e) => { e.stopPropagation(); addToPlan(msg, barAnchor(e)); }} className="flex size-[36px] items-center justify-center rounded-[6px] opacity-60 hover:bg-[var(--surface-2)]">
                      <span className="animate-pulse motion-reduce:animate-none"><DiamondIcon /></span>
                    </button>
                  )}
                  {sellados.has(msg.id) && (
                    <button type="button" aria-label={selladoLabel(sellados.get(msg.id)!)} title={`${selladoLabel(sellados.get(msg.id)!)} · P`} onClick={(e) => { e.stopPropagation(); abrirSellado(sellados.get(msg.id)!); }} className="flex size-[36px] items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--surface-2)]">
                      <DiamondIcon filled />
                    </button>
                  )}
                  {/* A poll without a winner yet (open or tied): the diamond is there but waits. */}
                  {moment?.type === "poll" && canPlan && !anadidos.has(msg.id) && !pollWinner(moment) && pollState(moment) !== "sin_votos" && (
                    <span role="button" aria-disabled="true" aria-label="Añadir al plan, no disponible: aún no hay ganador" title="Aún no hay ganador · desempata primero" className="flex size-[36px] cursor-not-allowed items-center justify-center rounded-[6px] opacity-40">
                      <DiamondIcon />
                    </span>
                  )}
                  {anadidos.has(msg.id) && (
                    <button type="button" aria-label="Ya está en el plan · Ver en el plan" title="Ya está en el plan" onClick={(e) => { e.stopPropagation(); router.push(`/plans/${anadidos.get(msg.id)!.plan_id}`); }} className="flex size-[36px] items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--surface-2)]">
                      <DiamondIcon filled />
                    </button>
                  )}
                  {puedePlan(msg) && planFrom(msg) && (
                    <button type="button" aria-label={planId ? "Añadir al plan" : "Crear plan con esto"} title={moment?.type === "poll" && planId ? `Añadir al plan · P · ${pollWinner(moment)}` : planId ? "Añadir al plan · P" : "Crear plan con esto · P"} onClick={(e) => { e.stopPropagation(); addToPlan(msg, barAnchor(e)); }} className="flex size-[36px] items-center justify-center rounded-[6px] transition-colors hover:bg-[var(--surface-2)]">
                      <DiamondIcon />
                    </button>
                  )}
                  <button type="button" aria-label="Más acciones" title="Más acciones" aria-haspopup="menu" aria-pressed={menuOpenHere && !contextMenu?.reactionsOnly} onClick={(e) => openFromBar(e)} className={`flex size-[36px] items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-app ${menuOpenHere && !contextMenu?.reactionsOnly ? "bg-[var(--surface-2)] text-app" : ""}`}>
                    <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                  </button>
                </div>
              ) : null;
              // Phones: the long press lifts the message while its actions are open.
              const lifted = menuOpenHere ? "z-[2] scale-[1.02] drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] md:scale-100 md:drop-shadow-none" : "";
              // Desktop (board d-acciones): the whole message darkens a little on hover, and while its menu is open.
              const rowHover = `isolate before:pointer-events-none before:absolute before:inset-y-0 before:left-[8px] before:right-[8px] before:-z-10 before:rounded-[8px] before:transition-colors before:content-[''] md:hover:before:bg-[var(--chat-surface)] ${menuOpenHere ? "md:before:bg-[var(--chat-surface)]" : ""}`;
              const replyQuote = msg.reply_texto && msg.reply_to_id ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.reply_to_id!); }}
                  aria-label={`Respuesta a ${msg.reply_sender_nombre ?? "un mensaje"}: ${momentPreview(msg.reply_texto) ?? msg.reply_texto}. Ir al mensaje`}
                  className="mb-[4px] flex w-fit max-w-full items-center gap-[6px] rounded-[6px] bg-[var(--chat-surface)] px-[8px] py-[4px] text-left text-[13px] transition-opacity hover:opacity-80"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-[14px] shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>
                  <span className="shrink-0 font-[var(--fw-semibold)] text-primary-token">{msg.reply_sender_nombre ?? "Usuario"}</span>
                  <span className="min-w-0 truncate text-muted">{momentPreview(msg.reply_texto) ?? msg.reply_texto}</span>
                </button>
              ) : null;
              // Calls never get here: they are drawn as a line on the spine (CallLine) below.
              const content = msg.audio_url ? (
                <AudioPlayer src={msg.audio_url} sending={msg.id < 0} />
              ) : msg.document_url ? (
                <DocumentBubble url={msg.document_url} name={msg.document_name ?? "Documento"} sending={msg.id < 0} />
              ) : msg.image_url ? (
                <MediaBubble url={msg.image_url} type={msg.image_type ?? "image/jpeg"} sending={msg.id < 0} time={isMe && timeHere ? msgTime : ""} isMe={isMe} onOpenLightbox={!msg.image_type?.startsWith("video/") ? () => setLightboxUrl(msg.image_url!) : undefined} />
              ) : moment?.type === "eliminado" ? (
                <p className="flex items-center gap-[6px] text-[15px] italic leading-[1.45] text-muted">
                  <Ban className="size-[15px] shrink-0" aria-hidden />
                  {deletedText(moment)}
                </p>
              ) : moment?.type === "resumen_viaje" ? (
                <TripSummaryCard data={moment} planTitle={planInfo?.titulo} planDates={trip ? tripRange(trip) : undefined} planId={planId} />
              ) : moment?.type === "tarjeta" ? (
                <PlanItemCard data={moment} isMe={isMe} tripStart={planId === moment.plan_id ? planInfo?.inicio_at : null} />
              ) : moment?.type === "lugar" ? (
                <PlaceCard data={moment} title={isMe ? "Compartiste un sitio" : `${msg.sender_nombre.split(" ")[0]} compartió un sitio`} time={msgTime} />
              ) : moment?.type === "propuesta" ? (
                <FrimeeProposal
                  data={moment}
                  canAccept={msg.id > 0 && (!proposalNeedsAdmin(moment) || Boolean(isAdmin))}
                  cannotAcceptReason={proposalNeedsAdmin(moment) ? "Solo un admin del plan puede añadirlo." : undefined}
                  onAccept={() => resolveProposal(msg, moment, true)}
                  onDismiss={() => resolveProposal(msg, moment, false)}
                />
              ) : (
                <p className={`break-words text-[15px] leading-[1.45] text-app${isBot ? " whitespace-pre-line" : ""}`}><LinkifiedText text={msg.texto} /></p>
              );
              // Rich content keeps its own look until phase 2: framed on a surface for the others.
              const richFrame = isRichContent && !msg.image_url && !moment ? "rounded-[8px] border border-app bg-[var(--surface)] px-3 py-2" : "";
              // Sending (clock), sent (one check) or seen by everyone else (two checks, accent).
              const seen = Boolean(msg.created_at) && lecturas.length > 0
                && lecturas.every((l) => l.last_read_at && new Date(l.last_read_at) >= new Date(msg.created_at));
              const readMark = !isMe ? null : msg.id < 0 ? (
                <svg role="img" aria-label="Enviando" viewBox="0 0 24 24" className="size-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>
              ) : seen ? (
                <svg role="img" aria-label="Visto" viewBox="0 0 24 24" className="size-[16px] shrink-0 text-primary-token" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m2 12.5 4.5 4.5L15 8.5" /><path d="m11 16 1 1 8.5-8.5" /></svg>
              ) : (
                <svg role="img" aria-label="Enviado" viewBox="0 0 24 24" className="size-[14px] shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
              );
              const isPlainText = !moment && !msg.audio_url && !msg.document_url && !msg.image_url && !isCallRecord;
              // Desktop keyboard (board s-sistema · Gestos): R reply, E edit mine, Supr delete mine, Enter actions.
              const onMessageKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.target !== e.currentTarget || msg.id < 0) return;
                const key = e.key.toLowerCase();
                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const all = [...(scrollContainerRef.current?.querySelectorAll<HTMLElement>("[data-msg-focus]") ?? [])];
                  const at = all.indexOf(e.currentTarget);
                  const next = all[at + (e.key === "ArrowUp" ? -1 : 1)];
                  if (next) { next.focus(); next.scrollIntoView({ block: "nearest" }); }
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  scrollContainerRef.current?.focus();
                  return;
                }
                if ((e.ctrlKey || e.metaKey) && key === "c" && isPlainText && !window.getSelection()?.toString()) {
                  e.preventDefault();
                  void navigator.clipboard.writeText(msg.texto);
                  return;
                }
                if (e.ctrlKey || e.metaKey || e.altKey) return;
                if (key === "r") {
                  e.preventDefault();
                  setReplyingTo(msg);
                  setTimeout(() => inputRef.current?.focus(), 0);
                } else if (key === "e" && isMe && isPlainText) {
                  e.preventDefault();
                  setEditingMsg(msg);
                  setText(msg.texto);
                  setTimeout(() => inputRef.current?.focus(), 0);
                } else if (e.key === "Delete" && msg.id > 0) {
                  e.preventDefault();
                  setDeleting(msg);
                } else if (key === "g" && !e.shiftKey && planId && gastoFrom(msg)) {
                  e.preventDefault();
                  registerExpense(msg);
                } else if (key === "p" && !e.shiftKey && sellados.has(msg.id)) {
                  e.preventDefault();
                  abrirSellado(sellados.get(msg.id)!);
                } else if (key === "p" && !e.shiftKey && puedePlan(msg) && (planFrom(msg) || reading.has(msg.id))) {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  addToPlan(msg, { x: r.right, y: r.top });
                } else if (key === "f" && !e.shiftKey) {
                  e.preventDefault();
                  setForwardMsg(msg);
                } else if (key === "s" && !e.shiftKey) {
                  e.preventDefault();
                  toggleStar(msg.id);
                } else if ((e.key === "Enter" || e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) && !isBot) {
                  // Menu key or Shift+F10: the same menu, over the message.
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ msg, x: rect.right, y: rect.top, place: "above" });
                }
              };
              const gestureProps = {
                // Roving focus: only one message is in the tab order; ↑ ↓ move between them.
                tabIndex: msg.id === tabStopId ? 0 : -1,
                "data-msg-focus": msg.id,
                onFocus: () => setFocusMsgId(msg.id),
                "aria-keyshortcuts": isMe ? "R E F S Delete Shift+F10" : "R F S Delete Shift+F10",
                onKeyDown: onMessageKeyDown,
                // Right click: the same menu at the pointer (a long press on phones already opens it).
                onContextMenu: (e: React.MouseEvent) => {
                  e.preventDefault();
                  if (isBot || msg.id < 0 || Date.now() - lastTouchAtRef.current < 1000) return;
                  setContextMenu({ msg, x: e.clientX, y: e.clientY, place: "cursor" });
                },
                onDoubleClick: (e: React.MouseEvent) => {
                  // Phones already handled the double tap on touchend.
                  if (Date.now() - lastTouchAtRef.current < 800 || msg.id < 0) return;
                  e.preventDefault();
                  window.getSelection()?.removeAllRanges();
                  reactWithLast(msg.id);
                },
                onTouchStart: onBubbleTouchStart,
                onTouchMove: onBubbleTouchMove,
                onTouchEnd: onBubbleTouchEnd,
                onTouchCancel: onBubbleTouchEnd,
              };
              // Everyone's reactions; tapping one toggles mine.
              // Reactions right under the message (boards m-1a1, d-racha): a 28 px chip with emoji and
              // count inside a 40 px target, tinted when yours is in it; on desktop, «Añadir reacción» and
              // who reacted on hover.
              const reactionChip = msgReactions.length > 0 && moment?.type !== "eliminado" ? (
                <div className={`-mb-[6px] flex flex-wrap items-center gap-[6px] ${isMe ? "justify-end" : ""}`}>
                  {msgReactions.map((r) => {
                    const who = reactionWho(r);
                    return (
                      <button
                        key={r.emoji}
                        type="button"
                        aria-pressed={r.mia}
                        aria-label={reactionLabel(r)}
                        onClick={(e) => { e.stopPropagation(); reactTo(msg.id, r.mia ? "" : r.emoji); }}
                        className="group/r relative inline-flex h-[40px] items-center outline-none"
                      >
                        <span className={`inline-flex h-[28px] items-center gap-[4px] rounded-[8px] border px-[8px] text-[13px] font-[var(--fw-medium)] tabular-nums text-app group-focus-visible/r:ring-2 group-focus-visible/r:ring-[var(--primary)] ${r.mia ? "border-[var(--chat-me-border)] bg-[var(--chat-tint)]" : "border-app"}`}>
                          <span>{r.emoji}</span><span>{r.total}</span>
                        </span>
                        <span role="tooltip" className="pointer-events-none absolute bottom-[40px] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-app bg-[var(--bg)] px-[10px] py-[6px] text-[12px] font-[var(--fw-semibold)] text-app shadow-[0_8px_32px_rgba(0,0,0,0.3)] md:group-hover/r:block md:group-focus-visible/r:block">
                          {who}
                        </span>
                      </button>
                    );
                  })}
                  {!isBot && (
                    <button
                      type="button"
                      aria-label="Añadir reacción"
                      title="Añadir reacción"
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setContextMenu({ msg, x: rect.right, y: rect.top, place: "above", reactionsOnly: true });
                      }}
                      className="hidden size-[40px] items-center justify-center rounded-full text-muted transition-colors hover:bg-[var(--surface-2)] hover:text-app md:inline-flex"
                    >
                      <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20.9 11.2A9 9 0 1 1 12.8 3.04" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9h.01M15 9h.01" /><path d="M19 2v6M16 5h6" />
                      </svg>
                    </button>
                  )}
                </div>
              ) : null;
              const highlight = highlightedId === msg.id ? "bg-[var(--text-primary)]/10 transition-colors motion-reduce:transition-none" : "";
              const burstTimeRow = inBurst && startsBurst;
              const gapAbove = burstTimeRow ? "mt-[6px]"
                : slot?.chapter ? ""
                : startsBurst ? "mt-[14px]"
                : startsTurn ? "mt-[6px]"
                : "mt-[2px]";
              // Others: name and time on top of a turn; inside a burst only the name, and only in groups.
              const showHeader = startsTurn && (!inBurst || showName || isBot);
              // The header adds 4 px on top: 14 between people (system board), less inside a quick exchange.
              const gapAboveHeader = burstTimeRow ? "mt-[6px]" : slot?.chapter ? "" : startsBurst ? "mt-[10px]" : startsTurn ? "mt-[2px]" : "mt-[2px]";
              const compactMine = inBurst && !isRichContent && !replyQuote;
              if (isCallRecord && msg.tipo) {
                const callTipo = msg.tipo;
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                    <div id={`msg-${msg.id}`} className={`mt-[8px] ${highlight}`}>
                      <CallLine
                        tipo={callTipo}
                        duracion={parseInt(msg.texto) || 0}
                        time={msgTime}
                        isMe={isMe}
                        otherName={msg.sender_nombre.split(" ")[0] || "Alguien"}
                        onCallBack={onStartCall && !inCall ? () => onStartCall(callTipo.includes("video") ? "video" : "audio") : undefined}
                      />
                    </div>
                  </Fragment>
                );
              }
              if (moment?.type === "aviso") {
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                    <div id={`msg-${msg.id}`} className={`mt-[10px] flex justify-center px-[var(--space-4)] ${highlight}`}>
                      <p className="max-w-[420px] text-center text-[13px] leading-[1.4] text-muted">{noticeText(moment, currentUserId)}</p>
                    </div>
                  </Fragment>
                );
              }
              if (moment?.type === "copia_chat") {
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    <div id={`msg-${msg.id}`} className={highlight}>
                      <CopySeparator data={moment} onOpenChat={onOpenChat} />
                    </div>
                  </Fragment>
                );
              }
              if (moment?.type === "plan_creado") {
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                    <div id={`msg-${msg.id}`} className={highlight}>
                      <PlanCreatedMark data={moment} currentUserId={currentUserId} inPlanChat={planId === moment.plan_id} chatId={chat.chat_id} onOpenChat={onOpenChat} />
                    </div>
                  </Fragment>
                );
              }
              if (moment?.type === "hito_plan") {
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                    <div id={`msg-${msg.id}`} className={`mt-[6px] ${highlight}`}>
                      <PlanMarkLine data={moment} isMe={isMe} who={msg.sender_nombre.split(" ")[0] || "Alguien"} tripStart={planId === moment.plan_id ? planInfo?.inicio_at : null} />
                    </div>
                  </Fragment>
                );
              }
              if (moment?.type === "gasto") {
                // Its own moment (not a bubble of whoever wrote it down): on the spine, for everyone.
                const payer = moment.pagado_por_nombre.split(" ")[0];
                const writer = msg.sender_nombre.split(" ")[0] || null;
                const apuntadoPor = writer && writer !== payer ? (isMe ? "ti" : writer) : null;
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                    <article id={`msg-${msg.id}`} aria-label={`Gasto, ${msgTime}`} className={`group/msg relative pl-[56px] pr-[var(--space-4)] ${slot?.chapter ? "mt-[4px]" : "mt-[14px]"} ${highlight} ${rowHover}`}>
                      {hoverBar}
                      <span aria-hidden className="absolute left-[23px] top-[18px] size-[9px] rounded-full border border-[var(--text-secondary)] bg-[var(--bg)]" />
                      <div className={`relative transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] ${lifted} outline-none`} {...gestureProps}>
                        <ExpenseCard data={moment} planId={planId} apuntadoPor={apuntadoPor} />
                      </div>
                      {reactionChip}
                    </article>
                  </Fragment>
                );
              }
              if (moment?.type === "poll_cerrada") {
                const chapter = slot?.chapter ? <DayChapter id={`day-${msg.id}`} label={slot.chapter} /> : null;
                const who = msg.sender_id === currentUserId ? null : msg.sender_nombre.split(" ")[0] || "Alguien";
                // The reopen line and the grey tie only matter while the poll is open again: once it is
                // closed (decided, drawn…), its card tells the story and these go away.
                const pollMsg = messages.find((x) => x.id === moment.poll_id);
                const pollNow = pollMsg ? parseMoment(pollMsg.texto) : null;
                const closedAgain = pollNow?.type === "poll" && pollState(pollNow) !== "abierta";
                // «Ana ha reabierto «¿Dónde vamos?» para Lucía y Marcos · Ir a la encuesta»: the poll is
                // open again where it was; this line at the end says so, so nobody has to look for it.
                if (moment.resultado === "reabierta" && !closedAgain) {
                  const para = (moment.para ?? []).map((p) => (p.id === currentUserId ? "ti" : p.nombre.split(" ")[0]));
                  return (
                    <Fragment key={(msg)._key ?? msg.id}>
                      {chapter}
                      <div id={`msg-${msg.id}`} className={`mt-[10px] flex justify-center px-[var(--space-4)] ${highlight}`}>
                        <p className="max-w-[460px] text-center text-[13px] leading-[1.4] text-muted">
                          {who ? `${who} ha reabierto` : "Has reabierto"} «{moment.pregunta ?? "la encuesta"}»{para.length ? ` para ${para.length > 1 ? `${para.slice(0, -1).join(", ")} y ${para[para.length - 1]}` : para[0]}` : ""} ·{" "}
                          <button type="button" onClick={() => jumpToMessageRef.current(moment.poll_id)} className="min-h-[32px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] underline-offset-[3px] hover:underline">
                            Ir a la encuesta
                          </button>
                        </p>
                      </div>
                    </Fragment>
                  );
                }
                // A tie that was reopened afterwards stays as a grey milestone, without buttons.
                const reopen = moment.resultado === "empate"
                  ? messages.find((x) => x.id > msg.id && (() => { const r = parseMoment(x.texto); return r?.type === "poll_cerrada" && r.resultado === "reabierta" && r.poll_id === moment.poll_id; })())
                  : undefined;
                if (reopen && !closedAgain) {
                  const by = reopen.sender_id === currentUserId ? "ti" : reopen.sender_nombre.split(" ")[0] || "alguien";
                  const at = new Date(reopen.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
                  return (
                    <Fragment key={(msg)._key ?? msg.id}>
                      {chapter}
                      <div id={`msg-${msg.id}`} className={`relative mt-[10px] pl-[56px] pr-[var(--space-4)] ${highlight}`}>
                        <span aria-hidden className="absolute left-[23px] top-[6px] size-[9px] rotate-45 border border-[var(--text-secondary)] bg-[var(--bg)]" />
                        <p className="text-[13px] text-muted">
                          {moment.texto.replace(/^Encuesta cerrada · /, "")} · reabierta por {by} · {at}
                        </p>
                      </div>
                    </Fragment>
                  );
                }
                // Otherwise never drawn: the poll's own card shows the result; it feeds the list.
                return chapter ? <Fragment key={(msg)._key ?? msg.id}>{chapter}</Fragment> : null;
              }
              if (moment?.type === "poll") {
                const st = pollState(moment);
                const winner = pollWinner(moment);
                const botPoll = isBot || msg.sender_id === null || msg.sender_id === "frimee";
                const mark = anadidos.get(msg.id);
                const planAction: PollPlanAction | null = !winner ? null
                  : mark ? { kind: "done", label: mark.tipo ? `En el plan · ${(MARK_TIPO[mark.tipo] ?? mark.tipo).toLowerCase()}` : "En el plan", onOpen: () => router.push(`/plans/${mark.plan_id}`) }
                  : puedePlan(msg) ? { kind: "add", label: planId ? "Añadir al plan" : `Crear plan a ${winner}`, onClick: () => addToPlan(msg) }
                  : null;
                // Spine (po-sistema): open = small outline; decided = filled; tie = hollow; no votes = grey.
                const spine = st === "abierta"
                  ? (moment.desempate_de != null
                    ? "left-[20px] top-[18px] size-[14px] rounded-[2px] border-2 border-[var(--primary)] bg-[var(--bg)]"
                    : "left-[23px] top-[10px] size-[9px] border border-[var(--primary)] bg-[var(--bg)]")
                  : st === "sin_votos" ? "left-[20px] top-[18px] size-[14px] rounded-[2px] border-2 border-[var(--text-secondary)] bg-[var(--bg)]"
                  : st === "empate" ? "left-[20px] top-[18px] size-[14px] rounded-[2px] border-2 border-[var(--primary)] bg-[var(--bg)]"
                  : "left-[20px] top-[18px] size-[14px] rounded-[2px] border-2 border-[var(--primary)] bg-[var(--primary)]";
                const who = isMe ? "Tú" : botPoll ? "Frimee" : msg.sender_nombre.split(" ")[0] || "Alguien";
                return (
                  <Fragment key={(msg)._key ?? msg.id}>
                    {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                    <article id={`msg-${msg.id}`} aria-label={`Encuesta de ${who}, ${msgTime}`} className={`group/msg relative pl-[56px] pr-[var(--space-4)] ${slot?.chapter ? "mt-[4px]" : "mt-[14px]"} ${highlight} ${rowHover}`}>
                      {hoverBar}
                      <span aria-hidden className={`absolute rotate-45 ${spine}`} />
                      <div className={`relative max-w-[560px] transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] ${lifted} outline-none`} {...gestureProps}>
                        <PollMoment
                          mensajeId={msg.id}
                          poll={moment}
                          author={who}
                          time={msgTime}
                          members={chat.miembros.map((m) => ({ id: m.id, nombre: m.id === currentUserId ? "Tú" : m.nombre }))}
                          currentUserId={currentUserId}
                          canManage={botPoll || isMe || iAmAdmin}
                          canDecide={isMe || iAmAdmin}
                          planAction={planAction}
                          onVoted={(idx, r) => {
                            if (r.cerrada) applyPollCierre(msg.id, r);
                            emitPollVote(msg.id);
                            void channelRef.current?.send({ type: "broadcast", event: "poll_vote", payload: { mensaje_id: msg.id, option_index: idx } });
                          }}
                          onChanged={(r) => {
                            applyPollCierre(msg.id, r);
                            emitPollVote(msg.id);
                          }}
                          onDesempate={(r) => {
                            replaceMsgTexto(msg.id, r.poll_texto);
                            if (r.ya_existia) jumpToMessageRef.current(r.mensaje_id);
                            else showMyServerMessage(r.mensaje_id, r.texto);
                          }}
                          onJumpTo={(id) => jumpToMessageRef.current(id)}
                          onRepeat={() => { void sendPollMessage(moment.question, moment.options); }}
                          drawHost={drawHost}
                        />
                      </div>
                      {reactionChip}
                    </article>
                  </Fragment>
                );
              }
              return (
                <Fragment key={(msg)._key ?? msg.id}>
                {slot?.chapter && <DayChapter id={`day-${msg.id}`} label={slot.chapter} />}
                {burstTimeRow && (
                  <div className={`pl-[56px] pr-[var(--space-4)] text-[12px] tabular-nums text-muted ${slot?.chapter ? "mt-[4px]" : "mt-[14px]"}`}>{msgTime}</div>
                )}
                {isMe ? (
                  <article id={`msg-${msg.id}`} aria-label={`Tú, ${msgTime}`} className={`group/msg relative pl-[56px] pr-[var(--space-4)] ${gapAbove} ${highlight} ${rowHover}`}>
                    {startsTurn && <span aria-hidden className="absolute left-[24px] top-[12px] size-[7px] rounded-full bg-[var(--primary)]" />}
                    <div className="flex flex-col items-end">
                      {/* Block and its reactions, aligned to the right edge. */}
                      <div className="flex max-w-full flex-col items-end">
                      <div className={`relative max-w-[min(286px,100%)] md:max-w-[min(420px,100%)] transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] ${lifted} outline-none`} {...gestureProps}>
                        {hoverBar}
                        {compactMine ? (
                          <div className="flex items-end gap-[8px] rounded-[8px] bg-[var(--chat-me-block)] px-[10px] py-[4px]">
                            {content}
                            {(checkHere || isStarred) && (
                              <span className="flex shrink-0 items-center gap-[4px] pb-[2px] text-[12px] tabular-nums text-muted">
                                {isStarred && <button type="button" onClick={(e) => { e.stopPropagation(); openStarred(); }} onPointerDown={(e) => e.stopPropagation()} aria-label="Ver tus destacados" title="Ver tus destacados" className="-m-[6px] rounded-[4px] p-[6px] hover:text-app">★</button>}
                                {timeHere && msgTime}
                                {checkHere && readMark}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className={isCard ? "" : `rounded-[8px] bg-[var(--chat-me-block)] ${msg.image_url ? "p-[4px]" : msg.audio_url ? "p-[8px]" : isRichContent ? "px-3 py-2" : "px-[12px] py-[8px]"}`}>
                            {replyQuote}
                            {content}
                            {!msg.image_url && (checkHere || isStarred) && (
                              <div className="mt-[2px] flex items-center justify-end gap-[4px] text-[12px] text-muted">
                                {isStarred && <button type="button" onClick={(e) => { e.stopPropagation(); openStarred(); }} onPointerDown={(e) => e.stopPropagation()} aria-label="Ver tus destacados" title="Ver tus destacados" className="-m-[6px] rounded-[4px] p-[6px] hover:text-app">★</button>}
                                {timeHere && <span className="tabular-nums">{msgTime}</span>}
                                {checkHere && readMark}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {reactionChip}
                      </div>
                    </div>
                  </article>
                ) : (
                  <article id={`msg-${msg.id}`} aria-label={`${isBot ? "Frimee, asistente" : msg.sender_nombre}, ${msgTime}`} className={`group/msg relative pl-[56px] pr-[var(--space-4)] ${showHeader ? gapAboveHeader : gapAbove} ${highlight} ${rowHover}`}>
                    {hoverBar}
                    {startsTurn && (
                      isBot ? (
                        // The brand square with the compass (design system: the mascot only in access,
                        // empty states and the cover).
                        <span aria-hidden className="absolute left-[13px] top-0 flex size-[28px] items-center justify-center overflow-hidden rounded-[6px]">
                          <NextImage src="/favicoon-frimee-green.svg" alt="" width={28} height={28} className="h-full w-full" />
                        </span>
                      ) : (
                        <span aria-hidden className="absolute left-[13px] top-0 flex size-[28px] items-center justify-center overflow-hidden rounded-full border border-app bg-[var(--surface-2)] text-[12px] font-[var(--fw-semibold)] text-app">
                          {msg.sender_profile_image ? <NextImage src={msg.sender_profile_image} alt="" width={28} height={28} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : (msg.sender_nombre[0] ?? "?").toUpperCase()}
                        </span>
                      )
                    )}
                    {showHeader && (
                      <div className="flex min-h-[20px] items-baseline gap-[8px] pt-[4px]">
                        {showName && <span className={`text-[13px] font-[var(--fw-semibold)] ${isBot ? "text-primary-token" : "text-app"}`}>{isBot ? "Frimee" : msg.sender_nombre}</span>}
                        {isBot && <span className="rounded-[4px] border border-app px-[6px] py-px text-[11px] font-[var(--fw-semibold)] text-muted">Asistente</span>}
                        {!inBurst && <span className="text-[12px] tabular-nums text-muted">{msgTime}</span>}
                        {isStarred && <span className="text-[12px] text-muted"><button type="button" onClick={(e) => { e.stopPropagation(); openStarred(); }} onPointerDown={(e) => e.stopPropagation()} aria-label="Ver tus destacados" title="Ver tus destacados" className="-m-[6px] rounded-[4px] p-[6px] hover:text-app">★</button></span>}
                      </div>
                    )}
                    <div className={`relative max-w-[640px] ${showHeader ? "mt-[4px]" : startsTurn ? "pt-[3px]" : ""} transition-transform duration-200 ease-[cubic-bezier(.2,0,0,1)] ${lifted} outline-none`} {...gestureProps}>
                      <div className={`${isBot ? "rounded-[8px] border border-dashed border-[var(--chat-me-border)] bg-[var(--surface-inset)] p-[12px]" : richFrame} ${msg.image_url ? "max-w-[min(286px,100%)]" : isRichContent ? "inline-block max-w-full" : ""}`}>
                        {replyQuote}
                        {content}
                      </div>
                    </div>
                    {reactionChip}
                  </article>
                )}
                </Fragment>
              );
            })}
            {detached && <div ref={bottomSentinelRef} className="h-px" />}
            {loadingNewer && (
              <div className="flex justify-center py-2">
                <div className="size-5 animate-spin rounded-full border-2 border-app border-t-transparent" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      {!loading && (
        <ChatRuler
          scrollRef={scrollContainerRef}
          marks={rulerMarks}
          total={rulerTotal}
          loadedFrom={loadedFrom}
          loadedCount={loadedCount}
          readOrd={indice?.primer_no_leido?.ord ?? null}
          onReveal={revealMessage}
        />
      )}
      {/* Jumping to an old stretch: loading rows on the spine, the day already titled. */}
      {jumping && (
        <div role="status" aria-label={`Cargando ${jumping.title}`} className="absolute inset-0 z-[5] overflow-hidden bg-[var(--bg)]">
          <div className="relative mx-auto h-full w-full max-w-[780px]">
            <div aria-hidden className="absolute bottom-0 left-[27px] top-0 w-px bg-[var(--border)]" />
            <DayChapter label={jumping} />
            {[72, 48, 88, 56, 64, 40].map((w, i) => (
              <div key={i} aria-hidden className={`relative pl-[56px] pr-[var(--space-4)] ${i === 0 ? "mt-[4px]" : "mt-[14px]"}`}>
                <span className="absolute left-[13px] top-0 size-[28px] rounded-full bg-[var(--surface-2)]" />
                <div className="h-[12px] w-[80px] animate-pulse rounded-[4px] bg-[var(--surface-2)] motion-reduce:animate-none" />
                <div className="mt-[8px] h-[14px] animate-pulse rounded-[4px] bg-[var(--surface-2)] motion-reduce:animate-none" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </div>
      )}
      {starToast && !addedToast && (
        <div role="status" className="absolute bottom-[12px] left-1/2 z-[7] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-[14px] rounded-[8px] border border-app bg-[var(--bg)] pl-[16px] pr-[8px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <span className="min-w-0 flex-1 truncate py-[12px] text-[14px] text-app">Mensaje destacado</span>
          <button type="button" onClick={openStarred} className="min-h-[44px] shrink-0 px-[4px] text-[14px] font-[var(--fw-semibold)] text-app underline underline-offset-[3px]">Ver destacados</button>
        </div>
      )}
      {addedToast && (
        <div role="status" className="absolute bottom-[12px] left-1/2 z-[7] flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-[14px] rounded-[8px] border border-app bg-[var(--bg)] pl-[16px] pr-[8px] shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <span className="min-w-0 flex-1 truncate py-[12px] text-[14px] text-app">Añadido a «{addedToast.planTitulo}»</span>
          <button type="button" onClick={() => router.push(`/plans/${addedToast.planId}?tab=itinerario`)} className="min-h-[44px] shrink-0 px-[4px] text-[14px] font-[var(--fw-semibold)] text-app underline underline-offset-[3px]">Ver</button>
          <button
            type="button"
            onClick={async () => {
              const t = addedToast;
              setAddedToast(null);
              try {
                await deshacerAnadirEndpoint(t.mensajeId);
                setMessages((prev) => prev.filter((x) => x.id !== t.mensajeId));
                void channelRef.current?.send({ type: "broadcast", event: "delete_message", payload: { id: t.mensajeId } });
              } catch (e) {
                logError("Error deshaciendo", e);
              }
            }}
            className="min-h-[44px] shrink-0 px-[4px] text-[14px] font-[var(--fw-semibold)] text-app underline underline-offset-[3px]"
          >
            Deshacer
          </button>
        </div>
      )}
      {!loading && !addedToast && (awayFromEnd || detached) && (
        <button
          type="button"
          onClick={() => void goToLatest()}
          className="absolute bottom-[12px] left-1/2 z-[6] flex h-[44px] -translate-x-1/2 items-center gap-[6px] whitespace-nowrap rounded-full bg-[var(--primary)] px-[16px] text-[14px] font-[var(--fw-semibold)] text-[var(--contrast)] shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-[16px]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></svg>
          Ir a lo último{newWhileAway > 0 ? ` · ${newWhileAway} ${newWhileAway === 1 ? "nuevo" : "nuevos"}` : ""}
        </button>
      )}
      </div>

      {/* Input area · in a 1 a 1 with someone I blocked, only the way back */}
      {blockedOther ? (
        <div className="px-[var(--space-3)] pb-[calc(env(safe-area-inset-bottom)+12px)] pt-[var(--space-2)] md:px-[var(--space-4)] md:pb-[var(--space-3)]">
          <p className="flex min-h-[48px] flex-wrap items-center justify-center gap-x-[4px] text-center text-[14px] text-muted">
            Has bloqueado a {blockedOther.nombre.split(" ")[0]} ·
            <button
              type="button"
              onClick={() => {
                setUnblockError(null);
                desbloquear(blockedOther.id).catch((e) => {
                  console.error("[chat] Error desbloqueando:", (e as { message?: string })?.message ?? String(e));
                  setUnblockError(typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. No se ha desbloqueado." : "No se ha desbloqueado. Inténtalo de nuevo.");
                });
              }}
              className="min-h-[44px] px-[4px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]"
            >
              Desbloquear
            </button>
          </p>
          {unblockError && <p role="alert" className="text-center text-[13px] text-[var(--error)]">{unblockError}</p>}
        </div>
      ) : (
      <div className="relative px-[var(--space-3)] pb-[calc(env(safe-area-inset-bottom)+12px)] pt-[var(--space-2)] md:px-[var(--space-4)] md:pb-[var(--space-3)]">
        {cerrarOpen && (
          <div id="cerrar-lista" role="listbox" aria-label="Encuestas abiertas" className="absolute inset-x-[8px] bottom-full z-[8] mb-[6px] max-h-[50vh] overflow-y-auto rounded-[8px] border border-app bg-[var(--bg)] p-[4px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] md:inset-x-[var(--space-4)] md:max-w-[560px]">
            <p className="px-[10px] py-[6px] text-[12px] text-muted">/cerrar · cierra una encuesta y muestra el resultado</p>
            {cerrarOptions.map(({ msg: m, poll: p }, i) => (
              <div
                key={m.id}
                id={`cerrar-${m.id}`}
                role="option"
                aria-selected={i === cerrarActive}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setCerrarActive(i)}
                onClick={() => void closeFromCommand(m)}
                className={`flex min-h-[52px] cursor-pointer items-center gap-[10px] rounded-[6px] px-[10px] py-[6px] ${i === cerrarActive ? "bg-[var(--surface-2)]" : ""}`}
              >
                <BarChart2 className="size-[18px] shrink-0 text-muted" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-[var(--fw-semibold)] text-app">{p.question}</p>
                  <p className="text-[12px] tabular-nums text-muted">{cerrarTally(m.id, p)}</p>
                </div>
                {i === cerrarActive && <span className="hidden text-[12px] text-muted md:inline">Intro</span>}
              </div>
            ))}
          </div>
        )}
        {ephemeral && (
          <div role="status" className="mb-[var(--space-2)] flex items-start gap-[8px] rounded-[8px] border border-dashed border-[var(--border-strong)] bg-[var(--bg)] py-[10px] pl-[12px] pr-[4px] text-[14px] leading-[1.4] text-app">
            <Info className="mt-[1px] size-[16px] shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line">{ephemeral}</p>
              <p className="text-[12px] text-muted">Solo lo ves tú</p>
            </div>
            <button type="button" onClick={() => setEphemeral(null)} aria-label="Cerrar aviso" title="Cerrar aviso" className="-my-[6px] flex size-[36px] shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)]"><X className="size-[16px]" aria-hidden /></button>
          </div>
        )}
        {sendError && (
          <div role="alert" className="mb-[var(--space-2)] flex items-center gap-[8px] px-1 text-[13px] text-[var(--error)]">
            <span className="min-w-0 flex-1">{sendError.text}</span>
            {sendError.retry && (
              <button type="button" onClick={() => { const r = sendError.retry; setSendError(null); r?.(); }} className="min-h-[44px] shrink-0 px-[4px] font-[var(--fw-semibold)] text-app underline underline-offset-[3px]">Reintentar</button>
            )}
            <button type="button" onClick={() => setSendError(null)} aria-label="Cerrar el aviso" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)]"><X className="size-[16px]" aria-hidden /></button>
          </div>
        )}
        {audioError && !isRecording && (
          <p role="status" className="mb-[var(--space-2)] px-1 text-[13px] text-muted">{audioError}</p>
        )}
        {replyingTo && (
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] rounded-[10px] border-l-2 border-[var(--text-primary)] bg-surface px-3 py-[8px]">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-[var(--fw-semibold)] text-[var(--text-primary)]">{replyingTo.sender_nombre || "Tú"}</p>
              <p className="truncate text-[14px] text-muted">
                {momentPreview(replyingTo.texto) ?? replyingTo.texto}
              </p>
            </div>
            <button type="button" onClick={cancelReply} className="shrink-0 text-muted transition-colors hover:text-app">
              <X className="size-[16px]" />
            </button>
          </div>
        )}
        {showAiHints && (
          <div
            role="group"
            aria-label="Sugerencias para el asistente @frimee"
            className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] overflow-x-auto"
          >
            <Sparkles className="size-4 shrink-0 text-primary-token" aria-hidden />
            {AI_SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={sending}
                onClick={() => void onSend(s.prompt)}
                className="shrink-0 rounded-full border border-app bg-surface px-3 py-[6px] text-[14px] text-app transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={dismissAiHints}
              aria-label="Ocultar sugerencias"
              className="ml-auto flex size-8 shrink-0 items-center justify-center text-muted transition-colors hover:text-app"
            >
              <X className="size-[16px]" />
            </button>
          </div>
        )}
        {editingMsg && (
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] rounded-[10px] border-l-2 border-blue-500 bg-surface px-3 py-[8px]">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-[var(--fw-semibold)] text-blue-400">Editando mensaje</p>
              <p className="truncate text-[14px] text-muted">{editingMsg.texto}</p>
            </div>
            <button type="button" onClick={cancelEdit} className="shrink-0 text-muted transition-colors hover:text-app">
              <X className="size-[16px]" />
            </button>
          </div>
        )}
        <div className="relative flex items-center gap-[var(--space-2)]">
          {/* Inputs ocultos */}
          <input ref={docInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendDocument(f); e.target.value = ""; }} />
          <input ref={mediaInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendMedia(f); e.target.value = ""; }} />
          <input ref={audioFileInputRef} type="file" className="hidden" accept="audio/*,.mp3,.m4a,.ogg,.wav,.aac,.flac" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendAudioFile(f); e.target.value = ""; }} />

          {/* Single input container */}
          <div className="flex min-h-[44px] min-w-0 flex-1 items-center gap-1 rounded-full bg-[var(--surface-2)] px-2">
            {isRecording ? (
              <>
                <span className="mx-1 size-2 shrink-0 animate-pulse rounded-full bg-red-500" />
                <span className="shrink-0 text-body-sm text-red-400">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                {recordHold && !recordHold.locked ? (
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2 px-1 text-body-sm text-muted" role="status">
                    <span className="truncate" style={{ transform: `translateX(${recordHold.dx / 2}px)`, opacity: Math.max(0.3, 1 + recordHold.dx / 120) }}>‹ Desliza para cancelar</span>
                    <span className="shrink-0" aria-label="Desliza hacia arriba para bloquear">↑ Bloquear</span>
                  </span>
                ) : (
                  <>
                    <span className="flex-1 px-1 text-body-sm text-muted">Grabando...</span>
                    <ChatIconButton label="Cancelar grabación" size="sm" tone="danger" onClick={handleCancelRecording}>
                      <X className="size-4" />
                    </ChatIconButton>
                    <ChatIconButton label="Enviar nota de voz" size="sm" tone="primary" onClick={handleSendRecording}>
                      <SendMsgIcon className="size-4" />
                    </ChatIconButton>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="relative shrink-0" ref={emojiContainerRef}>
                  <ChatIconButton
                    label="Abrir selector de emojis"
                    size="sm"
                    onClick={() => setShowEmojiPicker((v) => !v)}
                    aria-expanded={showEmojiPicker}
                    aria-haspopup="dialog"
                  >
                    <EmojiIcon className="size-5" />
                  </ChatIconButton>
                  {showEmojiPicker && (
                    <div className="absolute bottom-[calc(100%+8px)] left-0 z-50 max-w-[calc(100vw-32px)]">
                      <EmojiMartPicker
                        data={async () => {
                          const res = await fetch("https://cdn.jsdelivr.net/npm/@emoji-mart/data");
                          return res.json();
                        }}
                        onEmojiSelect={handleEmojiSelect}
                        locale="es"
                        theme="auto"
                        set="native"
                        previewPosition="none"
                        skinTonePosition="search"
                      />
                    </div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  role={cerrarOpen ? "combobox" : undefined}
                  aria-expanded={cerrarOpen ? true : undefined}
                  aria-controls={cerrarOpen ? "cerrar-lista" : undefined}
                  aria-activedescendant={cerrarOpen ? `cerrar-${cerrarOptions[Math.min(cerrarActive, cerrarOptions.length - 1)]?.msg.id}` : undefined}
                  placeholder={editingMsg ? "Editar mensaje..." : planId ? "Escribe un mensaje o pregunta a @frimee..." : "Escribe un mensaje..."}
                  aria-label={editingMsg ? "Editar mensaje" : "Escribir mensaje"}
                  className="min-w-0 flex-1 bg-transparent py-[10px] text-[15px] text-app outline-none placeholder:text-muted"
                />
                {!text.trim() && (
                  <>
                    <ChatIconButton
                      label="Mantén para grabar una nota de voz"
                      size="sm"
                      className="touch-none select-none"
                      onPointerDown={onMicPointerDown}
                      onContextMenu={(e) => e.preventDefault()}
                      onClick={() => {
                        // Touch already recorded on hold; mouse and keyboard start on click.
                        if (micPointerTypeRef.current === "touch" || micPointerTypeRef.current === "pen") return;
                        void handleStartRecording();
                      }}
                    >
                      <MicIcon className="size-5" />
                    </ChatIconButton>
                    <div className="relative shrink-0">
                      <ChatIconButton
                        label="Abrir opciones de adjuntar"
                        size="sm"
                        onClick={() => setShowAttachMenu((v) => !v)}
                        aria-expanded={showAttachMenu}
                        aria-haspopup="menu"
                      >
                        <AttachPlusIcon className="size-5" />
                      </ChatIconButton>
                      {showAttachMenu && (
                        <div
                          className="absolute bottom-[44px] right-0 z-50 min-w-[180px] overflow-hidden rounded-[14px] border border-app bg-app shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
                          role="menu"
                          aria-label="Opciones de adjuntar"
                        >
                          {[
                            { icon: <DocIcon className="size-[18px]" />, label: "Documento", color: "text-purple-400", onClick: () => { setShowAttachMenu(false); docInputRef.current?.click(); } },
                            { icon: <PhotoVideoIcon className="size-[18px]" />, label: "Fotos y videos", color: "text-blue-400", onClick: () => { setShowAttachMenu(false); const i = mediaInputRef.current; if (!i) return; i.removeAttribute("capture"); i.click(); } },
                            { icon: <CameraIcon className="size-[18px]" />, label: "Cámara", color: "text-red-400", onClick: () => { setShowAttachMenu(false); setShowCamera(true); } },
                            { icon: <AudioFileIcon className="size-[18px]" />, label: "Audio", color: "text-orange-400", onClick: () => { setShowAttachMenu(false); audioFileInputRef.current?.click(); } },
                            { icon: <PollIcon className="size-[18px]" />, label: "Encuesta", color: "text-green-400", onClick: () => { setShowAttachMenu(false); setShowPollCreator(true); } },
                            { icon: <MapPin className="size-[18px]" />, label: "Ubicación", color: "text-[var(--chat-accent-text)]", onClick: () => { setShowAttachMenu(false); setAttachSheet("lugar"); } },
                            ...(planId ? [{ icon: <Receipt className="size-[18px]" />, label: "Gasto", color: "text-[var(--chat-accent-text)]", onClick: () => { setShowAttachMenu(false); setAttachSheet("gasto"); } }] : []),
                            // Inviting only makes sense outside the plan's own chat.
                            ...(!planId ? [{ icon: <CalendarDays className="size-[18px]" />, label: "Invitar a un plan", color: "text-[var(--chat-accent-text)]", onClick: () => { setShowAttachMenu(false); setAttachSheet("plan"); } }] : []),
                          ].map(({ icon, label, color, onClick }) => (
                            <button
                              key={label}
                              type="button"
                              role="menuitem"
                              aria-label={label}
                              onClick={onClick}
                              className="flex w-full items-center gap-[var(--space-3)] px-4 py-[11px] text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring-color)]"
                            >
                              <span className={color}>{icon}</span>
                              <span className="text-body-sm text-app">{label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {text.trim() && (
                  <ChatIconButton
                    label="Enviar mensaje"
                    size="sm"
                    tone="primary"
                    onClick={() => void onSend()}
                    disabled={sending}
                  >
                    <SendMsgIcon className="size-5" />
                  </ChatIconButton>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
    {/* Desktop (board gi-d-grupo): next to the chat from 1280 px; over its right side below that. */}
    {showInfo && !isPhone && (
      <div className="absolute inset-y-0 right-0 z-30 shadow-[0_8px_32px_rgba(0,0,0,0.3)] xl:static xl:shadow-none">
        {infoPanel("aside")}
      </div>
    )}
    </div>
  );
}

const EmojiIcon = Smile;
const PinIcon = Pin;
const CameraIcon = Camera;
const PhotoVideoIcon = Video;
const AudioFileIcon = Music;
const PollIcon = BarChart2;
const AttachPlusIcon = PlusCircle;
const MicIcon = Mic;
const DocIcon = File;
const SendMsgIcon = LucideSend;

export function ComposeIcon({ className = "size-icon" }: { className?: string }) {
  return <Edit className={className} aria-hidden />;
}

export function BackIcon({ className = "size-icon" }: { className?: string }) {
  return <ChevronLeft className={className} aria-hidden />;
}

export function GroupIcon({ className = "size-icon" }: { className?: string }) {
  return <Users className={className} aria-hidden />;
}


function MediaBubble({ url, type, sending, time, isMe, onOpenLightbox }: { url: string; type: string; sending?: boolean; time: string; isMe: boolean; onOpenLightbox?: () => void }) {
  const isVideo = type.startsWith("video/");
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative overflow-hidden rounded-card border border-app/50 bg-transparent" style={{ maxWidth: 220 }}>
      {isVideo ? (
        <video src={url} controls={!sending} playsInline className="block w-full rounded-card" style={{ maxHeight: 300 }} />
      ) : (
        <button type="button" onClick={!sending && onOpenLightbox ? onOpenLightbox : undefined} className="block w-full text-left cursor-pointer" tabIndex={sending ? -1 : 0}>
          {!loaded && <div className="skeleton-shimmer rounded-card" style={{ width: 220, height: 165 }} />}
          <NextImage
            src={url}
            alt="Imagen"
            width={220}
            height={165}
            className="block w-full rounded-card object-cover"
            style={{ maxHeight: 300, opacity: loaded ? 1 : 0, transition: "opacity 0.2s", ...(loaded ? {} : { position: "absolute", pointerEvents: "none" }) }}
            referrerPolicy="no-referrer"
            unoptimized
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
          />
        </button>
      )}
      {time && (
        <div className={`pointer-events-none absolute bottom-2 right-2 rounded-chip bg-black/58 px-2 py-1 text-[14px] leading-none text-white backdrop-blur-sm ${isMe ? "border border-white/10" : "border border-black/10"}`}>
          {time}
        </div>
      )}
      {sending && (
        <div className="absolute inset-0 rounded-card overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0 rounded-card"
            style={{
              backgroundColor: "rgba(0,0,0,0.45)",
              transformOrigin: "right center",
              animation: "upload-fill 3s ease-out forwards",
            }}
          />
          <style>{`@keyframes upload-fill { from { transform: scaleX(1); } to { transform: scaleX(0.05); } }`}</style>
        </div>
      )}
    </div>
  );
}

/** «En el plan · actividad»: the type the poll's winner was added as (AddToPlanPanel's types). */
const MARK_TIPO: Record<string, string> = {
  ACTIVIDAD: "Actividad", RESTAURANTE: "Restaurante", HOTEL: "Alojamiento", VUELO: "Vuelo",
  TREN: "Tren", BUS: "Autobús", BARCO: "Barco", COCHE: "Coche", OTRO: "Otro",
};

function isPollMessage(texto: string): boolean {
  try { return JSON.parse(texto)?.type === "poll"; } catch { return false; }
}

function DocumentBubble({ url, name, sending }: { url: string; name: string; sending?: boolean }) {
  const ext = name.split(".").pop()?.toUpperCase() ?? "DOC";
  const extColors: Record<string, string> = { PDF: "#E44", DOCX: "#2B7CD3", DOC: "#2B7CD3", XLSX: "#217346", XLS: "#217346", PPTX: "#D24726", PPT: "#D24726", TXT: "#888", CSV: "#217346", ZIP: "#F90", RAR: "#F90" };
  const color = extColors[ext] ?? "#888";

  return (
    <a
      href={sending ? undefined : url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex w-[220px] items-center gap-[10px] rounded-[10px] py-[2px] transition-opacity ${sending ? "pointer-events-none opacity-60" : "hover:opacity-80"}`}
    >
      {/* Icono con extensión */}
      <div className="flex size-[40px] shrink-0 flex-col items-center justify-center rounded-[8px] text-white" style={{ backgroundColor: color }}>
        <span className="text-[9px] font-bold leading-none">{ext.slice(0, 4)}</span>
      </div>
      {/* Nombre */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium leading-tight">{name}</p>
        <p className="text-[14px] opacity-60">{sending ? "Subiendo..." : "Toca para abrir"}</p>
      </div>
      {/* Flecha descarga */}
      {!sending && (
        <Download className="size-[16px] shrink-0 opacity-50" aria-hidden />
      )}
    </a>
  );
}

export function PhoneCallIcon({ className = "size-icon" }: { className?: string }) {
  return <Phone className={className} aria-hidden />;
}

export function VideoCallIcon({ className = "size-icon" }: { className?: string }) {
  return <Video className={className} aria-hidden />;
}

/** «Eliminar» on a message: for everyone (mine, or an admin's with anyone's) and/or only for me. */
function DeleteMessageSheet({ msg, forAll, onClose, onDelete }: {
  msg: MensajeRow;
  forAll: boolean;
  onClose: () => void;
  onDelete: (paraTodos: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState<null | "todos" | "mi">(null);
  const [error, setError] = useState<string | null>(null);
  const preview = parseMoment(msg.texto)?.type === "eliminado" ? null
    : msg.audio_url ? "Nota de voz" : msg.document_url ? (msg.document_name ?? "Documento")
    : msg.image_url ? (msg.image_type?.startsWith("video/") ? "Vídeo" : "Foto")
    : momentPreview(msg.texto) ?? msg.texto;
  const run = async (paraTodos: boolean) => {
    if (busy) return;
    setBusy(paraTodos ? "todos" : "mi");
    setError(null);
    try {
      await onDelete(paraTodos);
    } catch (e) {
      console.error("[chat] Error eliminando:", (e as { message?: string })?.message ?? String(e));
      setError(typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. No se ha eliminado." : "No se ha eliminado. Inténtalo de nuevo.");
      setBusy(null);
    }
  };
  const danger = "min-h-[46px] w-full rounded-[8px] px-[16px] text-[15px] font-[var(--fw-semibold)] disabled:opacity-60";
  return (
    <Sheet title="¿Eliminar el mensaje?" onClose={busy ? () => {} : onClose} maxWidth={400}
      footer={(
        <div className="flex flex-col gap-[8px]">
          {forAll && (
            <button type="button" onClick={() => void run(true)} disabled={Boolean(busy)} className={`${danger} bg-[var(--error)] text-[var(--bg)] hover:opacity-90`}>
              {busy === "todos" ? "Eliminando…" : "Eliminar para todos"}
            </button>
          )}
          <button type="button" onClick={() => void run(false)} disabled={Boolean(busy)} className={`${danger} border border-[var(--error)] text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)]`}>
            {busy === "mi" ? "Eliminando…" : "Eliminar para mí"}
          </button>
          <button type="button" onClick={onClose} disabled={Boolean(busy)} className="min-h-[46px] w-full rounded-[8px] border border-app px-[16px] text-[15px] font-[var(--fw-semibold)] text-app hover:bg-[var(--surface-2)] disabled:opacity-50">Cancelar</button>
        </div>
      )}
    >
      {preview && <p className="line-clamp-3 rounded-[8px] bg-[var(--surface-2)] px-[12px] py-[8px] text-[14px] text-app">{preview}</p>}
      {error && <p role="alert" className="mt-[8px] text-[13px] text-[var(--error)]">{error}</p>}
    </Sheet>
  );
}

