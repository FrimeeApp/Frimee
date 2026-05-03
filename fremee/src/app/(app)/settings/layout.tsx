import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Ajustes",
  description: "Gestiona tu perfil, privacidad y preferencias.",
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
