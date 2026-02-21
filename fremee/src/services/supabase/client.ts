import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseEnv, supabaseUrl, supabaseAnonKey } from "./config";
import { capacitorStorage } from "./storage";

const isCapacitor =
  typeof window !== "undefined" &&
  !!(window as Window & { Capacitor?: unknown }).Capacitor;

let browserClient: SupabaseClient | null = null;

export const createBrowserSupabaseClient = () => {
  if (browserClient) return browserClient;

  assertSupabaseEnv();

  browserClient = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: isCapacitor ? capacitorStorage : undefined,
    },
  });

  return browserClient;
};
