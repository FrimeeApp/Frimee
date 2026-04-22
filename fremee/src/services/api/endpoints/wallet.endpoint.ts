import { createBrowserSupabaseClient } from "@/services/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TicketType = "flight" | "ferry" | "train" | "concert" | "match" | "hotel" | "other";
export type TicketStatus = "upcoming" | "used" | "cancelled";

export type PlanTicket = {
  id: string;
  user_id: string;
  plan_id: number | null;
  plan_titulo: string | null;
  type: TicketType;
  title: string;
  subtitle: string | null;
  from_label: string | null;
  to_label: string | null;
  place_label: string | null;
  starts_at: string;
  ends_at: string | null;
  booking_code: string | null;
  seat_label: string | null;
  gate_label: string | null;
  terminal_label: string | null;
  passenger_name: string | null;
  notes: string | null;
  qr_image_url: string | null;
  barcode_value: string | null;
  source_image_url: string | null;
  source_pdf_url: string | null;
  cover_color: string | null;
  status: TicketStatus;
  shared_by_user_id: string | null;   // null = propio, uuid = compartido por otro
  shared_by_nombre: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTicketInput = Omit<PlanTicket,
  "id" | "user_id" | "plan_titulo" | "shared_by_user_id" | "shared_by_nombre" | "created_at" | "updated_at"
>;

export type UpdateTicketInput = Partial<CreateTicketInput>;

// ── Helpers ───────────────────────────────────────────────────────────────────

export const TICKET_COLOR_VARIANTS: Record<TicketType, string[]> = {
  flight: [
    "linear-gradient(135deg,#2f1f76 0%,#8b5cf6 26%,#f59e0b 68%,#f4d03f 100%)",  // violeta → ámbar
    "linear-gradient(135deg,#1a1060 0%,#4f46e5 30%,#ec4899 70%,#f97316 100%)",  // índigo → rosa → naranja
    "linear-gradient(135deg,#0f2544 0%,#1d4ed8 35%,#06b6d4 65%,#a3e635 100%)",  // azul oscuro → cian → lima
    "linear-gradient(135deg,#3b0764 0%,#7c3aed 30%,#db2777 65%,#fbbf24 100%)",  // púrpura → magenta → oro
  ],
  ferry: [
    "linear-gradient(135deg,#1b7b4b 0%,#5abf73 100%)",   // verde esmeralda
    "linear-gradient(135deg,#0f4c75 0%,#1b85a0 50%,#3ec6c0 100%)", // azul océano
    "linear-gradient(135deg,#155e4a 0%,#0d9488 50%,#34d399 100%)", // verde mar
    "linear-gradient(135deg,#1e3a5f 0%,#2563eb 50%,#38bdf8 100%)", // azul marino
  ],
  train: [
    "linear-gradient(135deg,#bf5b3d 0%,#f48f63 100%)",   // terracota
    "linear-gradient(135deg,#7c2d12 0%,#c2410c 50%,#fb923c 100%)", // óxido profundo
    "linear-gradient(135deg,#92400e 0%,#b45309 50%,#fbbf24 100%)", // ámbar tostado
    "linear-gradient(135deg,#6b1e3d 0%,#be185d 50%,#f472b6 100%)", // burdeos → rosa
  ],
  concert: [
    "linear-gradient(135deg,#9a2d62 0%,#ff7a59 100%)",   // magenta → coral
    "linear-gradient(135deg,#1a0533 0%,#7c3aed 40%,#f43f5e 100%)", // noche → violeta → rojo
    "linear-gradient(135deg,#0d0d1a 0%,#1d4ed8 40%,#a21caf 100%)", // azul eléctrico → fucsia
    "linear-gradient(135deg,#14052e 0%,#6d28d9 35%,#ec4899 65%,#fbbf24 100%)", // púrpura → rosa → dorado
  ],
  match: [
    "linear-gradient(135deg,#0f274b 0%,#2157a6 100%)",   // azul navy
    "linear-gradient(135deg,#0c1a0e 0%,#166534 50%,#16a34a 100%)", // verde campo
    "linear-gradient(135deg,#1c0a00 0%,#7c2d12 50%,#dc2626 100%)", // rojo pasión
    "linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#334155 100%)", // pizarra oscura
  ],
  hotel: [
    "linear-gradient(135deg,#1a3a4a 0%,#2d7a8a 100%)",   // teal oscuro
    "linear-gradient(135deg,#1c1917 0%,#78350f 50%,#d97706 100%)", // cuero → dorado
    "linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#475569 100%)", // grafito elegante
    "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)", // azul medianoche
  ],
  other: [
    "linear-gradient(135deg,#3a3a4a 0%,#6b6b8a 100%)",
    "linear-gradient(135deg,#1f2937 0%,#4b5563 100%)",
    "linear-gradient(135deg,#111827 0%,#374151 50%,#6b7280 100%)",
    "linear-gradient(135deg,#2d1b69 0%,#4c1d95 50%,#6b7280 100%)",
  ],
};

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = (Math.imul(31, h) + id.charCodeAt(i)) | 0; }
  return Math.abs(h);
}

