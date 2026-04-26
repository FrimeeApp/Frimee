import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { getProfileImagesBucket } from "@/config/external";

export type ThemePreference = "SYSTEM" | "LIGHT" | "DARK";
export type ProfileVisibility = "PUBLICO" | "PRIVADO";

export type UserSettingsRow = {
  user_id: string;
  theme: ThemePreference;
  language: string;
  timezone: string;
  notify_push: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  profile_visibility: ProfileVisibility;
  allow_friend_requests: boolean;
  google_sync_enabled: boolean;
  google_sync_export_plans: boolean;
};

export type UpsertUserSettingsParams = {
  userId: string;
  theme?: ThemePreference | null;
  language?: string | null;
  timezone?: string | null;
  notifyPush?: boolean | null;
  notifyEmail?: boolean | null;
  notifyInApp?: boolean | null;
  profileVisibility?: ProfileVisibility | null;
  allowFriendRequests?: boolean | null;
  googleSyncEnabled?: boolean | null;
  googleSyncExportPlans?: boolean | null;
};

export type UpsertUserProfileAndSettingsParams = {
  userId: string;
  nombre?: string | null;
  username?: string | null;
  fechaNac?: string | null;
  profileImage?: string | null;
  theme?: ThemePreference | null;
  language?: string | null;
  timezone?: string | null;
  notifyPush?: boolean | null;
  notifyEmail?: boolean | null;
  notifyInApp?: boolean | null;
  profileVisibility?: ProfileVisibility | null;
  allowFriendRequests?: boolean | null;
  googleSyncEnabled?: boolean | null;
  googleSyncExportPlans?: boolean | null;
};

export type UserProfileAndSettingsRow = {
  user_id: string;
  nombre: string;
  username: string | null;
  fecha_nac: string | null;
  profile_image: string | null;
  theme: ThemePreference;
  language: string;
  timezone: string;
  notify_push: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  profile_visibility: ProfileVisibility;
  allow_friend_requests: boolean;
  google_sync_enabled?: boolean | null;
  google_sync_export_plans?: boolean | null;
};

const profileImagesBucket = getProfileImagesBucket();

export async function fetchUserSettingsByUserId(): Promise<UserSettingsRow | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_user_settings_get");

  if (error) throw error;
  const rows = (data ?? []) as UserSettingsRow[];
  return rows[0] ?? null;
}

export async function upsertUserSettingsRpc(params: UpsertUserSettingsParams): Promise<UserSettingsRow> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_user_settings_upsert", {
    p_user_id: params.userId,
    p_theme: params.theme ?? null,
    p_language: params.language ?? null,
    p_timezone: params.timezone ?? null,
    p_notify_push: params.notifyPush ?? null,
    p_notify_email: params.notifyEmail ?? null,
    p_notify_in_app: params.notifyInApp ?? null,
    p_profile_visibility: params.profileVisibility ?? null,
    p_allow_friend_requests: params.allowFriendRequests ?? null,
    p_google_sync_enabled: params.googleSyncEnabled ?? null,
    p_google_sync_export_plans: params.googleSyncExportPlans ?? null,
  });

  if (error) throw error;

  return data as UserSettingsRow;
}

export async function upsertUserProfileAndSettingsRpc(
  params: UpsertUserProfileAndSettingsParams,
): Promise<UserProfileAndSettingsRow> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.rpc("fn_user_profile_and_settings_upsert", {
    p_user_id: params.userId,
    p_nombre: params.nombre ?? null,
    p_username: params.username ?? null,
    p_fecha_nac: params.fechaNac ?? null,
    p_profile_image: params.profileImage ?? null,
    p_theme: params.theme ?? null,
    p_language: params.language ?? null,
    p_timezone: params.timezone ?? null,
    p_notify_push: params.notifyPush ?? null,
    p_notify_email: params.notifyEmail ?? null,
    p_notify_in_app: params.notifyInApp ?? null,
    p_profile_visibility: params.profileVisibility ?? null,
    p_allow_friend_requests: params.allowFriendRequests ?? null,
    p_google_sync_enabled: params.googleSyncEnabled ?? null,
    p_google_sync_export_plans: params.googleSyncExportPlans ?? null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("La RPC fn_user_profile_and_settings_upsert no devolvio datos.");
  }

  return row as UserProfileAndSettingsRow;
}

export async function uploadProfileImageToSupabaseStorage(params: {
  userId: string;
  file: File;
}): Promise<{ path: string; publicUrl: string }> {
  const supabase = createBrowserSupabaseClient();
  const path = `${params.userId}/image`;

  const { error: uploadError } = await supabase.storage
    .from(profileImagesBucket)
    .upload(path, params.file, { upsert: true, contentType: params.file.type || undefined });

  if (uploadError) {
    throw new Error(
      `[storage:${profileImagesBucket}] ${uploadError.message}${uploadError.name ? ` (${uploadError.name})` : ""}`,
    );
  }

  const { data } = supabase.storage.from(profileImagesBucket).getPublicUrl(path);
  if (!data.publicUrl) {
    throw new Error("No se pudo generar la URL publica de la imagen.");
  }

  return { path, publicUrl: data.publicUrl };
}
