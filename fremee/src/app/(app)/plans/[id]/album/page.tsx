import type { Metadata } from "next";
import AlbumPageClient from "./AlbumPageClient";

export const dynamic = "auto";

export const metadata: Metadata = {
  title: "Álbum del viaje",
  description: "El viaje día a día: sitios, rutas, fotos y cifras.",
};

// Static export for the mobile app: /plans/static/album?id=18, like the plan page.
export async function generateStaticParams() {
  return [{ id: "static" }];
}

export default function AlbumPage() {
  return <AlbumPageClient />;
}
