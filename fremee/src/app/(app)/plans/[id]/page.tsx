import PlanPageClient from "./PlanPageClient";

export const dynamic = "auto";

export async function generateStaticParams() {
  return [{ id: "static" }];
}

export default function PlanPage() {
  return <PlanPageClient />;
}
