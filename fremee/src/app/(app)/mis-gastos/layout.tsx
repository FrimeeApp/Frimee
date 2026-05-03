import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mis gastos",
  description: "Controla los gastos compartidos con tus amigos.",
};

export default function MisGastosLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
