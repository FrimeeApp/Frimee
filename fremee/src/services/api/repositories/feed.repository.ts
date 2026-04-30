import type { FeedItemDto } from "@/services/api/dtos/feed.dto";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { FeedPostEntry, FeedCursor } from "@/services/api/endpoints/feed.endpoint";
import { listPublishedPostPlanIdsEndpoint } from "@/services/api/endpoints/feed.endpoint";
import { listUserPlanLikesEndpoint, listPlanLikeCountsEndpoint } from "@/services/api/endpoints/likes.endpoint";

export type { FeedCursor };

export type FeedResult = {
  posts: FeedItemDto[];
  cursor: FeedCursor; // null = no hay más páginas
};

function entryToFeedItem(entry: FeedPostEntry): FeedItemDto {
  const creator = entry.creator;
  const userName = creator?.name || "Usuario";

  const plan: FeedPlanItemDto = {
    id: entry.planId,
    createdAt: "",
    title: entry.title,
    description: entry.description,
    locationName: entry.locationName,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    allDay: entry.allDay,
    visibility: entry.visibility as FeedPlanItemDto["visibility"],
    coverImage: entry.coverImage,
    ownerUserId: entry.ownerUserId,
    creator: creator
      ? { id: creator.id, name: creator.name, username: null, profileImage: creator.profileImage }
      : { id: "", name: "Usuario", username: null, profileImage: null },
  };

  return {
    id: String(entry.planId),
    userName,
    userUsername: null,
    avatarLabel: (userName.trim()[0] || "U").toUpperCase(),
    avatarImage: creator?.profileImage ?? null,
    subtitle: entry.title,
    text: entry.caption ?? "",
    caption: entry.caption,
    hasImage: Boolean(entry.coverImage),
    coverImage: entry.coverImage,
    plan,
    initiallyLiked: false,
    initialLikeCount: 0,
    photosSnapshot: entry.photosSnapshot ?? null,
    itinerarySnapshot: entry.itinerarySnapshot ?? null,
    expensesSnapshot: entry.expensesSnapshot ?? null,
  };
}

// Carga una página de posts sin likes (rápido)
export async function getFeedPostsOnly(params: {
  limit?: number;
  cursor?: FeedCursor;
}): Promise<FeedResult> {
  const { entries, cursor } = await listPublishedPostPlanIdsEndpoint({
    limit: params.limit ?? 20,
    cursor: params.cursor,
  });
  return { posts: entries.map(entryToFeedItem), cursor };
}

// Likes — se llama en background después de mostrar posts
export async function getFeedLikes(params: {
  userId: string;
  planIds: number[];
}): Promise<{ likedSet: Set<number>; counts: Record<number, number> }> {
  const [likedPlansResult, likeCountsResult] = await Promise.all([
    listUserPlanLikesEndpoint({ userId: params.userId, planIds: params.planIds }),
    listPlanLikeCountsEndpoint({ planIds: params.planIds }),
  ]);
  return {
    likedSet: new Set<number>(likedPlansResult.likedPlanIds),
    counts: likeCountsResult.likeCountsByPlanId,
  };
}

// Compatibilidad con código existente
export async function getFeedPage(params: { userId: string; limit?: number }): Promise<FeedItemDto[]> {
  const { posts } = await getFeedPostsOnly({ limit: params.limit });
  const planIds = posts.map((p) => p.plan.id);
  if (planIds.length === 0) return posts;
  const { likedSet, counts } = await getFeedLikes({ userId: params.userId, planIds });
  return posts.map((p) => ({
    ...p,
    initiallyLiked: likedSet.has(p.plan.id),
    initialLikeCount: counts[p.plan.id] ?? 0,
  }));
}
