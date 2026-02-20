import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseEnv, supabaseUrl, supabaseAnonKey } from "./config";

export const createBrowserSupabaseClient = () => {
  assertSupabaseEnv();
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
};
