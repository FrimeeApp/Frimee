import { GOOGLE_CALENDAR_API_BASE_URL } from "@/config/external";

export type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  primary?: boolean;
  selected?: boolean;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: string;
  etag?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

export type GoogleCalendarUpsertInput = {
  summary: string;
  description?: string | null;
  location?: string | null;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: {
    private?: Record<string, string>;
  };
};

const GOOGLE_API_BASE = GOOGLE_CALENDAR_API_BASE_URL;

async function googleFetch<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[google-calendar] ${response.status} ${response.statusText}: ${body}`);
  }

  return (await response.json()) as T;
}

async function googleFetchWithMethod<T>(params: {
  url: string;
  accessToken: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
}): Promise<T> {
  const response = await fetch(params.url, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      ...(params.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[google-calendar] ${response.status} ${response.statusText}: ${body}`);
  }

  if (params.method === "DELETE") {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  type CalendarListResponse = { items?: GoogleCalendarListItem[] };
  const url = `${GOOGLE_API_BASE}/users/me/calendarList?minAccessRole=reader&showHidden=false`;
  const payload = await googleFetch<CalendarListResponse>(url, accessToken);
  return payload.items ?? [];
}

export async function listGoogleEventsByCalendar(params: {
  accessToken: string;
  calendarId: string;
  timeMin: string;
  timeMax: string;
}): Promise<GoogleCalendarEvent[]> {
  const query = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    maxResults: "2500",
    showDeleted: "true",
  });

  type EventsListResponse = { items?: GoogleCalendarEvent[] };
  const encodedCalendar = encodeURIComponent(params.calendarId);
  const url = `${GOOGLE_API_BASE}/calendars/${encodedCalendar}/events?${query.toString()}`;
  const payload = await googleFetch<EventsListResponse>(url, params.accessToken);
  return payload.items ?? [];
}

export async function createGoogleEvent(params: {
  accessToken: string;
  calendarId: string;
  input: GoogleCalendarUpsertInput;
}) {
  const encodedCalendar = encodeURIComponent(params.calendarId);
  const url = `${GOOGLE_API_BASE}/calendars/${encodedCalendar}/events`;
  return googleFetchWithMethod<GoogleCalendarEvent>({
    url,
    accessToken: params.accessToken,
    method: "POST",
    body: params.input,
  });
}

export async function updateGoogleEvent(params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  input: GoogleCalendarUpsertInput;
}) {
  const encodedCalendar = encodeURIComponent(params.calendarId);
  const encodedEvent = encodeURIComponent(params.eventId);
  const url = `${GOOGLE_API_BASE}/calendars/${encodedCalendar}/events/${encodedEvent}`;
  return googleFetchWithMethod<GoogleCalendarEvent>({
    url,
    accessToken: params.accessToken,
    method: "PATCH",
    body: params.input,
  });
}

export async function deleteGoogleEvent(params: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}) {
  const encodedCalendar = encodeURIComponent(params.calendarId);
  const encodedEvent = encodeURIComponent(params.eventId);
  const url = `${GOOGLE_API_BASE}/calendars/${encodedCalendar}/events/${encodedEvent}`;
  return googleFetchWithMethod<void>({
    url,
    accessToken: params.accessToken,
    method: "DELETE",
  });
}
