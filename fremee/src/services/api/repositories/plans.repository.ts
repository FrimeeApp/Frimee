import type { ExplorePlansParams, FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import {
  createPlanEndpoint,
  type CreatePlanParams,
  fetchExplorePlansRpc,
  fetchPlansByIds,
  fetchUserRelatedPlans,
} from "@/services/api/endpoints/plans.endpoint";
import { getSavedPlanIds } from "@/services/api/endpoints/saved.endpoint";
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
  const plans = await fetchPlansByIds({ planIds });
  const planMap = new Map<number, FeedPlanItemDto>();

  for (const p of plans) {
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
        name: p.creador_nombre ?? "Usuario",
        profileImage: p.creador_profile_image ?? null,
      },
    });
  }

  return planIds.map((id) => planMap.get(id)).filter((p): p is FeedPlanItemDto => Boolean(p));
}

export async function listSavedPlans(userId: string): Promise<FeedPlanItemDto[]> {
  const ids = await getSavedPlanIds(userId);
  if (ids.length === 0) return [];
  return listPlansByIdsInOrder(ids);
}

export async function listUserRelatedPlans(params: { userId: string; limit?: number }): Promise<FeedPlanItemDto[]> {
  const plans = await fetchUserRelatedPlans({
    userId: params.userId,
    limit: params.limit ?? 300,
  });

  return plans.map((p) => ({
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
      name: p.creador_nombre ?? "Usuario",
      profileImage: p.creador_profile_image ?? null,
    },
  }));
}
