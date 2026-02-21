import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import type { FeedExploreRow } from "@/services/api/endpoints/plans.endpoint";

export function mapExploreRowToDto(r: FeedExploreRow): FeedPlanItemDto {
  return {
    id: r.plan_id,
    createdAt: r.created_at,
    title: r.titulo,
    description: r.descripcion,
    locationName: r.ubicacion_nombre,
    startsAt: r.inicio_at,
    endsAt: r.fin_at,
    visibility: r.visibilidad as FeedPlanItemDto["visibility"],
    coverImage: r.foto_portada ?? null,
    creator: {
      id: r.creador_id,
      name: r.creador_nombre,
      profileImage: r.creador_profile_image,
    },
  };
}