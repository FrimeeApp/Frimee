/**
 * Datos del formulario de billete: tipos, paso de PlanTicket a borrador y de borrador a lo que guarda la API,
 * horas de Madrid y subida del archivo con lectura automática.
 */
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { buildInternalApiUrl } from "@/config/external";
import { airportTz } from "@/lib/airports";
import type { TicketOcrResult } from "@/app/api/tickets/ocr/route";
import { readTicketBarcode, type TicketCode } from "@/lib/ticket-barcode";
import type { CreateTicketInput, PlanTicket, TicketType } from "@/services/api/endpoints/wallet.endpoint";

export type TicketFile = {
  /** Ruta en Storage (plan-tickets). */
  path: string;
  /** Vista previa: URL local o firmada. Vacía en los PDF. */
  url: string;
  name: string;
  /** 0 = desconocido (archivo que ya estaba guardado). */
  size: number;
  /** Hay QR o código de barras en el archivo. */
  qr: boolean;
  isPdf: boolean;
  /** Archivo subido en esta sesión (no el que ya estaba guardado): su código, o su falta, sustituye al anterior. */
  fresh?: boolean;
  /** Contenido del código leído de la imagen en el dispositivo. Solo en los archivos recién subidos. */
  code?: TicketCode;
};

export type TicketDraft = {
  file?: TicketFile;
  title: string;
  type?: TicketType;
  planId: number | null;
  date: string; // AAAA-MM-DD (hora de Madrid)
  time: string; // HH:MM
  endDate?: string;
  endTime?: string;
  from?: string; to?: string; place?: string; code?: string;
  seat?: string; gate?: string; terminal?: string; holder?: string; notes?: string;
};

export type DraftKey = keyof Omit<TicketDraft, "file">;

export type PlanOption = { id: number; title: string; dates: string; upcoming: boolean };

export type UploadResult = { file: TicketFile; extracted?: Partial<Omit<TicketDraft, "file" | "planId">> };

export const EMPTY_DRAFT: TicketDraft = { title: "", planId: null, date: "", time: "" };

/* ---------------- horas con zona ---------------- */

const MADRID = "Europe/Madrid";
const wallFormats = new Map<string, Intl.DateTimeFormat>();

function wallParts(ms: number, tz: string) {
  let fmt = wallFormats.get(tz);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    wallFormats.set(tz, fmt);
  }
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, asUtc: Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) };
}

/** Instante ISO → fecha y hora de pared en una zona. */
export function isoToZone(iso: string, tz: string) {
  const { date, time } = wallParts(new Date(iso).getTime(), tz);
  return { date, time };
}

/** Fecha y hora de pared en una zona («2026-12-03» + «09:30» en Madrid) → instante ISO. */
export function zoneToIso(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let t = wall - (wallParts(wall, tz).asUtc - wall);
  t = wall - (wallParts(t, tz).asUtc - t);
  return new Date(t).toISOString();
}

/**
 * Zonas en las que se escriben las horas del billete: en un vuelo, la salida va en la hora del aeropuerto
 * de origen y la llegada en la del destino (como en la tarjeta de embarque). En lo demás, hora de Madrid.
 */
export function ticketZones(type: string | undefined, from?: string, to?: string) {
  if (type === "flight") return { dep: from?.trim() ? airportTz(from.trim()) : MADRID, arr: to?.trim() ? airportTz(to.trim()) : MADRID };
  return { dep: MADRID, arr: MADRID };
}

/** «2026-12-03T09:30:00» (hora de pared, sin zona) → fecha y hora tal cual; si trae zona, se pasa a la indicada. */
function wallFromString(s: string, tz: string) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?!.*(Z|[+-]\d{2}:?\d{2})$)/.exec(s);
  return m ? { date: m[1], time: m[2] } : isoToZone(s, tz);
}

/* ---------------- billete ⇄ borrador ---------------- */

export function draftFromTicket(p: PlanTicket, signedUrl?: string): TicketDraft {
  const zones = ticketZones(p.type, p.from_label ?? undefined, p.to_label ?? undefined);
  const s = isoToZone(p.starts_at, zones.dep);
  const e = p.ends_at ? isoToZone(p.ends_at, zones.arr) : null;
  const path = p.source_image_url ?? p.source_pdf_url ?? null;
  const isPdf = !p.source_image_url && !!p.source_pdf_url;
  return {
    title: p.title,
    type: p.type,
    planId: p.plan_id,
    date: s.date,
    time: s.time,
    endDate: e?.date,
    endTime: e?.time,
    from: p.from_label ?? undefined,
    to: p.to_label ?? undefined,
    place: p.place_label ?? undefined,
    code: p.booking_code ?? undefined,
    seat: p.seat_label ?? undefined,
    gate: p.gate_label ?? undefined,
    terminal: p.terminal_label ?? undefined,
    holder: p.passenger_name ?? undefined,
    notes: p.notes ?? undefined,
    file: path
      ? { path, url: isPdf ? "" : (signedUrl ?? ""), name: isPdf ? "PDF del billete" : "Imagen del billete", size: 0, qr: !!(p.barcode_value || p.qr_image_url), isPdf }
      : undefined,
  };
}

