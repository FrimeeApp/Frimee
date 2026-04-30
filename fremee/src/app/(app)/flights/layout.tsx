import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "En ruta",
  description: "Sigue en tiempo real los vuelos y trayectos de tus amigos.",
};

export default function FlightsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
