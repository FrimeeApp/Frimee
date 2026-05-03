import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Calendario",
  description: "Todos tus planes organizados por fecha.",
};

export default function CalendarLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
