import type { Metadata } from "next";
import { Suspense } from "react";
import ProfileClient from "./ProfileClient";

export const dynamic = "auto";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Perfil de usuario en Frimee.",
};

export async function generateStaticParams() {
  // For Capacitor static export: pre-render a shell page.
  // Client-side useParams() handles the actual profile ID at runtime.
  return [{ id: "static" }];
}

export default async function ProfilePage() {
  return (
    <Suspense>
      <ProfileClient />
    </Suspense>
  );
}