const orNull = (v?: string) => v?.trim() || null;

/** Lo que guarda la API. En edición no incluye `status`. */
export function inputFromDraft(d: TicketDraft): Omit<CreateTicketInput, "status" | "barcode_value"> & { barcode_value: string | null } {
  const time = d.time || "12:00";
  const zones = ticketZones(d.type, d.from, d.to);
  const startsAt = zoneToIso(d.date, time, zones.dep);
  let endsAt: string | null = null;
  if (d.endTime) {
    // La llegada se escribe en la hora del destino; si queda antes de la salida, es de un día posterior.
    const first = d.endDate && d.endDate >= d.date ? d.endDate : d.date;
    const day = new Date(`${first}T12:00:00Z`);
    endsAt = zoneToIso(first, d.endTime, zones.arr);
    for (let i = 0; i < 3 && endsAt <= startsAt; i++) {
      day.setUTCDate(day.getUTCDate() + 1);
      endsAt = zoneToIso(day.toISOString().slice(0, 10), d.endTime, zones.arr);
    }
  }
  return {
    plan_id: d.planId,
    type: d.type ?? "other",
    title: d.title.trim(),
    subtitle: null,
    from_label: orNull(d.from),
    to_label: orNull(d.to),
    place_label: orNull(d.place),
    starts_at: startsAt,
    ends_at: endsAt,
    booking_code: orNull(d.code),
    seat_label: orNull(d.seat),
    gate_label: orNull(d.gate),
    terminal_label: orNull(d.terminal),
    passenger_name: orNull(d.holder),
    notes: orNull(d.notes),
    qr_image_url: null,
    barcode_value: d.file?.qr ? "detected" : null,
    source_image_url: d.file && !d.file.isPdf ? d.file.path : null,
    source_pdf_url: d.file?.isPdf ? d.file.path : null,
    cover_color: null,
  };
}

/* ---------------- subida y lectura ---------------- */

const TICKET_TYPES: TicketType[] = ["flight", "ferry", "train", "concert", "match", "hotel", "other"];

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo convertir la imagen"))), "image/jpeg", 0.92),
  );
}

/**
 * Sube el archivo a Storage y lo lee con la IA (/api/tickets/ocr, que hace las dos cosas).
 * El servidor no da progreso real: la barra sube sola hasta el 90 % y salta al 100 % al terminar.
 */
export async function uploadTicketFile(file: File, onProgress: (pct: number) => void, signal: AbortSignal): Promise<UploadResult> {
  const supabase = createBrowserSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  const { data: { session } } = await supabase.auth.getSession();

  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const body = new FormData();
  body.append("file", isPdf ? file : await toJpeg(file), isPdf ? file.name : "ticket.jpg");
  body.append("user_id", user.id);

  // El código se lee en el dispositivo, a la vez que el servidor lee el resto de datos; los PDF no se leen.
  const codePromise: Promise<TicketCode | null> = isPdf ? Promise.resolve(null) : readTicketBarcode(file);

  let pct = 0;
  const timer = setInterval(() => { pct += (90 - pct) * 0.12; onProgress(pct); }, 250);
  try {
    const res = await fetch(buildInternalApiUrl("/api/tickets/ocr"), {
      method: "POST",
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      body,
      signal,
    });
    const data = (await res.json()) as TicketOcrResult & { error?: string };
    if (data.error || !data.source_path) throw new Error(data.error ?? "Respuesta vacía");
    onProgress(100);

    // La tarjeta trae las horas de pared de cada aeropuerto: se guardan tal cual, en la zona de cada uno.
    const zones = ticketZones(data.type ?? undefined, data.from_label ?? undefined, data.to_label ?? undefined);
    const startsAt = data.starts_at ? wallFromString(data.starts_at, zones.dep) : null;
    const endsAt = data.ends_at ? wallFromString(data.ends_at, zones.arr) : null;
    const extracted: UploadResult["extracted"] = {
      title: data.title ?? undefined,
      type: data.type && TICKET_TYPES.includes(data.type as TicketType) ? (data.type as TicketType) : undefined,
      date: startsAt?.date,
      time: startsAt?.time,
      endDate: endsAt?.date,
      endTime: endsAt?.time,
      from: data.from_label ?? undefined,
      to: data.to_label ?? undefined,
      place: data.place_label ?? undefined,
      code: data.booking_code ?? undefined,
      seat: data.seat_label ?? undefined,
      gate: data.gate_label ?? undefined,
      terminal: data.terminal_label ?? undefined,
      holder: data.passenger_name ?? undefined,
    };
    const code = await codePromise;
    return {
      file: { path: data.source_path, url: isPdf ? "" : URL.createObjectURL(file), name: file.name, size: file.size, qr: data.has_qr || !!code, isPdf, fresh: true, code: code ?? undefined },
      extracted,
    };
  } finally {
    clearInterval(timer);
  }
}