export function getTicketColor(type: TicketType, id: string): string {
  const variants = TICKET_COLOR_VARIANTS[type];
  return variants[hashId(id) % variants.length];
}

export const TICKET_COLORS: Record<TicketType, string> = {
  flight:  TICKET_COLOR_VARIANTS.flight[0],
  ferry:   TICKET_COLOR_VARIANTS.ferry[0],
  train:   TICKET_COLOR_VARIANTS.train[0],
  concert: TICKET_COLOR_VARIANTS.concert[0],
  match:   TICKET_COLOR_VARIANTS.match[0],
  hotel:   TICKET_COLOR_VARIANTS.hotel[0],
  other:   TICKET_COLOR_VARIANTS.other[0],
};

export const TICKET_TEXT: Record<TicketType, string> = {
  flight:  "text-white",
  ferry:   "text-[#f7f3df]",
  train:   "text-[#fff4e9]",
  concert: "text-[#fff3f0]",
  match:   "text-[#eef6ff]",
  hotel:   "text-[#e8f4f8]",
  other:   "text-[#f0f0f8]",
};

export const TICKET_MUTED: Record<TicketType, string> = {
  flight:  "text-white/72",
  ferry:   "text-[#f7f3df]/78",
  train:   "text-[#fff4e9]/78",
  concert: "text-[#fff3f0]/76",
  match:   "text-[#eef6ff]/76",
  hotel:   "text-[#e8f4f8]/76",
  other:   "text-[#f0f0f8]/72",
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  flight:  "Vuelo",
  ferry:   "Ferry",
  train:   "Tren",
  concert: "Concierto",
  match:   "Partido",
  hotel:   "Hotel",
  other:   "Otro",
};

// ── Endpoints ─────────────────────────────────────────────────────────────────

export async function listTicketsEndpoint(): Promise<PlanTicket[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_tickets_list");
  if (error) throw error;
  return (data ?? []) as PlanTicket[];
}

export async function listActiveFriendFlightsEndpoint(): Promise<PlanTicket[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_active_friend_flights");
  if (error) throw error;
  return (data ?? []) as PlanTicket[];
}

export async function listTicketsForPlanEndpoint(planId: number): Promise<PlanTicket[]> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_tickets_list_for_plan", { p_plan_id: planId });
  if (error) throw error;
  return (data ?? []) as PlanTicket[];
}

export async function createTicketEndpoint(input: CreateTicketInput): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fn_ticket_create", {
    p_plan_id:        input.plan_id ?? null,
    p_type:           input.type,
    p_title:          input.title,
    p_subtitle:       input.subtitle ?? null,
    p_from_label:     input.from_label ?? null,
    p_to_label:       input.to_label ?? null,
    p_place_label:    input.place_label ?? null,
    p_starts_at:      input.starts_at,
    p_ends_at:        input.ends_at ?? null,
    p_booking_code:   input.booking_code ?? null,
    p_seat_label:     input.seat_label ?? null,
    p_gate_label:     input.gate_label ?? null,
    p_terminal_label: input.terminal_label ?? null,
    p_passenger_name: input.passenger_name ?? null,
    p_notes:          input.notes ?? null,
    p_qr_image_url:   input.qr_image_url ?? null,
    p_barcode_value:  input.barcode_value ?? null,
    p_source_image_url: input.source_image_url ?? null,
    p_source_pdf_url: input.source_pdf_url ?? null,
    p_cover_color:    input.cover_color ?? null,
    p_status:         input.status,
  });
  if (error) throw error;
  return data as string;
}

export async function updateTicketEndpoint(ticketId: string, input: UpdateTicketInput): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase
    .from("plan_tickets")
    .update({
      plan_id:        input.plan_id,
      type:           input.type,
      title:          input.title,
      subtitle:       input.subtitle,
      from_label:     input.from_label,
      to_label:       input.to_label,
      place_label:    input.place_label,
      starts_at:      input.starts_at,
      ends_at:        input.ends_at,
      booking_code:   input.booking_code,
      seat_label:     input.seat_label,
      gate_label:     input.gate_label,
      terminal_label: input.terminal_label,
      passenger_name: input.passenger_name,
      notes:          input.notes,
      cover_color:    input.cover_color,
      status:         input.status,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", ticketId);
  if (error) throw error;
}

export async function markTicketUsedEndpoint(ticketId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase
    .from("plan_tickets")
    .update({ status: "used", updated_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (error) throw error;
}

export async function deleteTicketEndpoint(ticketId: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.from("plan_tickets").delete().eq("id", ticketId);
  if (error) throw error;
}

export async function shareTicketEndpoint(ticketId: string, userIds: string[]): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const rows = userIds.map(uid => ({ ticket_id: ticketId, user_id: uid }));
  const { error } = await supabase.from("plan_ticket_shares").upsert(rows, { onConflict: "ticket_id,user_id" });
  if (error) throw error;
}

export async function uploadTicketSourceEndpoint(file: File, userId: string): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `tickets/${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("plan-tickets").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function getTicketSourceSignedUrl(path: string): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.storage.from("plan-tickets").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}
