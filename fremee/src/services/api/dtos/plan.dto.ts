export type ItinerarySnapshotItem = {
  id: number;
  titulo: string;
  tipo: string;
  inicio_at: string;
  fin_at: string;
  all_day: boolean;
  ubicacion_nombre: string;
  ubicacion_fin_nombre: string | null;
};

export type PhotoSnapshot = { url: string };

export type ExpensesSnapshot = {
  total: number;
  currency: string;
  byCategory: { name: string; icon: string; color: string; total: number }[];
};

export type ParticipantsSnapshot = {
  count: number;
  avatars: { name: string; image: string | null }[];
};

export type PublicationConfig = {
  showDescription: boolean;
  showItinerary: boolean;
  showExpenses: false | "total" | "breakdown";
  showParticipants: false | "count" | "avatars";
};

export type FeedPlanItemDto = {
  id: number;
  createdAt: string;
  title: string;
  description: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  visibility: "PÚBLICO" | "SOLO_GRUPO" | "SOLO_AMIGOS" | "SOLO_FOLLOW";
  coverImage: string | null;
  ownerUserId?: string;
  creator: {
    id: string;
    name: string;
    profileImage: string | null;
  };
};

export type ExplorePlansParams = {
  limit?: number;
  cursorCreatedAt?: string | null;
  cursorPlanId?: number | null;
};
