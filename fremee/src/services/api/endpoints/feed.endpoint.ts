import type { FeedPostEntry } from "@/services/api/posts/feed/route";
import { listPublishedPostPlanIdsRoute } from "@/services/api/posts/feed/route";

export type { FeedPostEntry };

export async function listPublishedPostPlanIdsEndpoint(params: { limit: number }): Promise<FeedPostEntry[]> {
  return listPublishedPostPlanIdsRoute(params);
}
