import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Feed",
  description: "Descubre planes y actividades de tus amigos.",
};

export default function FeedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
