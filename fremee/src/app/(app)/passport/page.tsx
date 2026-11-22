import { Suspense } from "react";
import type { Metadata } from "next";
import PassportClient from "./PassportClient";

export const metadata: Metadata = {
  title: "Pasaporte",
  description: "Tu pasaporte de viajes en Frimee.",
};

export default function PassportPage() {
  return (
    <Suspense>
      <PassportClient />
    </Suspense>
  );
}
