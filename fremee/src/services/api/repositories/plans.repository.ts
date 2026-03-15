import type { ExplorePlansParams, FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import {
  createPlanEndpoint,
  type CreatePlanParams,
  fetchExplorePlansRpc,
  fetchPlansByIds,
  fetchUserRelatedPlans,
} from "@/services/api/endpoints/plans.endpoint";
import { mapExploreRowToDto } from "@/services/api/mappers/plan.mapper";

export async function listExplorePlans(params: ExplorePlansParams = {}): Promise<FeedPlanItemDto[]> {
  const rows = await fetchExplorePlansRpc({
    limit: params.limit ?? 20,
    cursorCreatedAt: params.cursorCreatedAt ?? null,
    cursorPlanId: params.cursorPlanId ?? null,
  });

  return rows.map(mapExploreRowToDto);
}

export async function createPlan(params: CreatePlanParams) {
  return createPlanEndpoint(params);
}

export async function listPlansByIdsInOrder(planIds: number[]): Promise<FeedPlanItemDto[]> {
  const { plans, creators } = await fetchPlansByIds({ planIds });
  const planMap = new Map<number, FeedPlanItemDto>();

  for (const p of plans) {
    const creator = creators[p.creado_por_user_id];
    planMap.set(p.id, {
      id: p.id,
      createdAt: p.created_at,
      title: p.titulo,
      description: p.descripcion,
      locationName: p.ubicacion_nombre,
      startsAt: p.inicio_at,
      endsAt: p.fin_at,
      allDay: Boolean(p.all_day),
      visibility: p.visibilidad as FeedPlanItemDto["visibility"],
      coverImage: p.foto_portada ?? null,
      ownerUserId: p.owner_user_id,
      creator: {
        id: p.creado_por_user_id,
        name: creator?.nombre ?? "Usuario",
        profileImage: creator?.profile_image ?? null,
      },
    });
  }

  return planIds.map((id) => planMap.get(id)).filter((p): p is FeedPlanItemDto => Boolean(p));
}

export async function listUserRelatedPlans(params: { userId: string; limit?: number }): Promise<FeedPlanItemDto[]> {
  const { plans, creators } = await fetchUserRelatedPlans({
    userId: params.userId,
    limit: params.limit ?? 300,
  });

  return plans.map((p) => {
    const creator = creators[p.creado_por_user_id];
    return {
      id: p.id,
      createdAt: p.created_at,
      title: p.titulo,
      description: p.descripcion,
      locationName: p.ubicacion_nombre,
      startsAt: p.inicio_at,
      endsAt: p.fin_at,
      allDay: Boolean(p.all_day),
      visibility: p.visibilidad as FeedPlanItemDto["visibility"],
      coverImage: p.foto_portada ?? null,
      ownerUserId: p.owner_user_id,
      creator: {
        id: p.creado_por_user_id,
        name: creator?.nombre ?? "Usuario",
        profileImage: creator?.profile_image ?? null,
      },
    };
  });
}
