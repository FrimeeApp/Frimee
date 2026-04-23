import {
  fetchPlanFotos,
  insertPlanFoto,
  deletePlanFoto,
  type PlanFotoRow,
} from "@/services/api/endpoints/plan-fotos.endpoint";

export type PlanFotoDto = {
  id: number;
  planId: number;
  userId: string;
  url: string;
  storagePath: string;
  createdAt: string;
};

function rowToDto(row: PlanFotoRow): PlanFotoDto {
  return {
    id: row.id,
    planId: row.plan_id,
    userId: row.user_id,
    url: row.url,
    storagePath: row.storage_path,
    createdAt: row.created_at,
  };
}

export async function getPlanFotos(params: { planId: number }): Promise<PlanFotoDto[]> {
  const rows = await fetchPlanFotos(params);
  return rows.map(rowToDto);
}

export async function addPlanFoto(params: {
  planId: number;
  userId: string;
  url: string;
  storagePath: string;
}): Promise<PlanFotoDto> {
  const row = await insertPlanFoto(params);
  return rowToDto(row);
}

export async function removePlanFoto(params: { id: number; userId: string }): Promise<void> {
  return deletePlanFoto(params);
}
