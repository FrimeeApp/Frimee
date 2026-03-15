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

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("fremee.theme");
    const theme = stored === "DARK" || stored === "LIGHT" || stored === "SYSTEM" ? stored : "SYSTEM";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = theme === "DARK" || (theme === "SYSTEM" && prefersDark);
    document.documentElement.classList.toggle("dark", useDark);
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <NativeSystemUi />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
