import type { FeedItemDto } from "@/services/api/dtos/feed.dto";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { FeedPostEntry } from "@/services/api/endpoints/feed.endpoint";
import { listPublishedPostPlanIdsEndpoint } from "@/services/api/endpoints/feed.endpoint";
import { listUserPlanLikesEndpoint, listPlanLikeCountsEndpoint } from "@/services/api/endpoints/likes.endpoint";

export async function listPublishedPostEntries(params: { limit?: number } = {}): Promise<FeedPostEntry[]> {
  return listPublishedPostPlanIdsEndpoint({ limit: params.limit ?? 20 });
}

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
      ? { id: creator.id, name: creator.name, profileImage: creator.profileImage }
      : { id: "", name: "Usuario", profileImage: null },
  };

  return {
    id: String(entry.planId),
    userName,
    avatarLabel: (userName.trim()[0] || "U").toUpperCase(),
    avatarImage: creator?.profileImage ?? null,
    subtitle: entry.title,
    text: entry.caption ?? entry.description,
    caption: entry.caption,
    hasImage: Boolean(entry.coverImage),
    coverImage: entry.coverImage,
    plan,
    initiallyLiked: false,
    initialLikeCount: 0,
  };
}

// Devuelve posts sin likes — rápido (1 query a Firebase)
export async function getFeedPostsOnly(params: { limit?: number }): Promise<FeedItemDto[]> {
  const entries = await listPublishedPostEntries({ limit: params.limit ?? 20 });
  return entries.map(entryToFeedItem);
}

// Devuelve likes — se llama en background después de mostrar los posts
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

// Mantener compatibilidad con código existente
export async function getFeedPage(params: { userId: string; limit?: number }): Promise<FeedItemDto[]> {
  const posts = await getFeedPostsOnly({ limit: params.limit });
  const planIds = posts.map((p) => p.plan.id);
  if (planIds.length === 0) return posts;
  const { likedSet, counts } = await getFeedLikes({ userId: params.userId, planIds });
  return posts.map((p) => ({
    ...p,
    initiallyLiked: likedSet.has(p.plan.id),
    initialLikeCount: counts[p.plan.id] ?? 0,
  }));
}
