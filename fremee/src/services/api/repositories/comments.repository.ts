import {
  createCommentEndpoint,
  deleteCommentEndpoint,
  getTopCommentForPlanEndpoint,
  listCommentsForPlanEndpoint,
  listPreviewCommentsForPlansEndpoint,
  listTopCommentsForPlansEndpoint,
  toggleCommentLikeEndpoint,
  type CreateCommentParams,
  type ToggleCommentLikeParams,
} from "@/services/api/endpoints/comments.endpoint";

export { type CommentDto, type TopCommentDto } from "@/services/api/posts/comments/route";

export async function createComment(params: CreateCommentParams) {
  return createCommentEndpoint(params);
}

export async function deleteComment(params: { planId: number; commentId: string }) {
  return deleteCommentEndpoint(params);
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

export async function listCommentsForPlan(params: {
  planId: number;
  userId?: string;
  limit?: number;
}) {
  const result = await listCommentsForPlanEndpoint(params);
  return result.comments;
}

export async function listPreviewCommentsForPlans(params: {
  planIds: number[];
  userId?: string;
  limitPerPlan?: number;
}) {
  const result = await listPreviewCommentsForPlansEndpoint(params);
  return result.previewCommentsByPlanId;
}
