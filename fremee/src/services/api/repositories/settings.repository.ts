import {
  fetchUserSettingsByUserId,
  uploadProfileImageToSupabaseStorage,
  upsertUserProfileAndSettingsRpc,
  type ProfileVisibility,
  type ThemePreference,
  type UpsertUserProfileAndSettingsParams,
  type UserProfileAndSettingsRow,
  type UserSettingsRow,
} from "@/services/api/endpoints/settings.endpoint";

export type UserSettingsDto = UserSettingsRow;
export type UserSettingsTheme = ThemePreference;
export type UserSettingsVisibility = ProfileVisibility;
export type UserProfileAndSettingsDto = UserProfileAndSettingsRow;

export async function getUserSettings(userId: string): Promise<UserSettingsDto | null> {
  return fetchUserSettingsByUserId(userId);
}

export async function saveUserProfileAndSettings(
  params: UpsertUserProfileAndSettingsParams,
): Promise<UserProfileAndSettingsDto> {
  return upsertUserProfileAndSettingsRpc(params);
}

export async function uploadProfileImage(params: { userId: string; file: File }) {
  return uploadProfileImageToSupabaseStorage(params);
}
