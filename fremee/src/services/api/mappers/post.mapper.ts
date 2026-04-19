export type PublishablePlan = {
  id: number;
  title: string;
  description: string;
  locationName: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  visibility: string;
  coverImage: string | null;
  ownerUserId: string;
  caption?: string | null;
  creator?: { id: string; name: string; username?: string | null; profileImage: string | null } | null;
};

export type PublishPostPayload = {
  plan: PublishablePlan;
};

export function mapPlanToPublishPayload(plan: PublishablePlan): PublishPostPayload {
  return { plan };
}
