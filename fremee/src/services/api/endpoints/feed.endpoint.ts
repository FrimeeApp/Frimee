import type { FeedPostEntry } from "@/services/api/posts/feed/route";
import { listPublishedPostPlanIdsRoute } from "@/services/api/posts/feed/route";

export type { FeedPostEntry };
export type FeedCursor = null;

export type FeedPage = {
  entries: FeedPostEntry[];
  cursor: FeedCursor;
};

export async function listPublishedPostPlanIdsEndpoint(params: {
  limit: number;
  cursor?: FeedCursor;
}): Promise<FeedPage> {
  const entries = await listPublishedPostPlanIdsRoute({ limit: params.limit });
  return { entries, cursor: null };
}
