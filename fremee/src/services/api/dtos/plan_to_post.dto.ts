export type PlanToPostDTO = {
  id: number;
  titulo: string | null;
  descripcion: string | null;

  owner_user_id: string | null;
  owner_group_id: string | null;
  creado_por_user_id: string | null;

  estado: string | null;
  inicio_at: string | null;
  fin_at: string | null;
  all_day: boolean | null;

  visibilidad: string | null;
  ubicacion_nombre: string | null;
  ubicacion_direccion: string | null;

  foto_portada: string | null;
};