import type {
  CalendarEventDto,
  CreateCalendarEventParams,
  ListCalendarEventsParams,
} from "@/services/api/dtos/event.dto";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import {
  fetchUserCalendarEventsByRange,
  insertLocalCalendarEvent,
} from "@/services/api/endpoints/events.endpoint";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import {
  createGoogleEvent,
  deleteGoogleEvent,
  listGoogleCalendars,
  listGoogleEventsByCalendar,
  type GoogleCalendarEvent,
  updateGoogleEvent,
} from "@/services/google/calendar";

export async function listUserCalendarEventsByRange(params: ListCalendarEventsParams): Promise<CalendarEventDto[]> {
  const rows = await fetchUserCalendarEventsByRange({
    userId: params.userId,
    rangeStartAt: params.rangeStartAt,
    rangeEndAt: params.rangeEndAt,
    limit: params.limit ?? 500,
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ownerUserId: row.owner_user_id,
    createdByUserId: row.creado_por_user_id,
    title: row.titulo,
    description: row.descripcion,
    category: row.categoria as CalendarEventDto["category"],
    startsAt: row.inicio_at,
    endsAt: row.fin_at,
    allDay: row.all_day,
    color: row.color,
    locationName: row.ubicacion_nombre,
    locationAddress: row.ubicacion_direccion,
    source: row.source as CalendarEventDto["source"],
    googleCalendarId: row.google_calendar_id,
    googleEventId: row.google_event_id,
    syncStatus: row.sync_status as CalendarEventDto["syncStatus"],
  }));
}

export async function createLocalCalendarEvent(params: CreateCalendarEventParams) {
  return insertLocalCalendarEvent({
    userId: params.userId,
    title: params.title.trim(),
    description: params.description?.trim() || null,
    category: params.category ?? "OTRO",
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    allDay: params.allDay,
    color: params.color ?? null,
    locationName: params.locationName?.trim() || null,
    locationAddress: params.locationAddress?.trim() || null,
  });
}

export async function importGoogleCalendarEvents(params: {
  userId: string;
  accessToken: string;
  timeMin: string;
  timeMax: string;
}) {
  const supabase = createBrowserSupabaseClient();
  const calendars = await listGoogleCalendars(params.accessToken);

  const visibleCalendars = calendars.filter((calendar) => calendar.selected !== false);
  const calendarIds = visibleCalendars.map((calendar) => calendar.id).filter(Boolean).slice(0, 12);

  const allEvents = await Promise.all(
    calendarIds.map(async (calendarId) => {
      const events = await listGoogleEventsByCalendar({
        accessToken: params.accessToken,
        calendarId,
        timeMin: params.timeMin,
        timeMax: params.timeMax,
      });
      return events.map((event) => ({ calendarId, event }));
    }),
  );

  const flatEvents = allEvents.flat();
  const activeFlatEvents = flatEvents.filter(({ event }) => event.status !== "cancelled");
  const rows = activeFlatEvents
    .map(({ calendarId, event }) => mapGoogleEventToRow(params.userId, calendarId, event))
    .filter((row): row is GoogleEventUpsertRow => Boolean(row));

  const activeGoogleIdSet = new Set(
    activeFlatEvents
      .map(({ calendarId, event }) => {
        if (!event.id) return null;
        return `${calendarId}::${event.id}`;
      })
      .filter((value): value is string => Boolean(value)),
  );

  const { data: existingGoogleRows, error: existingGoogleRowsError } = await supabase.rpc(
    "fn_eventos_get_google_for_sync",
    {
      p_time_min: params.timeMin,
      p_time_max: params.timeMax,
      p_limit: 3000,
    },
  );

  if (existingGoogleRowsError) throw existingGoogleRowsError;

  const idsToSoftDelete = (existingGoogleRows ?? [])
    .filter((row: { id: number; google_calendar_id: string | null; google_event_id: string | null }) => {
      if (!row.google_calendar_id || !row.google_event_id) return false;
      const key = `${row.google_calendar_id}::${row.google_event_id}`;
      return !activeGoogleIdSet.has(key);
    })
    .map((row: { id: number }) => Number(row.id));

  if (idsToSoftDelete.length > 0) {
    const { error: hardDeleteError } = await supabase.rpc("fn_eventos_delete_batch", {
      p_event_ids: idsToSoftDelete,
    });

    if (hardDeleteError) throw hardDeleteError;
  }

  if (rows.length > 0) {
    const { error } = await supabase.rpc("fn_eventos_upsert_google_batch", {
      p_events: rows,
    });

    if (error) throw error;
  }

  return { imported: rows.length, calendars: calendarIds.length };
}

