export type PublishablePlan = {
  id: number;
};

export type PublishPostPayload = {
  plan: PublishablePlan;
};

export function mapPlanToPublishPayload(plan: PublishablePlan): PublishPostPayload {
  return { plan };
}
