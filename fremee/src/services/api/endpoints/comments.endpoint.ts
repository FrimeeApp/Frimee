import {
  listCommentsForPlanRoute,
  listPreviewCommentsForPlansRoute,
  createCommentRoute,
  getTopCommentForPlanRoute,
  listTopCommentsForPlansRoute,
  toggleCommentLikeRoute,
  type CommentDto,
  type TopCommentDto,
} from "@/services/api/posts/comments/route";

export type CreateCommentParams = {
  planId: number;
  userId: string;
  userName: string;
  userProfileImage?: string | null;
  content: string;
};

export type ToggleCommentLikeParams = {
  planId: number;
  commentId: string;
  userId: string;
};

export async function createCommentEndpoint(params: CreateCommentParams) {
  return createCommentRoute(params);
}

export async function toggleCommentLikeEndpoint(params: ToggleCommentLikeParams) {
  return toggleCommentLikeRoute(params);
}

export async function getTopCommentForPlanEndpoint(params: {
  planId: number;
  userId?: string;
}): Promise<TopCommentDto | null> {
  return getTopCommentForPlanRoute(params);
}

export async function listTopCommentsForPlansEndpoint(params: {
  planIds: number[];
  userId?: string;
}) {
  return listTopCommentsForPlansRoute(params);
}

export async function listCommentsForPlanEndpoint(params: {
  planId: number;
  userId?: string;
  limit?: number;
}): Promise<{ comments: CommentDto[] }> {
  return listCommentsForPlanRoute(params);
}

export async function listPreviewCommentsForPlansEndpoint(params: {
  planIds: number[];
  userId?: string;
  limitPerPlan?: number;
}) {
  return listPreviewCommentsForPlansRoute(params);
}
