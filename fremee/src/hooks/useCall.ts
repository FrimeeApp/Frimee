"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

const supabase = createBrowserSupabaseClient();

export type CallState =
  | { status: "idle" }
  | { status: "outgoing"; roomName: string; chatId: string; tipo: "audio" | "video"; token: string }
  | { status: "incoming"; roomName: string; chatId: string; tipo: "audio" | "video"; llamadaId: number; callerName: string; callerFoto?: string }
  | { status: "active"; roomName: string; chatId: string; tipo: "audio" | "video"; token: string };

export function useCall() {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({ status: "idle" });

  // Listen for incoming calls via Supabase Realtime
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "llamadas",
          filter: `estado=eq.ringing`,
        },
        async (payload: { new: Record<string, unknown> }) => {
          const llamada = payload.new as {
            id: number; chat_id: string; room_name: string;
            tipo: "audio" | "video"; iniciado_por_user_id: string;
          };

          // Don't notify if we started the call
          if (llamada.iniciado_por_user_id === user.id) return;

          // Check if we're in this chat
          const { data: member } = await supabase
            .from("chat_miembro")
            .select("user_id")
            .eq("chat_id", llamada.chat_id)
            .eq("user_id", user.id)
            .single();
          if (!member) return;

          // Get caller info
          const { data: caller } = await supabase
            .from("usuarios")
            .select("nombre, profile_image")
            .eq("id", llamada.iniciado_por_user_id)
            .single();

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
      .subscribe();

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

    setCallState({ status: "outgoing", roomName, chatId, tipo, token });
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

    setCallState({ status: "active", roomName, chatId, tipo, token });
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
    }

    setCallState({ status: "idle" });
  }, [callState]);

  const activeToken =
    callState.status === "outgoing" || callState.status === "active"
      ? callState.token
      : null;

  return { callState, startCall, acceptCall, endCall, activeToken };
}
