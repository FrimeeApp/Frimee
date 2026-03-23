"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

const supabase = createBrowserSupabaseClient();

export type CallState =
  | { status: "idle" }
  | { status: "outgoing"; roomName: string; chatId: string; tipo: "audio" | "video"; token: string; isInitiator: true }
  | { status: "incoming"; roomName: string; chatId: string; tipo: "audio" | "video"; llamadaId: number; callerName: string; callerFoto?: string }
  | { status: "active"; roomName: string; chatId: string; tipo: "audio" | "video"; token: string; isInitiator: boolean };

export function useCall() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({ status: "idle" });
  // Track when the call became active to calculate duration
  const activeSinceRef = useRef<number | null>(null);

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
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

          // Don't notify if we started the call
          if (llamada.iniciado_por_user_id === user.id) return;

          // Get caller info
          const { data: caller } = await supabase
            .from("usuarios")
            .select("nombre, profile_image")
            .eq("id", llamada.iniciado_por_user_id)
            .maybeSingle();

          setCallState({
            status: "incoming",
            roomName: llamada.room_name,
            chatId: llamada.chat_id,
            tipo: llamada.tipo,
            llamadaId: llamada.id,
            callerName: caller?.nombre ?? "Usuario",
            callerFoto: caller?.profile_image ?? undefined,
          });
        }
      )
      .subscribe((status) => console.log("[call] channel status", status));

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const startCall = useCallback(async (chatId: string, tipo: "audio" | "video" = "audio") => {
    if (!user?.id) return;

    const roomName = `call_${chatId}_${Date.now()}`;

    // Create call record
    const { data: llamada, error } = await supabase
      .from("llamadas")
      .insert({ chat_id: chatId, room_name: roomName, iniciado_por_user_id: user.id, tipo, estado: "ringing" })
      .select()
      .single();
    if (error || !llamada) { console.error("[call] create error", error?.message, error?.code, error?.details, error?.hint); return; }

    // Get token
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
    setCallState({ status: "outgoing", roomName, chatId, tipo, token, isInitiator: true });
  }, [user?.id]);

  const acceptCall = useCallback(async () => {
    if (callState.status !== "incoming") return;
    const { roomName, chatId, tipo, llamadaId } = callState;

    // Update call state to active
    await supabase.from("llamadas").update({ estado: "active" }).eq("id", llamadaId);

    // Get token
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
    setCallState({ status: "active", roomName, chatId, tipo, token, isInitiator: false });
  }, [callState]);

  const endCall = useCallback(async () => {
    if (callState.status === "idle") return;

    if (callState.status === "incoming") {
      await supabase
        .from("llamadas")
        .update({ estado: "missed", finalizada_at: new Date().toISOString() })
        .eq("room_name", callState.roomName);
    } else {
      await supabase
        .from("llamadas")
        .update({ estado: "ended", finalizada_at: new Date().toISOString() })
        .eq("room_name", callState.roomName);

      // Insert call record in chat — only the initiator writes it to avoid duplicates
      if (callState.status === "outgoing" || (callState.status === "active" && callState.isInitiator)) {
        const duracion = activeSinceRef.current
          ? Math.floor((Date.now() - activeSinceRef.current) / 1000)
          : null;
        const wasAnswered = activeSinceRef.current !== null;
        const tipoMensaje = wasAnswered
          ? `call_${callState.tipo}` // 'call_audio' | 'call_video'
          : `call_missed_${callState.tipo}`; // 'call_missed_audio' | 'call_missed_video'

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

  // Mark call as active when outgoing call is answered (caller side)
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
      });
    }
  }, [callState]);

  const activeToken =
    callState.status === "outgoing" || callState.status === "active"
      ? callState.token
      : null;

  return { callState, startCall, acceptCall, endCall, markActive, activeToken };
}
