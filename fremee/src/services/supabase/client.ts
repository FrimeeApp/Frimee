import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { assertSupabaseEnv, supabaseUrl, supabaseAnonKey } from "./config";
import { capacitorStorage } from "./storage";

let browserClient: SupabaseClient | null = null;

export const createBrowserSupabaseClient = () => {
  if (browserClient) return browserClient;

  assertSupabaseEnv();

  // Evaluate at call-time (not module load time) so the Capacitor bridge
  // is guaranteed to be initialized before we decide which storage to use.
  const isNative = Capacitor.isNativePlatform();

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: isNative ? capacitorStorage : undefined,
    },
  });

  return browserClient;
};
