"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { buildInternalApiUrl } from "@/config/external";
import { createRealtimeTopic } from "@/lib/realtime";

const supabase = createBrowserSupabaseClient();

/** How long a call rings before it counts as unanswered, on both sides. */
export const RING_TIMEOUT_MS = 45_000;

async function fetchLivekitToken(roomName: string, chatId: string, accessToken?: string) {
  const res = await fetch(buildInternalApiUrl("/api/livekit/token"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ roomName, chatId }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const body = await res.text();
    throw new Error(`LiveKit token API devolvio ${contentType || "contenido no JSON"}: ${body.slice(0, 120)}`);
  }

  const data = await res.json() as { token?: string; error?: string };
  if (res.status === 429 && data.error?.includes("modo invitado")) throw new GuestLimitError();
  if (!res.ok || !data.token) {
    throw new Error(data.error ?? `No se pudo obtener token de LiveKit (${res.status})`);
  }

  return data.token;
}

/**
 * Changes a call's state only while it is still ringing (or always, with `whileRinging: false`).
 * Supabase queries run when awaited or then-ed: a bare `void supabase.from(...).update(...)`
 * never reaches the database, which is how calls used to stay "ringing" forever.
 */
function setCallEstado(id: number, estado: "active" | "missed" | "rejected" | "busy", whileRinging = true) {
  let query = supabase
    .from("llamadas")
    .update(estado === "active" ? { estado } : { estado, finalizada_at: new Date().toISOString() })
    .eq("id", id);
  if (whileRinging) query = query.eq("estado", "ringing");
  return query.then(({ error }) => {
    if (error) console.error("[call] estado", estado, error.message);
  });
}

export type CallMiembro = { id: string; nombre: string; foto?: string };

/** A guest used up today's calls: the app offers to create an account. */
export class GuestLimitError extends Error {
  constructor() {
    super("Límite de llamadas del modo invitado");
    this.name = "GuestLimitError";
  }
}

/** Why the last call ended without being answered, to tell the caller. */
export type CallEndReason = "no-answer" | "rejected" | "busy";

export type CallState =
  | { status: "idle" }
  | { status: "outgoing"; llamadaId: number; roomName: string; chatId: string; tipo: "audio" | "video"; camera: boolean; token: string; isInitiator: true; participanteNombre: string; participanteFoto?: string; miembros: CallMiembro[] }
  | { status: "incoming"; roomName: string; chatId: string; tipo: "audio" | "video"; llamadaId: number; callerId: string; callerName: string; callerFoto?: string; chatTipo: string | null; chatNombre: string | null; miembros: CallMiembro[] }
  | { status: "active"; llamadaId: number | null; roomName: string; chatId: string; tipo: "audio" | "video"; camera: boolean; token: string; isInitiator: boolean; participanteNombre: string; participanteFoto?: string; miembros: CallMiembro[] };

type LlamadaRow = { id: number; chat_id: string; room_name: string; tipo: "audio" | "video"; iniciado_por_user_id: string; estado: string };
type CallInfo = { tipo: string; nombre: string | null; foto: string | null; miembros: Array<{ id: string; nombre: string; foto: string | null }> };

/** One-to-one calls can be rejected or busy; in a group, one member declining ends nothing. */
const isGroupCall = (miembros: CallMiembro[]) => miembros.length > 2;

