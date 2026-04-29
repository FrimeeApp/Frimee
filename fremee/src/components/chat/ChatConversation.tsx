"use client";

import NextImage from "next/image";
import { useEffect, useRef, useState, useCallback } from "react";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import {
  listChats,
  addChatMember,
  editMensaje,
  getChatMiembros,
  deleteMensaje,
  listMensajes,
  sendMensaje,
  sendBotMensaje,
  markChatRead,
  reactMensaje,
  getMyReacciones,
  pollVote,
  pollGetVotes,
  resolveChatName,
  resolveChatAvatar,
  leaveChat,
  updateChatFoto,
  formatChatTime,
  type ChatListItem,
  type MensajeRow,
} from "@/services/api/repositories/chat.repository";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { closePollEndpoint } from "@/services/api/endpoints/chat.endpoint";
import { uploadPlanCoverFile, uploadAudioBlob, uploadAudioFile, uploadDocumentFile, uploadMediaFile } from "@/services/firebase/upload";
import AudioPlayer from "@/components/common/AudioPlayer";
import { CameraModal } from "@/components/chat/CameraModal";
import { PollCreatorModal } from "@/components/chat/PollCreatorModal";
import { PLAN_WRITE_COMMANDS, VALID_TASK_CATEGORIES } from "@/components/chat/chat.constants";
import { crearTareaEndpoint, misTareasEndpoint, todasTareasEndpoint, updateEstadoTareaEndpoint, recordarEndpoint, type TareaRow } from "@/services/api/endpoints/tareas.endpoint";
import { createGastoEndpoint, getBalancesForPlanEndpoint } from "@/services/api/endpoints/gastos.endpoint";
import { promoteToAdminEndpoint, demoteAdminEndpoint, kickMemberEndpoint, leavePlanEndpoint } from "@/services/api/endpoints/plans.endpoint";
import { callFrimeeAssistant, type FrimeeHistoryEntry } from "@/services/api/endpoints/frimee.endpoint";
import {
  Trash2, Ban, AlertTriangle, LogOut, ChevronDown, Pencil, Reply, Copy,
  Smile, Forward, Pin, Star, Camera, Send as LucideSend, PlusCircle, Mic,
  File, Video, Music, BarChart2, Edit, ChevronLeft, ChevronRight, Users,
  Phone, Check, Download, X, Plus,
} from "lucide-react";

