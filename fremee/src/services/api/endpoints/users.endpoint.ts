import { createBrowserSupabaseClient } from "@/services/supabase/client";
import type { UserSettingsRow } from "@/services/api/endpoints/settings.endpoint";

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

export type UserAuthSnapshotRow = {
  profile: UserProfileRow | null;
  settings: UserSettingsRow | null;
};

type UserAuthSnapshotRpcRow = {
  id: string;
  nombre: string;
  fecha_nac: string | null;
  email: string;
  rol: string;
  profile_image: string | null;
  estado: string;
  email_verified_at: string | null;
  deleted_at: string | null;
  user_id: string | null;
  theme: UserSettingsRow["theme"] | null;
  language: string | null;
  timezone: string | null;
  notify_push: boolean | null;
  notify_email: boolean | null;
  notify_in_app: boolean | null;
  profile_visibility: UserSettingsRow["profile_visibility"] | null;
  allow_friend_requests: boolean | null;
  google_sync_enabled?: boolean | null;
  google_sync_export_plans?: boolean | null;
};

export async function fetchPublicUserProfileById(userId: string): Promise<PublicUserProfileRow | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("usuarios_public")
    .select("id,nombre,profile_image")
    .eq("id", userId)
    .maybeSingle();

  console.log("[users] usuarios_public by id", {
    userId,
    data,
    error: error ? { message: error.message, code: error.code, details: error.details } : null,
  });

  if (error) throw error;
  return (data as PublicUserProfileRow | null) ?? null;
}

export async function fetchUserAuthSnapshotById(userId: string): Promise<UserAuthSnapshotRow> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_user_auth_snapshot_get", {
    p_user_id: userId,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as UserAuthSnapshotRpcRow | null;
  if (!row) {
    return { profile: null, settings: null };
  }

  return {
    profile: {
      id: row.id,
      nombre: row.nombre,
      fecha_nac: row.fecha_nac,
      email: row.email,
      rol: row.rol,
      profile_image: row.profile_image,
      estado: row.estado,
      email_verified_at: row.email_verified_at,
      deleted_at: row.deleted_at,
    },
    settings: row.user_id
      ? {
          user_id: row.user_id,
          theme: row.theme ?? "SYSTEM",
          language: row.language ?? "es",
          timezone: row.timezone ?? "Europe/Madrid",
          notify_push: row.notify_push ?? true,
          notify_email: row.notify_email ?? true,
          notify_in_app: row.notify_in_app ?? true,
          profile_visibility: row.profile_visibility ?? "PUBLICO",
          allow_friend_requests: row.allow_friend_requests ?? true,
          google_sync_enabled: row.google_sync_enabled ?? false,
          google_sync_export_plans: row.google_sync_export_plans ?? true,
        }
      : null,
  };
}