export async function syncGoogleCalendarBidirectional(params: {
  userId: string;
  accessToken: string;
  timeMin: string;
  timeMax: string;
  plans: FeedPlanItemDto[];
  googleSyncEnabled?: boolean;
  googleSyncExportPlans?: boolean;
}) {
  if (params.googleSyncEnabled === false) {
    await upsertCalendarSyncState({
      userId: params.userId,
      syncEnabledSnapshot: false,
      exportPlansSnapshot: Boolean(params.googleSyncExportPlans ?? true),
      status: "SUCCESS",
      errorMessage: null,
      importedCount: 0,
      exportedCount: 0,
      calendarsCount: 0,
    });
    return {
      exported: 0,
      imported: 0,
      calendars: 0,
      skipped: true,
    };
  }

  await upsertCalendarSyncState({
    userId: params.userId,
    syncEnabledSnapshot: true,
    exportPlansSnapshot: Boolean(params.googleSyncExportPlans ?? true),
    status: "RUNNING",
    errorMessage: null,
  });

  try {
    const calendars = await listGoogleCalendars(params.accessToken);
    const visibleCalendars = calendars.filter((calendar) => calendar.selected !== false);
    const writableCalendar =
      visibleCalendars.find((calendar) => calendar.primary) ?? visibleCalendars[0];

    if (!writableCalendar?.id) {
      throw new Error("No hay un calendario de Google seleccionable para sincronizar.");
    }

    const localEvents = (
      await listUserCalendarEventsByRange({
        userId: params.userId,
        rangeStartAt: params.timeMin,
        rangeEndAt: params.timeMax,
        limit: 2000,
      })
    ).filter((event) => event.source === "LOCAL");
    const localEventIdSet = new Set(localEvents.map((event) => String(event.id)));
    const planIdSet = new Set(params.plans.map((plan) => String(plan.id)));

    const existingWritableEvents = await listGoogleEventsByCalendar({
      accessToken: params.accessToken,
      calendarId: writableCalendar.id,
      timeMin: params.timeMin,
      timeMax: params.timeMax,
    });

    const googleEventByLocalEventId = new Map<string, { id: string; status?: string }>();
    const googleEventByPlanId = new Map<string, { id: string; status?: string }>();
    for (const event of existingWritableEvents) {
      const ownerUserId = event.extendedProperties?.private?.fremee_owner_user_id;
      if (ownerUserId !== params.userId || !event.id) continue;

      const localEventId = event.extendedProperties?.private?.fremee_local_event_id;
      if (localEventId) {
        googleEventByLocalEventId.set(localEventId, { id: event.id, status: event.status });
      }

      const planId = event.extendedProperties?.private?.fremee_plan_id;
      if (planId) {
        googleEventByPlanId.set(planId, { id: event.id, status: event.status });
      }
    }

    for (const [localEventId, remoteEvent] of googleEventByLocalEventId) {
      if (localEventIdSet.has(localEventId)) continue;
      try {
        await deleteGoogleEvent({
          accessToken: params.accessToken,
          calendarId: writableCalendar.id,
          eventId: remoteEvent.id,
        });
      } catch {
        // continua con el resto; se reintentara en la siguiente sincronizacion
      }
    }

    for (const [planId, remoteEvent] of googleEventByPlanId) {
      if (planIdSet.has(planId)) continue;
      try {
        await deleteGoogleEvent({
          accessToken: params.accessToken,
          calendarId: writableCalendar.id,
          eventId: remoteEvent.id,
        });
      } catch {
        // continua con el resto; se reintentara en la siguiente sincronizacion
      }
    }

    let exported = 0;
    for (const localEvent of localEvents) {
      const input = mapLocalEventToGoogleInput(localEvent, params.userId);
      const remoteSnapshot = googleEventByLocalEventId.get(String(localEvent.id));
      if (remoteSnapshot?.status === "cancelled") {
        await softDeleteLocalEvent({
          userId: params.userId,
          eventId: localEvent.id,
          syncError: null,
        });
        continue;
      }

      let googleEventId = localEvent.googleEventId ?? remoteSnapshot?.id ?? null;
      let googleCalendarId = localEvent.googleCalendarId ?? writableCalendar.id;

      try {
        if (googleEventId && googleCalendarId) {
          await updateGoogleEvent({
            accessToken: params.accessToken,
            calendarId: googleCalendarId,
            eventId: googleEventId,
            input,
          });
        } else {
          const created = await createGoogleEvent({
            accessToken: params.accessToken,
            calendarId: writableCalendar.id,
            input,
          });
          googleEventId = created.id;
          googleCalendarId = writableCalendar.id;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isNotFound = errorMessage.includes("404");
        if (isNotFound) {
          await softDeleteLocalEvent({
            userId: params.userId,
            eventId: localEvent.id,
            syncError: null,
          });
          continue;
        } else {
          continue;
        }
      }

      if (googleEventId && googleCalendarId) {
        const { error } = await supabase.rpc("fn_evento_update_sync_info", {
          p_event_id:           localEvent.id,
          p_google_calendar_id: googleCalendarId,
          p_google_event_id:    googleEventId,
        });
        if (error) throw error;
        exported += 1;
      }
    }

    if (params.googleSyncExportPlans ?? true) {
      const googlePlanEventIdByPlanId = new Map<number, string>();
      for (const [planIdRaw, remoteEvent] of googleEventByPlanId) {
        const parsedPlanId = Number(planIdRaw);
        if (Number.isNaN(parsedPlanId)) continue;
        if (remoteEvent.status === "cancelled") continue;
        googlePlanEventIdByPlanId.set(parsedPlanId, remoteEvent.id);
      }

      for (const plan of params.plans) {
        const input = mapPlanToGoogleInput(plan, params.userId);
        const existingEventId = googlePlanEventIdByPlanId.get(plan.id);
        try {
          if (existingEventId) {
            await updateGoogleEvent({
              accessToken: params.accessToken,
              calendarId: writableCalendar.id,
              eventId: existingEventId,
              input,
            });
          } else {
            await createGoogleEvent({
              accessToken: params.accessToken,
              calendarId: writableCalendar.id,
              input,
            });
          }
          exported += 1;
        } catch {
          // ignora planes concretos fallidos y sigue con el resto
        }
      }
    }

    const importedResult = await importGoogleCalendarEvents(params);
    await upsertCalendarSyncState({
      userId: params.userId,
      syncEnabledSnapshot: true,
      exportPlansSnapshot: Boolean(params.googleSyncExportPlans ?? true),
      status: "SUCCESS",
      errorMessage: null,
      importedCount: importedResult.imported,
      exportedCount: exported,
      calendarsCount: importedResult.calendars,
    });
    return {
      exported,
      imported: importedResult.imported,
      calendars: importedResult.calendars,
      skipped: false,
    };
  } catch (error) {
    await upsertCalendarSyncState({
      userId: params.userId,
      syncEnabledSnapshot: true,
      exportPlansSnapshot: Boolean(params.googleSyncExportPlans ?? true),
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : String(error),
      importedCount: 0,
      exportedCount: 0,
      calendarsCount: 0,
    });
    throw error;
  }
}

async function upsertCalendarSyncState(params: {
  userId: string;
  syncEnabledSnapshot: boolean;
  exportPlansSnapshot: boolean;
  status: "RUNNING" | "SUCCESS" | "ERROR";
  errorMessage: string | null;
  importedCount?: number;
  exportedCount?: number;
  calendarsCount?: number;
}) {
  const supabase = createBrowserSupabaseClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase.rpc("fn_calendar_sync_state_upsert", {
    p_sync_enabled_snapshot: params.syncEnabledSnapshot,
    p_export_plans_snapshot: params.exportPlansSnapshot,
    p_last_status:           params.status,
    p_last_error:            params.errorMessage,
    p_last_started_at:       params.status === "RUNNING" ? nowIso : null,
    p_last_finished_at:      params.status === "RUNNING" ? null : nowIso,
    p_last_imported_count:   params.importedCount ?? 0,
    p_last_exported_count:   params.exportedCount ?? 0,
    p_last_calendars_count:  params.calendarsCount ?? 0,
  });

  if (error) {
    console.warn("[calendar-sync] state upsert failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

async function softDeleteLocalEvent(params: { userId: string; eventId: number; syncError: string | null }) {
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_evento_delete", { p_event_id: params.eventId });
  if (error) throw error;
}

type GoogleEventUpsertRow = {
  owner_user_id: string;
  creado_por_user_id: string;
  titulo: string;
  descripcion: string | null;
  categoria: "OTRO";
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  color: string | null;
  ubicacion_nombre: string | null;
  ubicacion_direccion: string | null;
  source: "GOOGLE";
  google_calendar_id: string;
  google_event_id: string;
  sync_status: "SYNCED";
  estado: "ACTIVO" | "CANCELADO";
  deleted_at: null;
  last_synced_at: string;
  sync_error: null;
};

function mapGoogleEventToRow(
  userId: string,
  calendarId: string,
  event: GoogleCalendarEvent,
): GoogleEventUpsertRow | null {
  if (isGoogleEventLinkedToLocalOwner(userId, event)) {
    return null;
  }

  if (!event.id) return null;

  const parsedStart = parseGoogleDate(event.start);
  const parsedEnd = parseGoogleDate(event.end);
  if (!parsedStart || !parsedEnd) return null;

  return {
    owner_user_id: userId,
    creado_por_user_id: userId,
    titulo: event.summary?.trim() || "Evento Google",
    descripcion: event.description ?? null,
    categoria: "OTRO",
    inicio_at: parsedStart.iso,
    fin_at: normalizeGoogleEndIso(parsedStart, parsedEnd),
    all_day: parsedStart.allDay || parsedEnd.allDay,
    color: null,
    ubicacion_nombre: event.location ?? null,
    ubicacion_direccion: event.location ?? null,
    source: "GOOGLE",
    google_calendar_id: calendarId,
    google_event_id: event.id,
    sync_status: "SYNCED",
    estado: event.status === "cancelled" ? "CANCELADO" : "ACTIVO",
    deleted_at: null,
    last_synced_at: new Date().toISOString(),
    sync_error: null,
  };
}

function normalizeGoogleEndIso(
  start: { iso: string; allDay: boolean },
  end: { iso: string; allDay: boolean },
) {
  if (!start.allDay || !end.allDay) return end.iso;
  const endDate = new Date(end.iso);
  endDate.setMilliseconds(endDate.getMilliseconds() - 1);
  return endDate.toISOString();
}

function parseGoogleDate(raw?: { date?: string; dateTime?: string }) {
  if (!raw) return null;

  if (raw.dateTime) {
    return { iso: new Date(raw.dateTime).toISOString(), allDay: false };
  }

  if (raw.date) {
    // Google devuelve fin de all-day en formato exclusivo (dia siguiente).
    return { iso: `${raw.date}T00:00:00.000Z`, allDay: true };
  }

  return null;
}

function isGoogleEventLinkedToLocalOwner(userId: string, event: GoogleCalendarEvent) {
  const owner = event.extendedProperties?.private?.fremee_owner_user_id;
  const localEventId = event.extendedProperties?.private?.fremee_local_event_id;
  const planId = event.extendedProperties?.private?.fremee_plan_id;
  return owner === userId && (Boolean(localEventId) || Boolean(planId));
}

function mapLocalEventToGoogleInput(event: CalendarEventDto, userId: string) {
  if (event.allDay) {
    const startDate = toDateKey(event.startsAt);
    const endExclusiveDate = addDays(toDateKey(event.endsAt), 1);
    return {
      summary: event.title,
      description: event.description ?? undefined,
      location: event.locationName ?? undefined,
      start: { date: startDate },
      end: { date: endExclusiveDate },
      extendedProperties: {
        private: {
          fremee_owner_user_id: userId,
          fremee_local_event_id: String(event.id),
          fremee_source: "LOCAL",
        },
      },
    };
  }

  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.locationName ?? undefined,
    start: { dateTime: event.startsAt },
    end: { dateTime: event.endsAt },
    extendedProperties: {
      private: {
        fremee_owner_user_id: userId,
        fremee_local_event_id: String(event.id),
        fremee_source: "LOCAL",
      },
    },
  };
}

function mapPlanToGoogleInput(plan: FeedPlanItemDto, userId: string) {
  const isAllDay = Boolean(plan.allDay);
  if (isAllDay) {
    const startDate = toDateKey(plan.startsAt);
    const endExclusiveDate = addDays(toDateKey(plan.endsAt), 1);
    return {
      summary: plan.title,
      description: plan.description ?? undefined,
      location: plan.locationName ?? undefined,
      start: { date: startDate },
      end: { date: endExclusiveDate },
      extendedProperties: {
        private: {
          fremee_owner_user_id: userId,
          fremee_plan_id: String(plan.id),
          fremee_source: "PLAN",
        },
      },
    };
  }

  return {
    summary: plan.title,
    description: plan.description ?? undefined,
    location: plan.locationName ?? undefined,
    start: { dateTime: plan.startsAt },
    end: { dateTime: plan.endsAt },
    extendedProperties: {
      private: {
        fremee_owner_user_id: userId,
        fremee_plan_id: String(plan.id),
        fremee_source: "PLAN",
      },
    },
  };
}

function toDateKey(iso: string) {
  const date = new Date(iso);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
