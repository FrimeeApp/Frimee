import type { Metadata, Viewport } from "next";
import "./../styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Frimee Landings", template: "%s · Frimee Landings" },
  description: "Landings de Frimee.",
  icons: {
    icon: [{ url: "/favicoon-frimee-black.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo-frimee.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicoon-frimee-black.svg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const themeInitScript = `
(() => {
  try {
    const stored = localStorage.getItem("frimee.themePreference");
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
      <body>{children}</body>
    </html>
  );
}
