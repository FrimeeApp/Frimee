import {
  fetchUserAuthSnapshotById,
  fetchPublicUserProfileById,
  type PublicUserProfileRow,
  type UserAuthSnapshotRow,
  type UserProfileRow,
} from "@/services/api/endpoints/users.endpoint";

export type UserProfileDto = UserProfileRow;
export type PublicUserProfileDto = PublicUserProfileRow;
export type UserAuthSnapshotDto = UserAuthSnapshotRow;

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfileDto | null> {
  return fetchPublicUserProfileById(userId);
}

export async function getUserAuthSnapshot(userId: string): Promise<UserAuthSnapshotDto> {
  return fetchUserAuthSnapshotById(userId);
}

