export type CalendarEventDto = {
  id: number;
  createdAt: string;
  updatedAt: string;
  ownerUserId: string;
  createdByUserId: string;
  title: string;
  description: string | null;
  category: "TRABAJO" | "MEDICO" | "CLASE" | "PERSONAL" | "OTRO";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string | null;
  locationName: string | null;
  locationAddress: string | null;
  source: "LOCAL" | "GOOGLE";
  googleCalendarId: string | null;
  googleEventId: string | null;
  syncStatus: "SYNCED" | "PENDING_CREATE" | "PENDING_UPDATE" | "PENDING_DELETE" | "ERROR";
};

export type ListCalendarEventsParams = {
  userId: string;
  rangeStartAt: string;
  rangeEndAt: string;
  limit?: number;
};

export type CreateCalendarEventParams = {
  userId: string;
  title: string;
  description?: string | null;
  category?: "TRABAJO" | "MEDICO" | "CLASE" | "PERSONAL" | "OTRO";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
};
