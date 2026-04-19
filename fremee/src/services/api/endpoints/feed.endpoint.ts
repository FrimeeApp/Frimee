import type { FeedPostEntry, FeedPage } from "@/services/api/posts/feed/route";
import { listPublishedPostPlanIdsRoute } from "@/services/api/posts/feed/route";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export type { FeedPostEntry, FeedPage };
export type FeedCursor = QueryDocumentSnapshot<DocumentData> | null;

export async function listPublishedPostPlanIdsEndpoint(params: {
  limit: number;
  cursor?: FeedCursor;
}): Promise<FeedPage> {
  return listPublishedPostPlanIdsRoute(params);
}
