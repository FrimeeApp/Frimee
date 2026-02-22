import { fetchUserProfileById, type UserProfileRow } from "@/services/api/endpoints/users.endpoint";

export type UserProfileDto = UserProfileRow;

export async function getUserProfile(userId: string): Promise<UserProfileDto | null> {
  return fetchUserProfileById(userId);
}