export function ChatConversation({
  chat,
  currentUserId,
  onBack,
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
}: {
  chat: ChatListItem;
  currentUserId: string;
  onBack: () => void;
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
  onAbrirActividad?: (titulo: string) => void;
  onLeave?: () => void;
  onMembersChanged?: () => void;
}) {
  type LocalMsg = MensajeRow & { _key?: number };
  const [messages, setMessages] = useState<LocalMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const oldestIdRef = useRef<number | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingTaskListRef = useRef<TareaRow[]>([]);
  type PendingGasto = { planId: number; titulo: string; total: number; pagadoPorId: string; pagadoPorNombre: string; participantes: { user_id: string; nombre: string }[] };
  const pendingGastoRef = useRef<PendingGasto | null>(null);
  type PendingPollWinner = { planId: number; winnerOption: string; question: string };
  const pendingPollWinnerRef = useRef<PendingPollWinner | null>(null);
  type PendingAiVotar = { pollTexto: string; botReply: string };
  const pendingAiVotarRef = useRef<PendingAiVotar | null>(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ msg: MensajeRow; x: number; y: number; triggerTop: number } | null>(null);
  const [replyingTo, setReplyingTo] = useState<MensajeRow | null>(null);
  const [editingMsg, setEditingMsg] = useState<MensajeRow | null>(null);
  const [reactingToId, setReactingToId] = useState<number | null>(null);
  const [reactingPos, setReactingPos] = useState<{ x: number; y: number } | null>(null);
  const [localReactions, setLocalReactions] = useState<Record<number, string>>({});
  const [starredIds, setStarredIds] = useState<Set<number>>(new Set());
  const [pinnedId, setPinnedId] = useState<number | null>(null);
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [forwardMsg, setForwardMsg] = useState<MensajeRow | null>(null);
  const [forwardChats, setForwardChats] = useState<ChatListItem[]>([]);
  const [forwardSending, setForwardSending] = useState<string | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [, setAudioError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sentMsgIdsRef = useRef<Set<number>>(new Set());
  const supabaseRef = useRef(createBrowserSupabaseClient());
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; });

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
    const ch = sb.channel(`llamadas-grupo-${chat.chat_id}`)
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
    void (async () => {
      try {
        const [data, reacciones] = await Promise.all([
          listMensajes({ chatId: chat.chat_id, limit: 50 }),
          getMyReacciones(chat.chat_id),
        ]);
        setMessages(data);
        if (data.length > 0) oldestIdRef.current = data[0].id;
        setHasMore(data.length === 50);
        const reaccionesMap: Record<number, string> = {};
        for (const r of reacciones) {
          reaccionesMap[r.mensaje_id] = r.emoji;
        }
        setLocalReactions(reaccionesMap);
      } catch (e) {
        console.error("[chat] Error cargando mensajes:", e);
      } finally {
        setLoading(false);
      }
    })();
    void markChatRead(chat.chat_id);
  }, [chat.chat_id, currentUserId, onLeave]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    const channel = supabase
      .channel(`msg:${chat.chat_id}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        const msg = payload as MensajeRow;
        if (sentMsgIdsRef.current.has(msg.id)) {
          sentMsgIdsRef.current.delete(msg.id);
          return;
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        onNewMessageRef.current(msg);
        void markChatRead(chat.chat_id);
      })
      .on("broadcast", { event: "edit_message" }, ({ payload }) => {
        const { id, texto } = payload as { id: number; texto: string };
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, texto } : m)));
      })
      .on("broadcast", { event: "delete_message" }, ({ payload }) => {
        const { id } = payload as { id: number };
        setMessages((prev) => prev.filter((m) => m.id !== id));
      })
      .on("broadcast", { event: "kick_member" }, ({ payload }) => {
        const { user_id } = payload as { user_id: string };
        if (user_id === currentUserId) onLeave?.();
      })
      .on("broadcast", { event: "poll_vote" }, ({ payload }) => {
        const { mensaje_id } = payload as { mensaje_id: number; option_index: number };
        emitPollVote(mensaje_id);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `chat_id=eq.${chat.chat_id}` },
        (payload) => {
          const msg = payload.new as MensajeRow;
          if (!msg.tipo?.startsWith("call_")) return; // solo registros de llamada
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
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [chat.chat_id, currentUserId, onLeave]);

  const isNearBottomRef = useRef(true);
  const observerReadyRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    setMessages([]);
    setLoadingMore(false);
    setHasMore(true);
    oldestIdRef.current = null;
    isNearBottomRef.current = true;
    observerReadyRef.current = false;
  }, [chat.chat_id]);

  useEffect(() => {
    if (loading) return;
    if (!observerReadyRef.current) {
      // Primera carga: saltar al fondo instantáneamente
      const container = scrollContainerRef.current;
      if (container) container.scrollTop = container.scrollHeight;
      // Activar observer después de un tick para que el scroll esté asentado
      setTimeout(() => { observerReadyRef.current = true; }, 100);
    } else if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

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
    if (reactingToId === null) return;
    const close = () => { setReactingToId(null); setReactingPos(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [reactingToId]);

  const closeOverlays = () => { setContextMenu(null); setReactingToId(null); setReactingPos(null); setShowAttachMenu(false); };

  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(msgId);
    setTimeout(() => setHighlightedId(null), 1500);
  };
  const cancelEdit = () => { setEditingMsg(null); setText(""); };
  const cancelReply = () => setReplyingTo(null);

  const getFreshMembers = async (): Promise<typeof chat.miembros> => {
    try {
      const fresh = await getChatMiembros(chat.chat_id);
      return fresh.map((m) => ({ id: m.user_id, nombre: m.nombre, username: null, profile_image: m.profile_image }));
    } catch {
      return chat.miembros;
    }
  };

  const CATEGORIAS_VALIDAS = VALID_TASK_CATEGORIES;

  const isPlanFinished = planInfo?.fin_at ? new Date(planInfo.fin_at) < new Date() : false;

  const fmtEstado = (e: string) =>
    ({ hecho: "Hecho", pendiente: "Pendiente", en_progreso: "En progreso" }[e] ?? e);

  const WRITE_COMMANDS = PLAN_WRITE_COMMANDS;

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
        for (const b of meDeben) lines.push(`  ${b.from_nombre ?? "Alguien"} te debe ${b.importe.toFixed(2)}€`);
        for (const b of debo) lines.push(`  Debes ${b.importe.toFixed(2)}€ a ${b.to_nombre ?? "Alguien"}`);

        const total = meDeben.reduce((s, b) => s + b.importe, 0) - debo.reduce((s, b) => s + b.importe, 0);
        lines.push(`  Balance total: ${total >= 0 ? "+" : ""}${total.toFixed(2)}€`);
        return lines.join("\n");
      } catch {
        return "No pude obtener tu saldo, inténtalo de nuevo.";
      }
    }

    if (name === "deudas") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      try {
        const balances = await getBalancesForPlanEndpoint(planId);
        if (balances.length === 0) return "No hay deudas pendientes en este plan.";
        const lines = ["Deudas del plan:", ...balances.map((b) => `  ${b.from_nombre ?? "?"} → ${b.to_nombre ?? "?"}: ${b.importe.toFixed(2)}€`)];
        return lines.join("\n");
      } catch {
        return "No pude obtener las deudas, inténtalo de nuevo.";
      }
    }

    if (name === "simplificar") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";
      try {
        const balances = await getBalancesForPlanEndpoint(planId);
        if (balances.length === 0) return "No hay deudas pendientes en este plan.";

        // Calcular balance neto por persona
        const net = new Map<string, { nombre: string; balance: number }>();
        for (const b of balances) {
          if (!net.has(b.from_user_id)) net.set(b.from_user_id, { nombre: b.from_nombre ?? "?", balance: 0 });
          if (!net.has(b.to_user_id)) net.set(b.to_user_id, { nombre: b.to_nombre ?? "?", balance: 0 });
          net.get(b.from_user_id)!.balance -= b.importe;
          net.get(b.to_user_id)!.balance += b.importe;
        }

        // Separar acreedores y deudores
        const creditors: { nombre: string; amount: number }[] = [];
        const debtors: { nombre: string; amount: number }[] = [];
        for (const [, v] of net) {
          if (v.balance > 0.01) creditors.push({ nombre: v.nombre, amount: v.balance });
          else if (v.balance < -0.01) debtors.push({ nombre: v.nombre, amount: -v.balance });
        }
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        // Algoritmo greedy: emparejar mayor acreedor con mayor deudor
        const transfers: string[] = [];
        while (creditors.length > 0 && debtors.length > 0) {
          const creditor = creditors[0];
          const debtor = debtors[0];
          const amount = Math.min(creditor.amount, debtor.amount);
          transfers.push(`  ${debtor.nombre} → ${creditor.nombre}: ${amount.toFixed(2)}€`);
          creditor.amount -= amount;
          debtor.amount -= amount;
          if (creditor.amount < 0.01) creditors.shift();
          if (debtor.amount < 0.01) debtors.shift();
        }

        if (transfers.length === 0) return "No hay deudas pendientes en este plan.";
        const saved = balances.length - transfers.length;
        const header = saved > 0
          ? `Deudas simplificadas (${transfers.length} transferencia${transfers.length !== 1 ? "s" : ""} en vez de ${balances.length}):`
          : `Deudas del plan (${transfers.length} transferencia${transfers.length !== 1 ? "s" : ""}):`;
        return [header, ...transfers].join("\n");
      } catch {
        return "No pude simplificar las deudas, inténtalo de nuevo.";
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

      const porPersona = (total / participantes.length).toFixed(2);
      const nombresParticipantes = participantes.map((p) => p.nombre).join(", ");

      pendingGastoRef.current = { planId, titulo: concepto, total, pagadoPorId: pagador.user_id, pagadoPorNombre: pagador.nombre, participantes };

      return [
        `Confirmar gasto:`,
        `${concepto.charAt(0).toUpperCase() + concepto.slice(1)} · ${total}€`,
        `Pago: ${pagador.nombre}`,
        `Divide entre: ${nombresParticipantes} (${porPersona}€ cada uno)`,
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
          "/simplificar — calcular las mínimas transferencias para saldar todo",
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

      const options = restParts;
      if (options.length < 2) return "Indica al menos dos opciones. Ej: /votar ¿Vamos al Coliseo? Sí No";

      const texto = JSON.stringify({ type: "poll", question, options, expires_at: expiresAt });
      const me = chat.miembros.find((m) => m.id === currentUserId);
      const tempId = -Date.now();
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
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
        setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
        onNewMessageRef.current(realMsg);
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        return "No pude crear la votación, inténtalo de nuevo.";
      }
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
        await pollVote(pollMsg.id, optionIdx);
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
        void channelRef.current?.send({ type: "broadcast", event: "rol_change", payload: { user_id: target.id, rol: "ADMIN" } });
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
        void channelRef.current?.send({ type: "broadcast", event: "rol_change", payload: { user_id: target.id, rol: "PARTICIPANTE" } });
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
        const result = await kickMemberEndpoint(planId, target.id);
        if (result === "not_admin") return "Solo los admins pueden expulsar miembros.";
        if (result === "cannot_kick_self") return "No puedes expulsarte a ti mismo.";
        if (result === "cannot_kick_owner") return "No puedes expulsar al creador del plan.";
        if (result === "target_not_member") return `${target.nombre} no está en este plan.`;
        void channelRef.current?.send({ type: "broadcast", event: "kick_member", payload: { user_id: target.id } });
        onMembersChanged?.();
        return `${target.nombre} ha sido expulsado del plan.`;
      } catch {
        return "No pude expulsar al usuario, inténtalo de nuevo.";
      }
    }

    if (name === "salir") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      try {
        const result = await leavePlanEndpoint(planId);
        if (result === "not_member") return "No eres miembro de este plan.";
        if (result === "owner_cannot_leave") return "El creador del plan no puede abandonarlo.";
        if (result === "last_admin") return "Eres el único admin. Promueve a otro miembro con /admin @usuario antes de salir.";
        onLeave?.();
        return "";
      } catch {
        return "No pude abandonar el plan, inténtalo de nuevo.";
      }
    }

    if (name === "cerrar") {
      if (!planId) return "Este comando solo está disponible en el chat de un plan.";

      const openPolls = messages
        .filter((m) => m.texto && isPollMessage(m.texto) && m.id > 0)
        .map((m) => ({ msg: m, poll: JSON.parse(m.texto) as { question: string; options: string[]; expires_at?: string; closed?: boolean } }))
        .filter(({ poll }) => !poll.closed);

      if (openPolls.length === 0) return "No hay ninguna votación activa en este plan.";

      let targetPoll: typeof openPolls[0];
      if (openPolls.length === 1) {
        targetPoll = openPolls[0];
      } else {
        const numStr = parts[1];
        if (!numStr) {
          const lines = ["Hay varias votaciones activas. Indica cuál cerrar con /cerrar [n]:"];
          openPolls.forEach(({ poll }, i) => lines.push(`  ${i + 1}. ${poll.question}`));
          return lines.join("\n");
        }
        const num = parseInt(numStr, 10);
        if (isNaN(num) || num < 1 || num > openPolls.length)
          return `Indica un número entre 1 y ${openPolls.length}.`;
        targetPoll = openPolls[num - 1];
      }

      const { msg: pollMsg, poll } = targetPoll;

      const isBotPoll = pollMsg.sender_id === "frimee" || pollMsg.sender_id === null;
      if (!isBotPoll && pollMsg.sender_id !== currentUserId && !isAdmin)
        return "Solo el creador de la votación o un admin puede cerrarla.";

      let votesData: Awaited<ReturnType<typeof pollGetVotes>> = [];
      try {
        votesData = await pollGetVotes(pollMsg.id);
      } catch {
        return "No pude obtener los votos, inténtalo de nuevo.";
      }

      const votesMap: Record<number, number> = {};
      for (const row of votesData) votesMap[row.option_index] = Number(row.vote_count);
      const totalVotes = Object.values(votesMap).reduce((a, b) => a + b, 0);

      const closedTexto = JSON.stringify({ ...poll, closed: true });
      try {
        await closePollEndpoint(pollMsg.id);
        setMessages((prev) => prev.map((m) => m.id === pollMsg.id ? { ...m, texto: closedTexto } : m));
        void channelRef.current?.send({ type: "broadcast", event: "edit_message", payload: { id: pollMsg.id, texto: closedTexto } });
      } catch (err) {
        console.error("[cerrar] fn_poll_close error:", err);
        return "No pude cerrar la votación, inténtalo de nuevo.";
      }

      const sortedOptions = poll.options
        .map((opt, idx) => ({ opt, count: votesMap[idx] ?? 0 }))
        .sort((a, b) => b.count - a.count);

      const resultLines = [`Votación cerrada: ${poll.question}`];
      for (const { opt, count } of sortedOptions) {
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        resultLines.push(`  ${opt}: ${count} voto${count !== 1 ? "s" : ""} (${pct}%)`);
      }

      const maxVotes = sortedOptions[0]?.count ?? 0;
      const winners = sortedOptions.filter((o) => o.count === maxVotes && maxVotes > 0);
      let winnerOption: string | null = null;

      if (totalVotes === 0) {
        resultLines.push("Sin votos.");
      } else if (winners.length > 1) {
        resultLines.push(`Empate entre: ${winners.map((w) => w.opt).join(", ")}`);
      } else {
        winnerOption = winners[0].opt;
        resultLines.push(`Ganadora: ${winnerOption}`);
      }

      const resultText = resultLines.join("\n");
      try {
        const newId = await sendMensaje({ chatId: chat.chat_id, texto: resultText });
        const me = chat.miembros.find((m) => m.id === currentUserId);
        const resultMsg: LocalMsg = { id: newId, _key: newId, sender_id: currentUserId, sender_nombre: me?.nombre ?? "", sender_profile_image: me?.profile_image ?? null, texto: resultText, created_at: new Date().toISOString() };
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: resultMsg });
        setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, resultMsg]);
        onNewMessageRef.current(resultMsg);
      } catch { /* resultados igual se muestran localmente */ }

      if (winnerOption && isAdmin && !isPlanFinished) {
        pendingPollWinnerRef.current = { planId, winnerOption, question: poll.question };
        return `¿Añadir "${winnerOption}" al itinerario? Responde "s" para confirmar o "n" para cancelar`;
      }

      return "";
    }

    return "Comando no reconocido. Usa /ayuda para ver los disponibles.";
  };

  const isConfirm = (t: string) => /^(@frimee\s+)?(s[ií]?|yes|ok|dale|venga|crea(la)?|adelante)\b/i.test(t.trim());
  const isCancel  = (t: string) => /^(@frimee\s+)?(no?|cancelar?)\b/i.test(t.trim());

  const onSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (pendingAiVotarRef.current && (isConfirm(trimmed) || isCancel(trimmed))) {
      const pending = pendingAiVotarRef.current;
      pendingAiVotarRef.current = null;
      setText("");
      if (isCancel(trimmed)) {
        const botMsg: LocalMsg = { id: -Date.now(), _key: -Date.now(), sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "Vale, no creo la encuesta.", created_at: new Date().toISOString(), tipo: "bot" };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }
      try {
        // La encuesta la envía la IA (bot), no el usuario
        const newId = await sendBotMensaje(chat.chat_id, pending.pollTexto);
        const pollMsg: LocalMsg = { id: newId, _key: newId, sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: pending.pollTexto, created_at: new Date().toISOString(), tipo: "bot" };
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: pollMsg });
        setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, pollMsg]);
        onNewMessageRef.current(pollMsg);
      } catch {
        const botMsg: LocalMsg = { id: -Date.now(), _key: -Date.now(), sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "No pude crear la encuesta, inténtalo de nuevo.", created_at: new Date().toISOString(), tipo: "bot" };
        setMessages((prev) => [...prev, botMsg]);
      }
      return;
    }

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
        await createGastoEndpoint({
          plan_id: pending.planId,
          titulo: pending.titulo,
          pagado_por_user_id: pending.pagadoPorId,
          fecha_gasto: new Date().toISOString(),
          total: pending.total,
          metodo_reparto: "IGUAL",
          participantes: pending.participantes.map((p) => ({ user_id: p.user_id })),
        });
        const textoPublico = `Gasto registrado: ${pending.titulo} ${pending.total}€ (pagado por ${pending.pagadoPorNombre}, dividido entre ${pending.participantes.length})`;
        const newId = await sendMensaje({ chatId: chat.chat_id, texto: textoPublico });
        const me = chat.miembros.find((m) => m.id === currentUserId);
        const confirmMsg: LocalMsg = { id: newId, _key: newId, sender_id: currentUserId, sender_nombre: me?.nombre ?? "", sender_profile_image: me?.profile_image ?? null, texto: textoPublico, created_at: new Date().toISOString() };
        void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: confirmMsg });
        setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, confirmMsg]);
        onNewMessageRef.current(confirmMsg);
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
        created_at: new Date().toISOString(),
        tipo: "bot",
      };

      // Build conversation history: last 6 messages between this user and Frimee
      const frimeeHistory: FrimeeHistoryEntry[] = messages
        .filter((m) => {
          if (!m.texto || m.texto === "…") return false;
          try { const p = JSON.parse(m.texto); if (p.type) return false; } catch { /* not JSON */ }
          const isBot = m.sender_id === "frimee" || m.sender_id === null || m.tipo === "bot";
          return isBot || m.sender_id === currentUserId;
        })
        .slice(-6)
        .map((m) => ({
          role: m.sender_id === currentUserId ? "user" : "assistant",
          content: m.texto,
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
          planInfo: planInfo ? { titulo: planInfo.titulo, ubicacion_nombre: planInfo.ubicacion_nombre } : undefined,
          isAdmin,
          userId: currentUserId,
          planId: planId ?? undefined,
          history: frimeeHistory.length > 0 ? frimeeHistory : undefined,
          userLocation,
        });

        let replyText = result.reply;

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
              // Crear directamente sin confirmación
              try {
                const newId = await sendBotMensaje(chat.chat_id, pollTexto);
                const pollMsg: LocalMsg = { id: newId, _key: newId, sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: pollTexto, created_at: new Date().toISOString(), tipo: "bot" };
                void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: pollMsg });
                setMessages((prev) => prev.some((m) => m.id === newId) ? prev : [...prev, pollMsg]);
                onNewMessageRef.current(pollMsg);
              } catch {
                replyText = "No pude crear la encuesta, inténtalo de nuevo.";
              }
            } else {
              // IA propone → pedir confirmación
              pendingAiVotarRef.current = { pollTexto, botReply: replyText };
              replyText = `${replyText}\n\n¿Creo la encuesta? Responde "s" para confirmar o "n" para cancelar.`;
            }
          }
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
      } catch {
        setMessages((prev) => prev.map((m) =>
          m.id === thinkingKey ? { ...m, texto: "No pude procesar tu mensaje, inténtalo de nuevo." } : m
        ));
      }
      return;
    }

    if (pendingPollWinnerRef.current && (isConfirm(trimmed) || isCancel(trimmed))) {
      const pending = pendingPollWinnerRef.current;
      pendingPollWinnerRef.current = null;
      setText("");
      if (isCancel(trimmed)) {
        const botMsg: LocalMsg = { id: -Date.now(), _key: -Date.now(), sender_id: "frimee", sender_nombre: "Frimee", sender_profile_image: null, texto: "Actividad descartada.", created_at: new Date().toISOString(), tipo: "bot" };
        setMessages((prev) => [...prev, botMsg]);
        return;
      }
      onAbrirActividad?.(pending.winnerOption);
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
        console.error("[chat] Error editando:", e);
        setText(trimmed);
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
      onNewMessageRef.current(newMsg);
      setReplyingTo(null);
    } catch (e) {
      console.error("[chat] Error enviando:", (e as { message?: string })?.message ?? String(e));
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMsg = async (msg: MensajeRow) => {
    try {
      await deleteMensaje(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      void channelRef.current?.send({ type: "broadcast", event: "delete_message", payload: { id: msg.id } });
    } catch (e) {
      console.error("[chat] Error eliminando:", (e as { message?: string })?.message ?? String(e));
    }
  };

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
    mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
    setRecordingSeconds(0);
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
    setShowAttachMenu(false);
    try {
      const { downloadUrl } = await uploadDocumentFile({ file, userId: currentUserId });
      const newId = await sendMensaje({ chatId: chat.chat_id, texto: "", replyToId: null, documentUrl: downloadUrl, documentName: file.name });
      const realMsg: MensajeRow = { ...tempMsg, id: newId, document_url: downloadUrl };
      void channelRef.current?.send({ type: "broadcast", event: "new_message", payload: realMsg });
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMsg : m)));
      onNewMessageRef.current(realMsg);
    } catch (e) {
      console.error("[chat] Error enviando documento:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }
  };

  const handleSendMedia = async (file: File) => {
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
      console.error("[chat] Error enviando media:", e);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void onSend(); }
    if (e.key === "Escape") { cancelEdit(); cancelReply(); closeOverlays(); }
  };

  if (showInfo) {
    return <ChatInfoPanel chat={chat} currentUserId={currentUserId} onBack={() => setShowInfo(false)} onLeave={onBack} channelRef={channelRef} onFotoUpdated={onFotoUpdated} containerClassName={containerClassName} />;
  }

  const pinnedMsg = pinnedId ? messages.find((m) => m.id === pinnedId) ?? null : null;

  return (
    <div className={containerClassName ?? "flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]"}>
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
      {/* Context menu */}
      {contextMenu && (
        <MsgContextMenu
          msg={contextMenu.msg}
          x={contextMenu.x}
          y={contextMenu.y}
          isMe={contextMenu.msg.sender_id === currentUserId}
          isStarred={starredIds.has(contextMenu.msg.id)}
          isPinned={pinnedId === contextMenu.msg.id}
          onClose={closeOverlays}
          onEdit={() => { setEditingMsg(contextMenu.msg); setText(contextMenu.msg.texto); closeOverlays(); setTimeout(() => inputRef.current?.focus(), 50); }}
          onReply={() => { setReplyingTo(contextMenu.msg); closeOverlays(); setTimeout(() => inputRef.current?.focus(), 50); }}
          onCopy={() => { void navigator.clipboard.writeText(contextMenu.msg.texto); closeOverlays(); }}
          onReact={() => { setReactingToId(contextMenu.msg.id); setReactingPos({ x: contextMenu.x, y: contextMenu.triggerTop - 56 }); setContextMenu(null); }}
          onForward={() => { setForwardMsg(contextMenu.msg); closeOverlays(); }}
          onPin={() => { setPinnedId((p) => (p === contextMenu.msg.id ? null : contextMenu.msg.id)); closeOverlays(); }}
          onStar={() => {
            setStarredIds((p) => {
              const n = new Set(p);
              if (n.has(contextMenu.msg.id)) n.delete(contextMenu.msg.id);
              else n.add(contextMenu.msg.id);
              return n;
            });
            closeOverlays();
          }}
          onDelete={() => { void handleDeleteMsg(contextMenu.msg); closeOverlays(); }}
        />
      )}

      {/* Emoji reaction picker */}
      {reactingToId !== null && reactingPos && (
        <div
          className="fixed z-[99] flex gap-[2px] rounded-full border border-app bg-app p-[6px] shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
          style={{
            left: Math.min(reactingPos.x - 120, (typeof window !== "undefined" ? window.innerWidth : 800) - 256),
            top: Math.max(reactingPos.y - 60, 8),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                const msgId = reactingToId;
                const newEmoji = localReactions[msgId] === emoji ? "" : emoji;
                setLocalReactions((prev) => ({ ...prev, [msgId]: newEmoji }));
                setReactingToId(null);
                setReactingPos(null);
                void reactMensaje(msgId, newEmoji).catch((e) =>
                  console.error("[chat] Error guardando reacción:", (e as { message?: string })?.message ?? String(e))
                );
              }}
              className="flex size-[38px] items-center justify-center rounded-full text-[20px] transition-transform hover:scale-125 hover:bg-surface"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && <Lightbox
        url={lightboxUrl}
        imageUrls={messages.filter((m) => m.image_url && !m.image_type?.startsWith("video/")).map((m) => m.image_url!)}
        onClose={() => setLightboxUrl(null)}
      />}

      {/* Forward modal */}
      {forwardMsg && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={() => setForwardMsg(null)}>
          <div className="w-full max-w-[360px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]" onClick={(e) => e.stopPropagation()}>
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
            <button type="button" onClick={() => setForwardMsg(null)} className="mt-[var(--space-3)] w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      {!embedded && (
        <div className="flex items-center gap-[var(--space-3)] border-b border-app px-[var(--space-3)] pb-[var(--space-3)] pt-mobile-safe-top md:px-[var(--space-4)] md:py-[var(--space-3)]">
          <button type="button" onClick={onBack} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
            <BackIcon className="size-[18px]" />
          </button>
          <button type="button" onClick={() => setShowInfo(true)} className="flex min-w-0 flex-1 items-center gap-[var(--space-3)] rounded-[8px] px-1 py-1 text-left transition-colors hover:bg-surface">
            <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
              {avatar ? <NextImage src={avatar} alt={name} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : chat.tipo === "GRUPO" ? <GroupIcon className="size-[16px] text-muted" /> : (name[0] ?? "?").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{name}</p>
              {chat.tipo === "GRUPO" && <p className="text-[14px] text-muted">{chat.miembros.length} miembros</p>}
            </div>
          </button>
          <button type="button" onClick={() => onStartCall?.("audio")} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface text-muted hover:text-app" aria-label="Llamada de voz">
            <PhoneCallIcon className="size-[18px]" />
          </button>
          <button type="button" onClick={() => onStartCall?.("video")} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface text-muted hover:text-app" aria-label="Llamada de vídeo">
            <VideoCallIcon className="size-[18px]" />
          </button>
        </div>
      )}

      {/* Ongoing group call banner — hide when already in the call */}
      {ongoingCall && !inCall && (
        <div className="flex items-center gap-[var(--space-3)] border-b border-app bg-surface px-[var(--space-3)] py-[10px]">
          <div className="flex size-8 items-center justify-center rounded-full bg-green-500/15 text-green-500">
            <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.59 16z"/></svg>
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
        <button
          type="button"
          onClick={() => setPinnedId(null)}
          className="flex items-center gap-[var(--space-2)] border-b border-app bg-surface px-[var(--space-3)] py-[8px] text-left"
        >
          <PinIcon className="size-[13px] shrink-0 text-muted" />
          <p className="min-w-0 flex-1 truncate text-[14px] text-muted">{pinnedMsg.texto}</p>
          <svg viewBox="0 0 24 24" fill="none" className="size-[14px] shrink-0 text-muted"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-[var(--space-3)] py-[var(--space-4)] md:px-[var(--space-4)]" onClick={closeOverlays}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Cargando...</div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-body-sm text-muted">Sé el primero en escribir</div>
        ) : (
          <div className="space-y-[1px]">
            {/* Sentinel para infinite scroll hacia arriba */}
            <div ref={topSentinelRef} className="h-px" />
            {loadingMore && (
              <div className="flex justify-center py-2">
                <div className="size-5 animate-spin rounded-full border-2 border-app border-t-transparent" />
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.sender_id === currentUserId;
              const isBot = msg.tipo === "bot";
              const prevMsg = messages[idx - 1];
              const nextMsg = messages[idx + 1];
              const isFirstInGroup = !prevMsg || prevMsg.sender_id !== msg.sender_id;
              const isLastInGroup = !nextMsg || nextMsg.sender_id !== msg.sender_id;
              const time = formatChatTime(msg.created_at);
              const isMediaMessage = Boolean(msg.image_url) || isResumenViaje(msg.texto);
              const reaction = localReactions[msg.id];
              const isStarred = starredIds.has(msg.id);
              const openMsgMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setContextMenu({ msg, x: rect.left, y: rect.bottom + 4, triggerTop: rect.top });
                setReactingToId(null);
                setReactingPos(null);
              };
              return (
                <div id={`msg-${msg.id}`} key={(msg)._key ?? msg.id} className={`group/msg flex ${isMe ? "justify-end" : "justify-start"} ${isFirstInGroup ? "mt-[var(--space-3)]" : "mt-[2px]"} ${reaction ? "mb-[20px]" : ""} ${highlightedId === msg.id ? "rounded-card bg-[var(--text-primary)]/10 transition-colors" : ""}`}>
                  {!isMe && (chat.tipo === "GRUPO" || isBot) && (
                    <div className="mr-[var(--space-2)] w-[24px] shrink-0">
                      {isFirstInGroup && (
                        <div className={`flex size-[24px] items-center justify-center overflow-hidden rounded-full text-[14px] font-[var(--fw-semibold)] ${isBot ? "bg-primary-token/15 text-primary-token" : "border border-app bg-surface-inset text-app"}`}>
                          {isBot ? "F" : msg.sender_profile_image ? <NextImage src={msg.sender_profile_image} alt={msg.sender_nombre} width={24} height={24} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : (msg.sender_nombre[0] ?? "?").toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="relative max-w-[75%]">
                    {isFirstInGroup && !isMediaMessage && (
                      isMe ? (
                        <div className="absolute -right-[5px] top-[8px] h-0 w-0 border-y-[5px] border-l-[5px] border-y-transparent" style={{ borderLeftColor: "var(--primary)" }} />
                      ) : (
                        <div className="absolute -left-[5px] top-[8px] h-0 w-0 border-y-[5px] border-r-[5px] border-y-transparent" style={{ borderRightColor: isBot ? "var(--surface)" : "var(--surface-inset)" }} />
                      )
                    )}
                    <div
                      className={`break-words ${isMediaMessage ? "bg-transparent p-0" : "px-3 py-2"} ${!isMediaMessage ? (isMe ? "bg-[var(--primary)] text-white" : isBot ? "bg-surface text-app" : "bg-surface-inset text-app") : ""} ${contextMenu?.msg.id === msg.id ? "opacity-75" : ""}`}
                      style={isMediaMessage ? undefined : {
                        borderRadius: isMe
                          ? `${isFirstInGroup ? "18px" : "8px"} 18px ${isLastInGroup ? "4px" : "8px"} 18px`
                          : `18px ${isFirstInGroup ? "18px" : "8px"} 18px ${isLastInGroup ? "4px" : "8px"}`,
                      }}
                    >
                      {!isMe && (chat.tipo === "GRUPO" || isBot) && isFirstInGroup && (
                        <p className={`mb-[2px] text-[14px] font-[var(--fw-semibold)] ${isBot ? "text-primary-token" : "text-muted"}`}>{isBot ? "Frimee" : msg.sender_nombre}</p>
                      )}
                      {msg.reply_texto && msg.reply_to_id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.reply_to_id!); }}
                          className={`mb-[6px] w-full rounded-card border-l-[3px] px-2 py-[4px] text-left transition-opacity hover:opacity-80 ${isMe ? "border-white/50 bg-black/20" : "border-[var(--primary)] bg-black/8"}`}
                        >
                          <p className={`truncate text-[14px] font-[var(--fw-semibold)] ${isMe ? "text-white/80" : "text-[var(--text-primary)]"}`}>
                            {msg.reply_sender_nombre ?? "Usuario"}
                          </p>
                          <p className={`truncate text-[14px] ${isMe ? "text-white/70" : "text-muted"}`}>
                            {msg.reply_texto && isPollMessage(msg.reply_texto)
                              ? `📊 ${(JSON.parse(msg.reply_texto) as { question: string }).question}`
                              : msg.reply_texto}
                          </p>
                        </button>
                      )}
                      {msg.tipo?.startsWith("call_") ? (
                        <CallBubble tipo={msg.tipo} duracion={parseInt(msg.texto) || 0} />
                      ) : msg.audio_url ? (
                        <AudioPlayer src={msg.audio_url} sending={msg.id < 0} />
                      ) : msg.document_url ? (
                        <DocumentBubble url={msg.document_url} name={msg.document_name ?? "Documento"} sending={msg.id < 0} />
                      ) : msg.image_url ? (
                        <MediaBubble url={msg.image_url} type={msg.image_type ?? "image/jpeg"} sending={msg.id < 0} time={time} isMe={isMe} onOpenLightbox={!msg.image_type?.startsWith("video/") ? () => setLightboxUrl(msg.image_url!) : undefined} />
                      ) : isResumenViaje(msg.texto) ? (
                        <ResumenViajeBubble texto={msg.texto} />
                      ) : isPollMessage(msg.texto) ? (
                        <PollBubble msg={msg} isMe={isMe} onVote={(idx) => {
                          emitPollVote(msg.id);
                          void channelRef.current?.send({ type: "broadcast", event: "poll_vote", payload: { mensaje_id: msg.id, option_index: idx } });
                        }} />
                      ) : (
                        <p className={`text-body-sm${isBot ? " whitespace-pre-line" : ""}`}>{msg.texto}</p>
                      )}
                      {!isMediaMessage && <div className={`mt-[2px] flex items-center justify-end gap-[4px] text-[11px] ${isMe ? "text-white/60" : "text-muted"}`}>
                        {isStarred && <span>★</span>}
                        <span>{time}</span>
                        {!isBot && <button
                          type="button"
                          onClick={openMsgMenu}
                          className="flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover/msg:opacity-100 hover:opacity-70"
                          aria-label="Opciones del mensaje"
                        >
                          <ChevronDownIcon className="size-[11px]" />
                        </button>}
                      </div>}
                    </div>
                    {reaction && (
                      <div className={`absolute -bottom-[18px] ${isMe ? "right-[8px]" : "left-[8px]"} rounded-full border border-app bg-app px-[6px] py-[2px] text-[14px] shadow-sm`}>
                        {reaction}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-app px-[var(--space-3)] pb-[max(12px,env(safe-area-inset-bottom))] pt-[var(--space-3)] md:px-[var(--space-4)] md:pb-[var(--space-3)]">
        {replyingTo && (
          <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] rounded-[10px] border-l-2 border-[var(--text-primary)] bg-surface px-3 py-[8px]">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-[var(--fw-semibold)] text-[var(--text-primary)]">{replyingTo.sender_nombre || "Tú"}</p>
              <p className="truncate text-[14px] text-muted">
                {replyingTo.texto && isPollMessage(replyingTo.texto)
                  ? `📊 ${(JSON.parse(replyingTo.texto) as { question: string }).question}`
                  : replyingTo.texto}
              </p>
            </div>
            <button type="button" onClick={cancelReply} className="shrink-0 text-muted transition-colors hover:text-app">
              <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
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
              <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </div>
        )}
        <div className="relative flex items-center gap-[var(--space-2)]">
          {/* Attachment menu */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowAttachMenu((v) => !v)}
              className="flex size-[36px] items-center justify-center rounded-full transition-colors hover:bg-surface"
              aria-label="Adjuntar"
            >
              <AttachPlusIcon className="size-[20px] text-muted" />
            </button>
            {/* Inputs ocultos */}
            <input ref={docInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendDocument(f); e.target.value = ""; }} />
            <input ref={mediaInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendMedia(f); e.target.value = ""; }} />
            <input ref={audioFileInputRef} type="file" className="hidden" accept="audio/*,.mp3,.m4a,.ogg,.wav,.aac,.flac" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleSendAudioFile(f); e.target.value = ""; }} />
            {showAttachMenu && (
              <div className="absolute bottom-[44px] left-0 z-50 min-w-[180px] overflow-hidden rounded-[14px] border border-app bg-app shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
                {[
                  { icon: <DocIcon className="size-[18px]" />, label: "Documento", color: "text-purple-400", onClick: () => { setShowAttachMenu(false); docInputRef.current?.click(); } },
                  { icon: <PhotoVideoIcon className="size-[18px]" />, label: "Fotos y videos", color: "text-blue-400", onClick: () => { setShowAttachMenu(false); const i = mediaInputRef.current; if (!i) return; i.removeAttribute("capture"); i.click(); } },
                  { icon: <CameraIcon className="size-[18px]" />, label: "Cámara", color: "text-red-400", onClick: () => { setShowAttachMenu(false); setShowCamera(true); } },
                  { icon: <AudioFileIcon className="size-[18px]" />, label: "Audio", color: "text-orange-400", onClick: () => { setShowAttachMenu(false); audioFileInputRef.current?.click(); } },
                  { icon: <PollIcon className="size-[18px]" />, label: "Encuesta", color: "text-green-400", onClick: () => { setShowAttachMenu(false); setShowPollCreator(true); } },
                ].map(({ icon, label, color, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    className="flex w-full items-center gap-[var(--space-3)] px-4 py-[11px] text-left transition-colors hover:bg-surface"
                  >
                    <span className={color}>{icon}</span>
                    <span className="text-body-sm text-app">{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isRecording ? (
            <>
              <div className="flex min-w-0 flex-1 items-center gap-[var(--space-2)] rounded-full border border-red-500/50 bg-surface px-4 py-[8px]">
                <span className="size-[8px] shrink-0 animate-pulse rounded-full bg-red-500" />
                <span className="text-body-sm text-red-400">
                  {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                <span className="text-body-sm text-muted">Grabando...</span>
              </div>
              <button
                type="button"
                onClick={handleCancelRecording}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
                aria-label="Cancelar grabación"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-[16px] text-muted"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
              <button
                type="button"
                onClick={handleSendRecording}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-opacity hover:opacity-80"
                aria-label="Enviar nota de voz"
              >
                <SendMsgIcon className="size-[16px]" />
              </button>
            </>
          ) : (
            <>
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => {
                  setTimeout(() => {
                    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                  }, 300);
                }}
                placeholder={editingMsg ? "Editar mensaje..." : "Escribe un mensaje..."}
                className="min-w-0 flex-1 rounded-full border border-app bg-surface px-4 py-[8px] text-body-sm text-app outline-none transition-colors focus:border-[var(--border-strong)]"
              />
              <button
                type="button"
                onClick={() => void handleStartRecording()}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
                aria-label="Nota de voz"
              >
                <MicIcon className="size-[18px] text-muted" />
              </button>
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={!text.trim() || sending}
                className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white transition-opacity hover:opacity-80 disabled:opacity-30"
                aria-label="Enviar"
              >
                <SendMsgIcon className="size-[16px]" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MsgContextMenu({
  x, y, isMe, isStarred, isPinned,
  onClose, onEdit, onReply, onCopy, onReact, onForward, onPin, onStar, onDelete,
}: {
  msg: MensajeRow;
  x: number;
  y: number;
  isMe: boolean;
  isStarred: boolean;
  isPinned: boolean;
  onClose: () => void;
  onEdit: () => void;
  onReply: () => void;
  onCopy: () => void;
  onReact: () => void;
  onForward: () => void;
  onPin: () => void;
  onStar: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const menuW = 210;
  const itemH = 44;
  const itemCount = isMe ? 8 : 6;
  const menuH = itemCount * itemH + 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.min(x, vw - menuW - 8);
  const top = y + menuH > vh ? Math.max(y - menuH, 8) : y;

  const items: { label: string; icon: React.ReactNode; danger?: boolean; action: () => void }[] = [
    ...(isMe ? [{ label: "Editar", icon: <EditIcon />, action: onEdit }] : []),
    { label: "Responder", icon: <ReplyIcon />, action: onReply },
    { label: "Copiar", icon: <CopyIcon />, action: onCopy },
    { label: "Reaccionar", icon: <EmojiIcon />, action: onReact },
    { label: "Reenviar", icon: <ForwardIcon />, action: onForward },
    { label: isPinned ? "Desfijar" : "Fijar", icon: <PinIcon />, action: onPin },
    { label: isStarred ? "Quitar destacado" : "Destacar", icon: <StarIcon />, action: onStar },
    ...(isMe ? [{ label: "Eliminar", icon: <TrashIcon />, danger: true, action: onDelete }] : []),
  ];

  return (
    <div
      className="fixed z-[100] min-w-[210px] overflow-hidden rounded-[12px] border border-app bg-app py-[4px] shadow-[0_4px_24px_rgba(0,0,0,0.25)]"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.action}
          className={`flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-body-sm transition-colors hover:bg-surface ${item.danger ? "text-red-500" : "text-app"}`}
        >
          <span className="size-[18px] shrink-0">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ChatInfoPanel({
  chat,
  currentUserId,
  onBack,
  onLeave,
  channelRef,
  onFotoUpdated,
  containerClassName,
}: {
  chat: ChatListItem;
  currentUserId: string;
  onBack: () => void;
  onLeave: () => void;
  channelRef: React.RefObject<ReturnType<ReturnType<typeof createBrowserSupabaseClient>["channel"]> | null>;
  onFotoUpdated?: (foto: string) => void;
  containerClassName?: string;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [friends, setFriends] = useState<PublicUserProfileRow[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [localMembers, setLocalMembers] = useState(() => {
    const seen = new Set<string>();
    return chat.miembros.filter((m) => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
  });
  const [localFoto, setLocalFoto] = useState(chat.foto);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isGrupo = chat.tipo === "GRUPO";
  const name = resolveChatName(chat, currentUserId);
  const displayAvatar = isGrupo ? localFoto : resolveChatAvatar(chat, currentUserId);
  const avatarLabel = (name[0] ?? "?").toUpperCase();

  // Escuchar eventos de miembros en tiempo real
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const handler = ({ payload }: { payload: unknown }) => {
      const { user_id, nombre, profile_image } = payload as { user_id: string; nombre?: string; profile_image?: string | null };
      setLocalMembers((prev) => {
        if (prev.some((m) => m.id === user_id)) return prev;
        return [...prev, { id: user_id, nombre: nombre ?? "Usuario", username: null, profile_image: profile_image ?? null }];
      });
    };
    const leaveHandler = ({ payload }: { payload: unknown }) => {
      const { user_id } = payload as { user_id: string };
      setLocalMembers((prev) => prev.filter((m) => m.id !== user_id));
    };
    ch.on("broadcast", { event: "member_added" }, handler);
    ch.on("broadcast", { event: "member_left" }, leaveHandler);
  }, [channelRef]);

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveChat(chat.chat_id);
      void channelRef.current?.send({ type: "broadcast", event: "member_left", payload: { user_id: currentUserId } });
      onLeave();
    } catch (e) {
      console.error("[chat] Error saliendo del chat:", e);
      setLeaving(false);
      setConfirmLeave(false);
    }
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploadingFoto) return;
    setUploadingFoto(true);
    try {
      const { downloadUrl } = await uploadPlanCoverFile({ file, userId: currentUserId });
      await updateChatFoto(chat.chat_id, downloadUrl);
      setLocalFoto(downloadUrl);
      onFotoUpdated?.(downloadUrl);
    } catch (err) {
      console.error("[chat] Error actualizando foto:", err);
    } finally {
      setUploadingFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openAddMembers = async () => {
    setShowAddMembers(true);
    setFriendsLoading(true);
    try {
      const all = await fetchActiveFriends();
      const memberIds = new Set(localMembers.map((m) => m.id));
      setFriends(all.filter((f) => !memberIds.has(f.id)));
    } catch (err) {
      console.error("[chat] Error cargando amigos:", err);
    } finally {
      setFriendsLoading(false);
    }
  };

  const handleAddMember = async (friendId: string) => {
    if (addingId) return;
    setAddingId(friendId);
    try {
      await addChatMember(chat.chat_id, friendId);
      const added = friends.find((f) => f.id === friendId);
      if (added) {
        setLocalMembers((prev) => [...prev, { id: added.id, nombre: added.nombre, username: null, profile_image: added.profile_image }]);
        setFriends((prev) => prev.filter((f) => f.id !== friendId));
        void channelRef.current?.send({ type: "broadcast", event: "member_added", payload: { user_id: added.id, nombre: added.nombre, profile_image: added.profile_image } });
        // Notificar al usuario añadido para que actualice su lista de chats
        const supabase = createBrowserSupabaseClient();
        const notifChannel = supabase.channel(`user-join:${friendId}`);
        notifChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            void notifChannel.send({ type: "broadcast", event: "chat_added", payload: { chat_id: chat.chat_id } });
            setTimeout(() => void supabase.removeChannel(notifChannel), 2000);
          }
        });
        setShowAddMembers(false);
      }
    } catch (err) {
      console.error("[chat] Error añadiendo miembro:", err);
    } finally {
      setAddingId(null);
    }
  };

  const visibleMembers = showAllMembers ? localMembers : localMembers.slice(0, 6);
  const hiddenCount = localMembers.length - 6;

  return (
    <div className={containerClassName ?? "relative flex h-[calc(100dvh-var(--space-20)-env(safe-area-inset-bottom))] flex-col md:h-[calc(100dvh-var(--space-16))]"}>
      {/* Header */}
      <div className="flex items-center gap-[var(--space-2)] border-b border-app px-[var(--space-3)] pb-[var(--space-3)] pt-mobile-safe-top md:px-[var(--space-4)] md:py-[var(--space-3)]">
        <button type="button" onClick={onBack} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface" aria-label="Volver">
          <BackIcon className="size-[18px]" />
        </button>
        <p className="text-body-sm font-[var(--fw-semibold)] text-app">
          {isGrupo ? "Info. del grupo" : "Info. del contacto"}
        </p>
      </div>

      {/* Add members overlay */}
      {showAddMembers && (
        <div className="absolute inset-0 z-40 flex flex-col bg-app">
          <div className="flex items-center gap-[var(--space-2)] border-b border-app px-[var(--space-3)] pb-[var(--space-3)] pt-mobile-safe-top md:px-[var(--space-4)] md:py-[var(--space-3)]">
            <button type="button" onClick={() => setShowAddMembers(false)} className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface">
              <BackIcon className="size-[18px]" />
            </button>
            <p className="text-body-sm font-[var(--fw-semibold)] text-app">Añadir personas</p>
          </div>
          <div className="flex-1 overflow-y-auto p-[var(--space-2)]">
            {friendsLoading ? (
              <div className="py-[var(--space-8)] text-center text-body-sm text-muted">Cargando...</div>
            ) : friends.length === 0 ? (
              <div className="py-[var(--space-8)] text-center text-body-sm text-muted">No hay más amigos que añadir</div>
            ) : (
              <div className="space-y-[1px]">
                {friends.map((f) => {
                  const label = (f.nombre[0] ?? "?").toUpperCase();
                  const isAdding = addingId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => void handleAddMember(f.id)}
                      disabled={!!addingId}
                      className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface disabled:opacity-50"
                    >
                      <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                        {f.profile_image ? <NextImage src={f.profile_image} alt={f.nombre} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : label}
                      </div>
                      <p className="min-w-0 flex-1 truncate text-body-sm font-[var(--fw-medium)] text-app">{f.nombre}</p>
                      {isAdding ? (
                        <span className="shrink-0 text-[14px] text-muted">...</span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-app px-[10px] py-[4px] text-[14px] text-app">Añadir</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[520px]">
        {/* Hero: avatar + name */}
        <div className="flex flex-col items-center gap-[var(--space-3)] py-[var(--space-7)]">
          <div className="relative">
            <div className="flex size-[96px] items-center justify-center overflow-hidden rounded-full border-2 border-app bg-surface-inset text-[34px] font-[var(--fw-semibold)] text-app">
              {displayAvatar ? (
                <NextImage src={displayAvatar} alt={name} width={96} height={96} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
              ) : isGrupo ? (
                <GroupIcon className="size-[40px] text-muted" />
              ) : avatarLabel}
            </div>
            {isGrupo && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFoto}
                  className="absolute -bottom-[2px] -right-[2px] flex size-[28px] items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--surface)] shadow-sm transition-colors hover:bg-surface-inset"
                  aria-label="Cambiar foto"
                >
                  {uploadingFoto ? (
                    <span className="block size-[10px] animate-spin rounded-full border-2 border-muted border-t-transparent" />
                  ) : (
                    <CameraIcon className="size-[13px] text-app" />
                  )}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleFotoChange(e)} />
              </>
            )}
          </div>
          <div className="text-center">
            <p className="text-[var(--font-h4)] font-[var(--fw-semibold)] text-app">{name}</p>
            <p className="mt-[3px] text-[14px] text-muted">
              {isGrupo ? `Grupo · ${localMembers.length} miembros` : "Contacto"}
            </p>
          </div>
        </div>

        {/* Members (groups only) */}
        {isGrupo && (
          <>
            <div className="flex items-center justify-between px-[var(--space-4)] pb-[var(--space-2)]">
              <p className="text-[14px] font-[var(--fw-semibold)] uppercase tracking-wide text-muted">
                {localMembers.length} miembros
              </p>
            </div>
            <div className="space-y-[1px] px-[var(--space-2)]">
              {/* Add member button */}
              <button
                type="button"
                onClick={() => void openAddMembers()}
                className="flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px] text-left transition-colors hover:bg-surface"
              >
                <div className="avatar-md flex shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-strong)] bg-surface-inset">
                  <Plus className="size-[16px] text-muted" aria-hidden />
                </div>
                <p className="text-body-sm font-[var(--fw-medium)] text-app">Añadir personas</p>
              </button>
              {visibleMembers.map((m) => {
                const label = (m.nombre[0] ?? "?").toUpperCase();
                const isMe = m.id === currentUserId;
                return (
                  <div key={m.id} className="flex items-center gap-[var(--space-3)] rounded-[10px] px-2 py-[10px]">
                    <div className="avatar-md flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-app bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">
                      {m.profile_image ? <NextImage src={m.profile_image} alt={m.nombre} width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" /> : label}
                    </div>
                    <p className="min-w-0 flex-1 truncate text-body-sm text-app">{m.nombre}</p>
                    {isMe && (
                      <span className="shrink-0 rounded-full bg-surface px-[8px] py-[3px] text-[14px] text-muted">Tú</span>
                    )}
                  </div>
                );
              })}
              {!showAllMembers && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAllMembers(true)}
                  className="w-full rounded-[10px] px-2 py-[10px] text-left text-body-sm text-[var(--primary)] transition-colors hover:bg-surface"
                >
                  Ver todos ({hiddenCount} más)
                </button>
              )}
            </div>
          </>
        )}

        <div className="mx-[var(--space-4)] my-[var(--space-3)] border-t border-app" />

        {/* Actions */}
        <div className="px-[var(--space-2)] pb-[var(--space-8)]">
          <ActionRow icon={<TrashLightIcon />} label="Vaciar chat" onClick={() => {}} />
          {!isGrupo && (
            <>
              <ActionRow icon={<BlockIcon />} label={`Bloquear a ${name}`} danger onClick={() => {}} />
              <ActionRow icon={<ReportIcon />} label={`Reportar a ${name}`} danger onClick={() => {}} />
              <ActionRow icon={<TrashIcon />} label="Eliminar chat" danger onClick={() => setConfirmLeave(true)} />
            </>
          )}
          {isGrupo && (
            <>
              <ActionRow icon={<LeaveIcon />} label="Salir del grupo" danger onClick={() => setConfirmLeave(true)} />
              <ActionRow icon={<ReportIcon />} label="Reportar grupo" danger onClick={() => {}} />
            </>
          )}
        </div>
        </div>{/* /max-w wrapper */}
      </div>

      {/* Confirm modal */}
      {confirmLeave && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center">
          <div className="w-full max-w-[360px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]">
            <p className="text-center text-body-sm font-[var(--fw-semibold)] text-app">
              {isGrupo ? "¿Salir del grupo?" : "¿Eliminar esta conversación?"}
            </p>
            <p className="mt-[var(--space-1)] text-center text-body-sm text-muted">
              {isGrupo ? "Ya no podrás recibir mensajes de este grupo." : "Se eliminará el chat de tu lista."}
            </p>
            <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
              <button
                type="button"
                onClick={() => void handleLeave()}
                disabled={leaving}
                className="w-full rounded-full bg-red-500 py-[10px] text-body-sm font-[var(--fw-semibold)] text-white transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {leaving ? "..." : isGrupo ? "Salir" : "Eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmLeave(false)}
                className="w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionRow({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-[var(--space-3)] rounded-[10px] px-3 py-[12px] text-left transition-colors hover:bg-surface ${danger ? "text-red-500" : "text-app"}`}
    >
      <span className="size-[20px] shrink-0">{icon}</span>
      <span className="text-body-sm font-[var(--fw-medium)]">{label}</span>
    </button>
  );
}

