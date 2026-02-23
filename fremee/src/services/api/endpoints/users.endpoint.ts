import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type UserProfileRow = {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  profile_image: string | null;
  estado: string;
  email_verified_at: string | null;
  deleted_at: string | null;
};

export async function fetchUserProfileById(userId: string): Promise<UserProfileRow | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,email,rol,profile_image,estado,email_verified_at,deleted_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as UserProfileRow | null) ?? null;
}

