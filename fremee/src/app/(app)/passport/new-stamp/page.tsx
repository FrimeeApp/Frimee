import { Suspense } from "react";
import type { Metadata } from "next";
import NewStampClient from "./NewStampClient";

export const metadata: Metadata = {
  title: "Sello nuevo",
  description: "Un viaje nuevo acaba de sellarse en tu pasaporte.",
};

export default function NewStampPage() {
  return (
    <Suspense>
      <NewStampClient />
    </Suspense>
  );
}
