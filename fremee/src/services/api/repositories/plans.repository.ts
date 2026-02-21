import type { ExplorePlansParams, FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { fetchExplorePlansRpc } from "@/services/api/endpoints/plans.endpoint";
import { mapExploreRowToDto } from "@/services/api/mappers/plan.mapper";

export async function listExplorePlans(params: ExplorePlansParams = {}): Promise<FeedPlanItemDto[]> {
  const rows = await fetchExplorePlansRpc({
    limit: params.limit ?? 20,
    cursorCreatedAt: params.cursorCreatedAt ?? null,
    cursorPlanId: params.cursorPlanId ?? null,
  });

  return rows.map(mapExploreRowToDto);
}