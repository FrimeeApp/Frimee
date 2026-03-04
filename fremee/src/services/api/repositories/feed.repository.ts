import { listPublishedPostPlanIdsEndpoint } from "@/services/api/endpoints/feed.endpoint";

export async function listPublishedPostPlanIds(params: { limit?: number } = {}) {
  return listPublishedPostPlanIdsEndpoint({ limit: params.limit ?? 20 });
}
