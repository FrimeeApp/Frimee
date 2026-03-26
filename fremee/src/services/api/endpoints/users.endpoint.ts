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

export async function searchPublicUserProfiles(params: {
  query: string;
  limit?: number;
  excludeUserId?: string;
}): Promise<PublicUserProfileRow[]> {
  const trimmedQuery = params.query.trim();
  if (!trimmedQuery) return [];

  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_users_search_public", {
    p_query: trimmedQuery,
    p_limit: params.limit ?? 8,
    p_exclude_user_id: params.excludeUserId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as PublicUserProfileRow[];
}

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

  const { data, error } = await supabase.rpc("fn_user_profile_get_public", {
    p_user_id: userId,
  });

  if (error) throw error;
  const rows = (data ?? []) as PublicUserProfileRow[];
  return rows[0] ?? null;
}

export async function fetchActiveFriends(): Promise<PublicUserProfileRow[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_friends_list_active");
  if (error) throw error;
  return (data ?? []) as PublicUserProfileRow[];
}

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_friend_request_send", {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
}

export async function getFriendshipStatuses(
  userIds: string[]
): Promise<Record<string, "none" | "pending" | "friends">> {
  if (userIds.length === 0) return {};
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_friendship_statuses", {
    p_user_ids: userIds,
  });
  if (error) throw error;
  const result: Record<string, "none" | "pending" | "friends"> = {};
  for (const row of (data ?? []) as Array<{ other_user_id: string; status: string }>) {
    result[row.other_user_id] = row.status as "none" | "pending" | "friends";
  }
  return result;
}

export async function cancelFriendRequest(targetUserId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_friend_request_cancel", {
    p_target_user_id: targetUserId,
  });
  if (error) throw error;
}

export async function removeFriend(otherUserId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_friend_remove", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;
}

export async function followUser(targetUserId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("seguidores")
    .insert({ follower_id: user.id, following_id: targetUserId });
  if (error && error.code !== "23505") throw error;
}

export async function unfollowUser(targetUserId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { error } = await supabase
    .from("seguidores")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);
  if (error) throw error;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const { count, error } = await supabase
    .from("seguidores")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export async function getFollowStatuses(targetUserIds: string[]): Promise<Record<string, boolean>> {
  if (targetUserIds.length === 0) return {};
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return {};
  const { data, error } = await supabase
    .from("seguidores")
    .select("following_id")
    .eq("follower_id", user.id)
    .in("following_id", targetUserIds);
  if (error) throw error;
  const result: Record<string, boolean> = {};
  for (const id of targetUserIds) result[id] = false;
  for (const row of (data ?? []) as { following_id: string }[]) {
    result[row.following_id] = true;
  }
  return result;
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
