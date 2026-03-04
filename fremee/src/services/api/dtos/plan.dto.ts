export type FeedPlanItemDto = {
  id: number;
  createdAt: string;
  title: string;
  description: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  visibility: "PUBLICO" | "PÚBLICO" | "SOLO_GRUPO" | "SOLO_AMIGOS" | "SOLO_FOLLOW";
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
