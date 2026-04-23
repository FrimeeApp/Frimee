import PlanPostClient from "./PlanPostClient";

export const dynamic = "force-static";

// Capacitor navigates client-side via router.push, never loads these HTML files directly.
// The placeholder ensures Next.js static export accepts this dynamic route.
export async function generateStaticParams() {
  return [{ id: "_" }];
}

export default function PlanPostPage() {
  return <PlanPostClient />;
}
