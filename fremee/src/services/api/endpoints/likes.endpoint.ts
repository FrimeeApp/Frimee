import {
  listPlanLikeCountsRoute,
  listUserPlanLikesRoute,
  togglePlanLikeRoute,
} from "@/services/api/posts/likes/route";

export type TogglePlanLikeParams = {
  planId: number;
  userId: string;
};

export async function togglePlanLikeEndpoint(params: TogglePlanLikeParams) {
  return togglePlanLikeRoute(params);
}

export async function listUserPlanLikesEndpoint(params: {
  userId: string;
  planIds: number[];
}) {
  return listUserPlanLikesRoute(params);
}

export async function listPlanLikeCountsEndpoint(params: { planIds: number[] }) {
  return listPlanLikeCountsRoute(params);
}