const TrashLightIcon = Trash2;
const TrashIcon = Trash2;
const BlockIcon = Ban;
const ReportIcon = AlertTriangle;
const LeaveIcon = LogOut;
const ChevronDownIcon = ChevronDown;
const EditIcon = Pencil;
const ReplyIcon = Reply;
const CopyIcon = Copy;
const EmojiIcon = Smile;
const ForwardIcon = Forward;
const PinIcon = Pin;
const StarIcon = Star;
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


function CallBubble({ tipo, duracion }: { tipo: string; duracion: number }) {
  const missed = tipo.includes("missed");
  const isVideo = tipo.includes("video");
  const label = missed
    ? isVideo ? "Videollamada perdida" : "Llamada perdida"
    : isVideo ? "Videollamada" : "Llamada de audio";
  const formatDur = (s: number) => {
    if (!s) return "";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m} min ${sec} s` : `${sec} s`;
  };
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <span className={`text-[20px] ${missed ? "opacity-60" : ""}`}>
        {isVideo ? "📹" : "📞"}
      </span>
      <div className="flex flex-col">
        <span className={`text-body-sm font-[var(--fw-medium)] ${missed ? "opacity-70" : ""}`}>{label}</span>
        {!missed && duracion > 0 && (
          <span className="text-[14px] opacity-60">{formatDur(duracion)}</span>
        )}
      </div>
    </div>
  );
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
      <div className={`pointer-events-none absolute bottom-2 right-2 rounded-chip bg-black/58 px-2 py-1 text-[14px] leading-none text-white backdrop-blur-sm ${isMe ? "border border-white/10" : "border border-black/10"}`}>
        {time}
      </div>
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

function isPollMessage(texto: string): boolean {
  try { return JSON.parse(texto)?.type === "poll"; } catch { return false; }
}

function isResumenViaje(texto: string): boolean {
  try { return JSON.parse(texto)?.type === "resumen_viaje"; } catch { return false; }
}

type ResumenViajeData = {
  type: "resumen_viaje";
  total: number;
  por_persona: number;
  num_miembros: number;
  top_pagador: string | null;
  top_pagador_importe: number | null;
  deudas_pendientes: number;
  actividades: number;
};

function ResumenViajeBubble({ texto }: { texto: string }) {
  let data: ResumenViajeData;
  try { data = JSON.parse(texto) as ResumenViajeData; } catch { return null; }

  const fmtEur = (n: number) => n.toFixed(2).replace(".", ",") + "€";

  return (
    <div className="w-[260px] overflow-hidden rounded-[16px] border border-[var(--border)] bg-[var(--surface)]">
      {/* Header */}
      <div className="flex items-center gap-[10px] bg-primary-token/10 px-4 py-3">
        <span className="text-[22px]">✈️</span>
        <div>
          <p className="text-[14px] font-[var(--fw-semibold)] text-primary-token leading-tight">¡El viaje ha terminado!</p>
          <p className="text-[14px] text-primary-token/70">Aquí va el resumen</p>
        </div>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 space-y-[10px]">
        {data.total > 0 ? (
          <div>
            <p className="text-[14px] text-muted uppercase tracking-wide">Total gastado</p>
            <p className="text-[18px] font-[var(--fw-semibold)] text-app leading-tight">{fmtEur(data.total)}</p>
            {data.num_miembros > 1 && (
              <p className="text-[14px] text-muted">{fmtEur(data.por_persona)} por persona</p>
            )}
          </div>
        ) : (
          <div>
            <p className="text-[14px] text-muted uppercase tracking-wide">Total gastado</p>
            <p className="text-[14px] text-muted">Sin gastos registrados</p>
          </div>
        )}

        {data.top_pagador && (
          <div>
            <p className="text-[14px] text-muted uppercase tracking-wide">Pagó más</p>
            <p className="text-[14px] font-[var(--fw-medium)] text-app">
              {data.top_pagador}
              <span className="ml-1 text-muted font-normal">{fmtEur(data.top_pagador_importe ?? 0)}</span>
            </p>
          </div>
        )}

        {/* Counters */}
        <div className="flex gap-[8px] pt-[2px]">
          <div className="flex-1 rounded-[10px] bg-[var(--surface-inset)] px-3 py-2 text-center">
            <p className="text-[18px] font-[var(--fw-semibold)] text-app">{data.actividades}</p>
            <p className="text-[14px] text-muted">actividad{data.actividades !== 1 ? "es" : ""}</p>
          </div>
          <div className="flex-1 rounded-[10px] bg-[var(--surface-inset)] px-3 py-2 text-center">
            <p className="text-[18px] font-[var(--fw-semibold)] text-app">{data.deudas_pendientes}</p>
            <p className="text-[14px] text-muted">deuda{data.deudas_pendientes !== 1 ? "s" : ""} pend.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Module-level event emitter para sincronizar votos en tiempo real entre PollBubble y el canal broadcast
const pollVoteCallbacks = new Map<number, Set<() => void>>();
function emitPollVote(mensajeId: number) {
  pollVoteCallbacks.get(mensajeId)?.forEach(fn => fn());
}
function subscribePollVote(mensajeId: number, fn: () => void): () => void {
  if (!pollVoteCallbacks.has(mensajeId)) pollVoteCallbacks.set(mensajeId, new Set());
  pollVoteCallbacks.get(mensajeId)!.add(fn);
  return () => { pollVoteCallbacks.get(mensajeId)?.delete(fn); };
}

function PollBubble({ msg, isMe, onVote }: { msg: MensajeRow; isMe: boolean; onVote?: (idx: number) => void }) {
  const poll = JSON.parse(msg.texto) as { question: string; options: string[]; closed?: boolean };
  const [votes, setVotes] = useState<Record<number, number>>({});
  const [myVote, setMyVote] = useState<number | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchVotes = useCallback(async () => {
    if (msg.id < 0) return;
    try {
      const data = await pollGetVotes(msg.id);
      const map: Record<number, number> = {};
      let my: number | null = null;
      for (const row of data) {
        map[row.option_index] = Number(row.vote_count);
        if (row.voted_by_me) my = row.option_index;
      }
      setVotes(map);
      setMyVote(my);
    } finally { setFetched(true); }
  }, [msg.id]);

  useEffect(() => {
    if (msg.id < 0) { setFetched(true); return; }
    void fetchVotes();
  }, [fetchVotes, msg.id]);

  useEffect(() => {
    if (msg.id < 0) return;
    return subscribePollVote(msg.id, () => { void fetchVotes(); });
  }, [fetchVotes, msg.id]);

  const handleVote = async (idx: number) => {
    if (msg.id < 0) return;
    const prevVote = myVote;
    const prevVotes = { ...votes };
    const newVotes = { ...votes };
    if (prevVote !== null) newVotes[prevVote] = Math.max(0, (newVotes[prevVote] ?? 0) - 1);
    newVotes[idx] = (newVotes[idx] ?? 0) + 1;
    setMyVote(idx);
    setVotes(newVotes);
    try {
      await pollVote(msg.id, idx);
      onVote?.(idx);
    } catch {
      setMyVote(prevVote);
      setVotes(prevVotes);
    }
  };

  const total = Object.values(votes).reduce((a, b) => a + b, 0);

  return (
    <div className="w-[260px]">
      <div className="mb-[10px] flex items-center gap-[6px]">
        <PollIcon className="size-[14px] shrink-0 opacity-60" />
        <p className="text-body-sm font-[var(--fw-semibold)]">{poll.question}</p>
      </div>
      <div className="space-y-[6px]">
        {poll.options.map((opt, idx) => {
          const count = votes[idx] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const selected = myVote === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => void handleVote(idx)}
              disabled={!fetched || msg.id < 0 || poll.closed}
              className="relative w-full overflow-hidden rounded-[8px] border px-[10px] py-[8px] text-left transition-all disabled:opacity-50"
              style={{ borderColor: selected ? (isMe ? "rgba(255,255,255,0.6)" : "var(--text-primary)") : (isMe ? "rgba(255,255,255,0.2)" : "var(--border-app, #e2e8f0)") }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: isMe
                    ? "rgba(255,255,255,0.5)"
                    : selected ? "rgba(99,102,241,0.65)" : "rgba(99,102,241,0.35)",
                }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-[6px]">
                  {selected && (
                    <Check className="size-[13px] shrink-0" strokeWidth={2.5} style={{ color: isMe ? "rgba(255,255,255,0.9)" : "var(--text-primary)" }} aria-hidden />
                  )}
                  <span className="text-body-sm">{opt}</span>
                </div>
                <span className={`text-[14px] ${isMe ? "text-white/60" : "text-muted"}`}>{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className={`mt-[8px] text-[14px] ${isMe ? "text-white/60" : "text-muted"}`}>
        {poll.closed ? `Cerrada · ${total} ${total === 1 ? "voto" : "votos"}` : `${total} ${total === 1 ? "voto" : "votos"}`}
      </p>
    </div>
  );
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

function Lightbox({ url, imageUrls, onClose }: { url: string; imageUrls: string[]; onClose: () => void }) {
  const [current, setCurrent] = useState(url);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const idx = imageUrls.indexOf(current);
  const hasPrev = idx > 0;
  const hasNext = idx < imageUrls.length - 1;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setCurrent(imageUrls[idx - 1]);
      if (e.key === "ArrowRight" && hasNext) setCurrent(imageUrls[idx + 1]);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [idx, hasPrev, hasNext, imageUrls, onClose]);

  useEffect(() => {
    const el = thumbsRef.current?.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ inline: "center", behavior: "smooth" });
  }, [idx]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black" onClick={onClose}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-end p-3" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-white hover:bg-white/10">
          <X className="size-6" aria-hidden />
        </button>
      </div>

      {/* Main image */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {hasPrev && (
          <button type="button" onClick={() => setCurrent(imageUrls[idx - 1])} className="absolute left-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronLeft className="size-6" aria-hidden />
          </button>
        )}
        <NextImage src={current} alt="Imagen" width={1600} height={1200} className="max-h-full max-w-full object-contain" unoptimized referrerPolicy="no-referrer" />
        {hasNext && (
          <button type="button" onClick={() => setCurrent(imageUrls[idx + 1])} className="absolute right-3 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <ChevronRight className="size-6" aria-hidden />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {imageUrls.length > 1 && (
        <div ref={thumbsRef} className="flex shrink-0 gap-2 overflow-x-auto scrollbar-hide" style={{ padding: "12px calc(50% - 28px)" }} onClick={(e) => e.stopPropagation()}>
          {imageUrls.map((u, i) => (
            <button key={u} type="button" onClick={() => setCurrent(u)} className={`shrink-0 overflow-hidden rounded-[6px] border-2 transition-all ${u === current ? "border-white" : "border-transparent opacity-50 hover:opacity-80"}`} style={{ width: 56, height: 56 }}>
              <NextImage src={u} alt={`Imagen ${i + 1}`} width={56} height={56} className="size-full object-cover" unoptimized referrerPolicy="no-referrer" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
