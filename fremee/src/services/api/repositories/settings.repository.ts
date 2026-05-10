import {
  fetchUserSettingsByUserId,
  fetchNotificationPreferences,
  upsertNotificationPreferences,
  uploadProfileImageToSupabaseStorage,
  upsertUserProfileAndSettingsRpc,
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
