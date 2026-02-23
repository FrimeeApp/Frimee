import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type UserProfileRow = {
  id: string;
  nombre: string;
  fecha_nac: string | null;
  email: string;
  rol: string;
  profile_image: string | null;
  estado: string;
  email_verified_at: string | null;
  deleted_at: string | null;
};

export type PublicUserProfileRow = {
  id: string;
  nombre: string;
  profile_image: string | null;
};

export async function fetchUserProfileById(userId: string): Promise<UserProfileRow | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id,nombre,fecha_nac,email,rol,profile_image,estado,email_verified_at,deleted_at")
    .eq("id", userId)
    .maybeSingle();

  console.log("[users] fetchUserProfileById", {
    userId,
    data,
    error: error ? { message: error.message, code: error.code, details: error.details } : null,
  });

  if (error) throw error;
  return (data as UserProfileRow | null) ?? null;
}

export async function fetchPublicUserProfileById(userId: string): Promise<PublicUserProfileRow | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("usuarios_public")
    .select("id,nombre,profile_image")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data as PublicUserProfileRow | null) ?? null;
}

