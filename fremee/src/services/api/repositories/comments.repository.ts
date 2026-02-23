import {
  createCommentEndpoint,
  getTopCommentForPlanEndpoint,
  listTopCommentsForPlansEndpoint,
  toggleCommentLikeEndpoint,
  type CreateCommentParams,
  type ToggleCommentLikeParams,
} from "@/services/api/endpoints/comments.endpoint";

export { type TopCommentDto } from "@/services/api/posts/comments/route";

export async function createComment(params: CreateCommentParams) {
  return createCommentEndpoint(params);
}

export async function toggleCommentLike(params: ToggleCommentLikeParams) {
  return toggleCommentLikeEndpoint(params);
}

export async function getTopCommentForPlan(params: { planId: number; userId?: string }) {
  return getTopCommentForPlanEndpoint(params);
}

export async function listTopCommentsForPlans(params: { planIds: number[]; userId?: string }) {
  const result = await listTopCommentsForPlansEndpoint(params);
  return result.topCommentsByPlanId;
}
