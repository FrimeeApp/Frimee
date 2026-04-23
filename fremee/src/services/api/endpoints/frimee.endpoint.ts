import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type FrimeeResult = {
  command: string | null;
  reply: string;
};

export type FrimeeHistoryEntry = { role: "user" | "assistant"; content: string };

export async function callFrimeeAssistant(params: {
  message: string;
  members: Array<{ id: string; nombre: string }>;
  planInfo?: { titulo: string; ubicacion_nombre: string };
  isAdmin?: boolean;
  userId: string;
  planId?: number;
  history?: FrimeeHistoryEntry[];
  userLocation?: { lat: number; lng: number };
}): Promise<FrimeeResult> {
  const supabase = createBrowserSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("frimee-assistant", {
    body: params,
    headers: session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : undefined,
  });
  if (error) throw error;
  return data as FrimeeResult;
}
