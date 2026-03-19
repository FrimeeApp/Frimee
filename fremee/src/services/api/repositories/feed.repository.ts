import type { FeedItemDto } from "@/services/api/dtos/feed.dto";
import { listPublishedPostPlanIdsEndpoint } from "@/services/api/endpoints/feed.endpoint";
import { listUserPlanLikesEndpoint, listPlanLikeCountsEndpoint } from "@/services/api/endpoints/likes.endpoint";
import { listPlansByIdsInOrder } from "@/services/api/repositories/plans.repository";

export async function listPublishedPostPlanIds(params: { limit?: number } = {}) {
  return listPublishedPostPlanIdsEndpoint({ limit: params.limit ?? 20 });
}

export async function getFeedPage(params: { userId: string; limit?: number }): Promise<FeedItemDto[]> {
  const publishedPlanIds = await listPublishedPostPlanIds({
    limit: params.limit ?? 20,
  });
  const plans = await listPlansByIdsInOrder(publishedPlanIds);
  const resolvedPlanIds = plans.map((plan) => plan.id);

  const [likedPlansResult, likeCountsResult] = await Promise.all([
    listUserPlanLikesEndpoint({
      userId: params.userId,
      planIds: resolvedPlanIds,
    }),
    listPlanLikeCountsEndpoint({
      planIds: resolvedPlanIds,
    }),
  ]);

  const likedSet = new Set<number>(likedPlansResult.likedPlanIds);

  return plans.map((plan) => {
    const userName = plan.creator?.name || "Usuario";

    return {
      id: String(plan.id),
      userName,
      avatarLabel: (userName.trim()[0] || "U").toUpperCase(),
      avatarImage: plan.creator?.profileImage ?? null,
      subtitle: plan.title,
      text: plan.description,
      hasImage: Boolean(plan.coverImage),
      coverImage: plan.coverImage ?? null,
      plan,
      initiallyLiked: likedSet.has(plan.id),
      initialLikeCount: likeCountsResult.likeCountsByPlanId[plan.id] ?? 0,
    };
  });
}
