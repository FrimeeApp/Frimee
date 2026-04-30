import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Mensajes",
  description: "Chats y conversaciones con tus amigos.",
};

export default function MessagesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
