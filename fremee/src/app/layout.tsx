import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import NativeSystemUi from "@/components/common/NativeSystemUi";

export const metadata: Metadata = {
  title: "Fremee",
  description: "Organiza planes, viajes y grupos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        <NativeSystemUi />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
