import type { Metadata } from "next";
import PlanPageClient from "./PlanPageClient";

export const dynamic = "auto";

export const metadata: Metadata = {
  title: "Plan",
  description: "Detalles del plan: actividades, gastos y participantes.",
};

export async function generateStaticParams() {
  return [{ id: "static" }];
}

export default function PlanPage() {
  return <PlanPageClient />;
}
