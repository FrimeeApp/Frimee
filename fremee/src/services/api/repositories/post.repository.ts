import type { PublishablePlan } from "@/services/api/mappers/post.mapper";
import { mapPlanToPublishPayload } from "@/services/api/mappers/post.mapper";
import { publishPostEndpoint } from "@/services/api/endpoints/post.endpoint";

export async function publishPlanAsPost(plan: PublishablePlan) {
  return publishPostEndpoint(mapPlanToPublishPayload(plan));
}
