import PlanDetailClient from "@/app/(app)/calendario/[planId]/PlanDetailClient";
import { CALENDAR_PLANS } from "@/app/(app)/calendario/mock-data";

export function generateStaticParams() {
  return CALENDAR_PLANS.map((plan) => ({ planId: plan.id }));
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  return <PlanDetailClient planId={planId} />;
}
