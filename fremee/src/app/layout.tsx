import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "../styles/globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import NativeSystemUi from "@/components/common/NativeSystemUi";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-display-face",
  weight: "400",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fremee",
  description: "Organiza planes, viajes y grupos",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body className={`${inter.variable} ${instrumentSerif.variable} antialiased`}>
        <NativeSystemUi />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
