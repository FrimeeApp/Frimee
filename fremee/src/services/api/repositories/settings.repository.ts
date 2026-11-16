import {
  fetchUserSettingsByUserId,
  fetchNotificationPreferences,
  upsertNotificationPreferences,
  uploadProfileImageToSupabaseStorage,
  upsertUserProfileAndSettingsRpc,
  upsertUserSettingsRpc,
  type ProfileVisibility,
  type ThemePreference,
  type UpsertUserProfileAndSettingsParams,
  type UserProfileAndSettingsRow,
  type UserSettingsRow,
} from "@/services/api/endpoints/settings.endpoint";
import type { NotificationPreferences } from "@/services/notifications/preferences";

export type UserSettingsDto = UserSettingsRow;
export type UserSettingsTheme = ThemePreference;
export type UserSettingsVisibility = ProfileVisibility;
export type UserProfileAndSettingsDto = UserProfileAndSettingsRow;

export async function getUserSettings(userId: string): Promise<UserSettingsDto | null> {
  void userId;
  return fetchUserSettingsByUserId();
}

/** Only the theme (the other settings stay as they are: the RPC keeps what comes as null). */
export async function saveThemePreference(userId: string, theme: ThemePreference): Promise<UserSettingsDto> {
  return upsertUserSettingsRpc({ userId, theme });
}

export async function saveUserProfileAndSettings(
  params: UpsertUserProfileAndSettingsParams,
): Promise<UserProfileAndSettingsDto> {
  return upsertUserProfileAndSettingsRpc(params);
}

export async function uploadProfileImage(params: { userId: string; file: File }) {
  return uploadProfileImageToSupabaseStorage(params);
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return fetchNotificationPreferences();
}

export async function saveNotificationPreferences(
  prefs: NotificationPreferences
): Promise<NotificationPreferences> {
  return upsertNotificationPreferences(prefs);
}
