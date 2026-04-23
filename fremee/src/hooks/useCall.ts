"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

const supabase = createBrowserSupabaseClient();

export type CallMiembro = { id: string; nombre: string; foto?: string };

export type CallState =
  | { status: "idle" }
  | { status: "outgoing"; roomName: string; chatId: string; tipo: "audio" | "video"; token: string; isInitiator: true; participanteNombre: string; participanteFoto?: string; miembros: CallMiembro[] }
  | { status: "incoming"; roomName: string; chatId: string; tipo: "audio" | "video"; llamadaId: number; callerName: string; callerFoto?: string; miembros: CallMiembro[] }
  | { status: "active"; roomName: string; chatId: string; tipo: "audio" | "video"; token: string; isInitiator: boolean; participanteNombre: string; participanteFoto?: string; miembros: CallMiembro[] };

export function useCall() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  const activeSinceRef = useRef<number | null>(null);

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "llamadas",
        },
        async (payload: { new: Record<string, unknown> }) => {
          const llamada = payload.new as {
            id: number; chat_id: string; room_name: string;
            tipo: "audio" | "video"; iniciado_por_user_id: string;
          };

          if (llamada.iniciado_por_user_id === userId) return;

          // Resolve display info using fn_chats_list (avoids RLS issues)
          const { data: chatsList } = await supabase.rpc("fn_chats_list");
          type ChatRow = { chat_id: string; tipo: string; nombre: string | null; foto: string | null; miembros: Array<{ id: string; nombre: string; profile_image: string | null }> };
          const chatInfo = (chatsList as ChatRow[] | null)?.find((c) => c.chat_id === llamada.chat_id);
          const miembros: CallMiembro[] = (chatInfo?.miembros ?? []).map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));

          let callerName = "Usuario";
          let callerFoto: string | undefined;
          if (chatInfo?.tipo === "GRUPO") {
            callerName = chatInfo.nombre ?? "Grupo";
            callerFoto = chatInfo.foto ?? undefined;
          } else {
            const caller = chatInfo?.miembros?.find((m) => m.id === llamada.iniciado_por_user_id);
            callerName = caller?.nombre ?? "Usuario";
            callerFoto = caller?.profile_image ?? undefined;
          }

          setCallState({
            status: "incoming",
            roomName: llamada.room_name,
            chatId: llamada.chat_id,
            tipo: llamada.tipo,
            llamadaId: llamada.id,
            callerName,
            callerFoto,
            miembros,
          });
        }
      )
      .subscribe((status) => console.log("[call] channel status", status));

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const startCall = useCallback(async (chatId: string, tipo: "audio" | "video" = "audio", participanteNombre = "Usuario", participanteFoto?: string, miembros: CallMiembro[] = []) => {
    if (!userId) return;

    const roomName = `call_${chatId}_${Date.now()}`;

    const { data: llamada, error } = await supabase
      .from("llamadas")
      .insert({ chat_id: chatId, room_name: roomName, iniciado_por_user_id: userId, tipo, estado: "ringing" })
      .select()
      .single();
    if (error || !llamada) { console.error("[call] create error", error?.message, error?.code, error?.details, error?.hint); return; }

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ roomName, chatId }),
    });
    const { token } = await res.json();

    activeSinceRef.current = null;
    setCallState({ status: "outgoing", roomName, chatId, tipo, token, isInitiator: true, participanteNombre, participanteFoto, miembros });
  }, [userId]);

  const acceptCall = useCallback(async () => {
    if (callState.status !== "incoming") return;
    const { roomName, chatId, tipo, llamadaId, miembros } = callState;

    await supabase.from("llamadas").update({ estado: "active" }).eq("id", llamadaId);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ roomName, chatId }),
    });
    const { token } = await res.json();

    activeSinceRef.current = Date.now();
    setCallState({ status: "active", roomName, chatId, tipo, token, isInitiator: false, participanteNombre: callState.callerName, participanteFoto: callState.callerFoto, miembros });
  }, [callState]);

  const endCall = useCallback(async (endForAll = false) => {
    if (callState.status === "idle") return;

    const isGroup = "miembros" in callState && callState.miembros.length > 2;

    if (callState.status === "incoming") {
      void supabase
        .from("llamadas")
        .update({ estado: "missed", finalizada_at: new Date().toISOString() })
        .eq("room_name", callState.roomName);
    } else if (isGroup && !endForAll && callState.status === "active") {
      // Group call member leaving without ending for all: just disconnect locally
    } else if (isGroup && !endForAll && callState.status === "outgoing") {
      // Initiator hanging up before anyone answered: mark as missed
      void supabase
        .from("llamadas")
        .update({ estado: "missed", finalizada_at: new Date().toISOString() })
        .eq("room_name", callState.roomName);
    } else {
      await supabase
        .from("llamadas")
        .update({ estado: "ended", finalizada_at: new Date().toISOString() })
        .eq("room_name", callState.roomName);

      if (callState.status === "outgoing" || (callState.status === "active" && callState.isInitiator)) {
        const duracion = activeSinceRef.current
          ? Math.floor((Date.now() - activeSinceRef.current) / 1000)
          : null;
        const wasAnswered = activeSinceRef.current !== null;
        const tipoMensaje = wasAnswered
          ? `call_${callState.tipo}`
          : `call_missed_${callState.tipo}`;

        await supabase.rpc("fn_llamada_record", {
          p_chat_id: callState.chatId,
          p_tipo: tipoMensaje,
          p_duracion: duracion,
        });
      }
    }

    activeSinceRef.current = null;
    setCallState({ status: "idle" });
  }, [callState]);

  const joinCall = useCallback(async (llamadaId: number, roomName: string, chatId: string, tipo: "audio" | "video", participanteNombre: string, participanteFoto: string | undefined, miembros: CallMiembro[]) => {
    if (!userId) return;
    void llamadaId; // kept for potential future use (e.g. marking active)
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/livekit/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
      body: JSON.stringify({ roomName, chatId }),
    });
    const { token } = await res.json() as { token: string };
    activeSinceRef.current = Date.now();
    setCallState({ status: "active", roomName, chatId, tipo, token, isInitiator: false, participanteNombre, participanteFoto, miembros });
  }, [userId]);

  const markActive = useCallback(() => {
    if (callState.status === "outgoing") {
      activeSinceRef.current = Date.now();
      setCallState({
        status: "active",
        roomName: callState.roomName,
        chatId: callState.chatId,
        tipo: callState.tipo,
        token: callState.token,
        isInitiator: true,
        participanteNombre: callState.participanteNombre,
        participanteFoto: callState.participanteFoto,
        miembros: callState.miembros,
      });
    }
  }, [callState]);

  const activeToken =
    callState.status === "outgoing" || callState.status === "active"
      ? callState.token
      : null;

  return { callState, startCall, joinCall, acceptCall, endCall, markActive, activeToken };
}
