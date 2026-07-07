import type { Metadata, Viewport } from "next";
import "./../styles/globals.css";

const SITE_NAME = "Frimee";
const SITE_DESCRIPTION =
  "Organiza viajes, planes y gastos compartidos con Frimee.";

function resolveMetadataBase() {
  const rawUrl =
    process.env.NEXT_PUBLIC_LANDING_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://frimee.app");

  try {
    return new URL(rawUrl.replace(/\/+$/, ""));
  } catch {
    return new URL("https://frimee.app");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/images/favicoon-frimee-black.svg", type: "image/svg+xml" }],
    apple: [{ url: "/images/logo-frimee.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/images/favicoon-frimee-black.svg"],
  },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "es_ES",
    images: [{ url: "/images/logo-frimee.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/images/logo-frimee.png"],
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
