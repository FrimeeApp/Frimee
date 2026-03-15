import type { PublishPostPayload } from "@/services/api/mappers/post.mapper";
import { publishPostRoute } from "@/services/api/posts/publish/route";

export async function publishPostEndpoint(payload: PublishPostPayload) {
  return publishPostRoute(payload);
}
