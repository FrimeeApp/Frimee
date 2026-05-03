import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Wallet",
  description: "Tus billetes, reservas y entradas en un solo lugar.",
};

export default function WalletLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
