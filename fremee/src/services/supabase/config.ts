import { publicEnv } from "@/config/env";

export const supabaseUrl = publicEnv.supabaseUrl;
export const supabaseAnonKey = publicEnv.supabasePublishableKey;

export function assertSupabaseEnv() {
  if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
}