export function useCall() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  // When the current call was answered (ms since epoch), for the timers; null while ringing.
  const [activeSince, setActiveSince] = useState<number | null>(null);
  const [endReason, setEndReason] = useState<CallEndReason | null>(null);
  // The realtime listener is created once per user: it reads the live state through a ref.
  const stateRef = useRef<CallState>(callState);
  useEffect(() => {
    stateRef.current = callState;
  }, [callState]);

  const recordMissed = useCallback(async (chatId: string, tipo: "audio" | "video") => {
    await supabase.rpc("fn_llamada_record", { p_chat_id: chatId, p_tipo: `call_missed_${tipo}`, p_duracion: null });
  }, []);

  // Incoming calls (new rows) and what happens to the current one (row updates).
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(createRealtimeTopic("incoming-calls", userId))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "llamadas" }, async (payload: { new: Record<string, unknown> }) => {
        const llamada = payload.new as LlamadaRow;
        if (llamada.iniciado_por_user_id === userId) return;

        const { data } = await supabase.rpc("fn_call_info", { p_chat_id: llamada.chat_id });
        const info = data as CallInfo | null;
        const miembros: CallMiembro[] = (info?.miembros ?? []).map((m) => ({ id: m.id, nombre: m.nombre, foto: m.foto ?? undefined }));

        // Already in a call: keep it. A one-to-one caller hears "busy"; in a group, others answer.
        if (stateRef.current.status !== "idle") {
          if (!isGroupCall(miembros)) {
            void setCallEstado(llamada.id, "busy");
          }
          return;
        }

        const caller = miembros.find((m) => m.id === llamada.iniciado_por_user_id);
        // A group chat shows the group; a plan or a direct chat shows the person calling.
        const isGrupo = info?.tipo === "GRUPO";
        const callerName = isGrupo ? info?.nombre ?? "Grupo" : caller?.nombre ?? "Usuario";
        const callerFoto = isGrupo ? info?.foto ?? undefined : caller?.foto;

        setEndReason(null);
        setCallState({
          status: "incoming",
          roomName: llamada.room_name,
          chatId: llamada.chat_id,
          tipo: llamada.tipo,
          llamadaId: llamada.id,
          callerId: isGrupo ? llamada.chat_id : llamada.iniciado_por_user_id,
          callerName,
          callerFoto,
          chatTipo: info?.tipo ?? null,
          chatNombre: info?.nombre ?? null,
          miembros,
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "llamadas" }, (payload: { new: Record<string, unknown> }) => {
        const llamada = payload.new as LlamadaRow;
        const current = stateRef.current;
        if (current.status === "idle" || !("llamadaId" in current) || current.llamadaId !== llamada.id) return;

        // Ringing here and the caller gave up (or the call expired): stop ringing.
        if (current.status === "incoming" && llamada.estado !== "ringing" && llamada.estado !== "active") {
          setCallState({ status: "idle" });
          return;
        }

        // Calling and the other person declined or was busy.
        if (current.status === "outgoing" && (llamada.estado === "rejected" || llamada.estado === "busy")) {
          void recordMissed(current.chatId, current.tipo);
          setEndReason(llamada.estado);
          setActiveSince(null);
          setCallState({ status: "idle" });
        }
      })
      .subscribe((status) => console.log("[call] channel status", status));

    return () => { supabase.removeChannel(channel); };
  }, [userId, recordMissed]);

  // Nobody answers: the caller hangs up for everyone and the callee stops ringing.
  useEffect(() => {
    if (callState.status !== "outgoing" && callState.status !== "incoming") return;
    const { status, llamadaId } = callState;
    const timer = setTimeout(() => {
      const current = stateRef.current;
      if (current.status !== status || !("llamadaId" in current) || current.llamadaId !== llamadaId) return;
      if (current.status === "outgoing") {
        void setCallEstado(current.llamadaId, "missed");
        void recordMissed(current.chatId, current.tipo);
        setEndReason("no-answer");
      }
      setActiveSince(null);
      setCallState({ status: "idle" });
    }, RING_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [callState, recordMissed]);

  const startCall = useCallback(async (chatId: string, tipo: "audio" | "video" = "audio", participanteNombre = "Usuario", participanteFoto?: string, miembros: CallMiembro[] = []) => {
    if (!userId) {
      throw new Error("Debes iniciar sesion para llamar");
    }

    const roomName = `call_${chatId}_${Date.now()}`;
    // Token first: if LiveKit is not reachable, no call is left ringing on the other side.
    const { data: { session } } = await supabase.auth.getSession();
    const token = await fetchLivekitToken(roomName, chatId, session?.access_token);

    const { data: llamada, error } = await supabase
      .from("llamadas")
      .insert({ chat_id: chatId, room_name: roomName, iniciado_por_user_id: userId, tipo, estado: "ringing" })
      .select("id")
      .single();
    if (error || !llamada) {
      console.error("[call] create error", error?.message, error?.code, error?.details, error?.hint);
      throw new Error(error?.message ?? "No se pudo crear la llamada");
    }

    setEndReason(null);
    setActiveSince(null);
    setCallState({ status: "outgoing", llamadaId: (llamada as { id: number }).id, roomName, chatId, tipo, camera: tipo === "video", token, isInitiator: true, participanteNombre, participanteFoto, miembros });
  }, [userId]);

  /** Answer; a video call can be answered with the camera off ("Contestar sin cámara"). */
  const acceptCall = useCallback(async (withCamera = true) => {
    if (callState.status !== "incoming") return;
    const { roomName, chatId, tipo, llamadaId, miembros } = callState;

    const { data: { session } } = await supabase.auth.getSession();
    const token = await fetchLivekitToken(roomName, chatId, session?.access_token);
    await setCallEstado(llamadaId, "active");

    setActiveSince(Date.now());
    setCallState({ status: "active", llamadaId, roomName, chatId, tipo, camera: tipo === "video" && withCamera, token, isInitiator: false, participanteNombre: callState.callerName, participanteFoto: callState.callerFoto, miembros });
  }, [callState]);

  const endCall = useCallback(async (endForAll = false) => {
    if (callState.status === "idle") return;
    const now = new Date().toISOString();
    const isGroup = isGroupCall(callState.miembros);

    if (callState.status === "incoming") {
      // Declining: in a one-to-one call the caller learns it at once; in a group, others may answer.
      if (!isGroup) {
        void setCallEstado(callState.llamadaId, "rejected");
      }
    } else if (callState.status === "outgoing") {
      // Hanging up before anyone answered: unanswered for everyone.
      void setCallEstado(callState.llamadaId, "missed");
      void recordMissed(callState.chatId, callState.tipo);
    } else if (isGroup && !endForAll) {
      // Leaving a group call that goes on without you.
    } else {
      await supabase.from("llamadas").update({ estado: "ended", finalizada_at: now }).eq("room_name", callState.roomName);
      if (callState.isInitiator) {
        const duracion = activeSince ? Math.floor((Date.now() - activeSince) / 1000) : null;
        await supabase.rpc("fn_llamada_record", { p_chat_id: callState.chatId, p_tipo: `call_${callState.tipo}`, p_duracion: duracion });
      }
    }

    setActiveSince(null);
    setCallState({ status: "idle" });
  }, [callState, activeSince, recordMissed]);

  const joinCall = useCallback(async (llamadaId: number, roomName: string, chatId: string, tipo: "audio" | "video", participanteNombre: string, participanteFoto: string | undefined, miembros: CallMiembro[]) => {
    if (!userId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = await fetchLivekitToken(roomName, chatId, session?.access_token);
    setEndReason(null);
    setActiveSince(Date.now());
    setCallState({ status: "active", llamadaId, roomName, chatId, tipo, camera: tipo === "video", token, isInitiator: false, participanteNombre, participanteFoto, miembros });
  }, [userId]);

  /** Someone joined the room the caller opened: the call is answered. */
  const markActive = useCallback(() => {
    if (callState.status === "outgoing") {
      setActiveSince(Date.now());
      void setCallEstado(callState.llamadaId, "active");
      setCallState({
        status: "active",
        llamadaId: callState.llamadaId,
        roomName: callState.roomName,
        chatId: callState.chatId,
        tipo: callState.tipo,
        camera: callState.camera,
        token: callState.token,
        isInitiator: true,
        participanteNombre: callState.participanteNombre,
        participanteFoto: callState.participanteFoto,
        miembros: callState.miembros,
      });
    }
  }, [callState]);

  const clearEndReason = useCallback(() => setEndReason(null), []);

  const activeToken =
    callState.status === "outgoing" || callState.status === "active"
      ? callState.token
      : null;

  return { callState, startCall, joinCall, acceptCall, endCall, markActive, activeToken, activeSince, endReason, clearEndReason };
}
