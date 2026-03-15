import {
  listPlanLikeCountsEndpoint,
  listUserPlanLikesEndpoint,
  togglePlanLikeEndpoint,
  type TogglePlanLikeParams,
} from "@/services/api/endpoints/likes.endpoint";

export async function togglePlanLike(params: TogglePlanLikeParams) {
  return togglePlanLikeEndpoint(params);
}

export async function listUserLikedPlanIds(params: { userId: string; planIds: number[] }) {
  const result = await listUserPlanLikesEndpoint(params);
  return result.likedPlanIds;
}

export async function listPlanLikeCounts(params: { planIds: number[] }) {
  const result = await listPlanLikeCountsEndpoint(params);
  return result.likeCountsByPlanId;
}
