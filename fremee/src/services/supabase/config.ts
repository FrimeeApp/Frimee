export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export function assertSupabaseEnv() {
  if (!supabaseUrl) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) throw new Error("Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
}
