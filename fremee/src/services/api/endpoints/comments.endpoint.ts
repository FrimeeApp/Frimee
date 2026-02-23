import {
  createCommentRoute,
  getTopCommentForPlanRoute,
  listTopCommentsForPlansRoute,
  toggleCommentLikeRoute,
  type TopCommentDto,
} from "@/services/api/posts/comments/route";

export type CreateCommentParams = {
  planId: number;
  userId: string;
  userName: string;
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
