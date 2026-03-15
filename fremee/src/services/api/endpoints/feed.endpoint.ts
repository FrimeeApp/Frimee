import { listPublishedPostPlanIdsRoute } from "@/services/api/posts/feed/route";

export async function listPublishedPostPlanIdsEndpoint(params: { limit: number }) {
  return listPublishedPostPlanIdsRoute(params);
}
