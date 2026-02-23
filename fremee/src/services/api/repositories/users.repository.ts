import {
  fetchPublicUserProfileById,
  fetchUserProfileById,
  type PublicUserProfileRow,
  type UserProfileRow,
} from "@/services/api/endpoints/users.endpoint";

export type UserProfileDto = UserProfileRow;
export type PublicUserProfileDto = PublicUserProfileRow;

export async function getUserProfile(userId: string): Promise<UserProfileDto | null> {
  return fetchUserProfileById(userId);
}

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfileDto | null> {
  return fetchPublicUserProfileById(userId);
}

