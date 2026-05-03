import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "../styles/globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import NativeDeepLinks from "@/components/common/NativeDeepLinks";
import NativeSystemUi from "@/components/common/NativeSystemUi";
import { ToastProvider } from "@/components/ui/Toaster";
import OfflineBanner from "@/components/common/OfflineBanner";
import { APP_DESCRIPTION, APP_NAME } from "@/config/app";
import { STORAGE_KEYS } from "@/config/storage";

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
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  icons: {
    icon: [{ url: "/favicoon-frimee-black.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo-frimee.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicoon-frimee-black.svg"],
  },
  openGraph: {
    siteName: APP_NAME,
    images: [{ url: "/logo-frimee.png", width: 512, height: 512 }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "overlays-content",
};

const themeInitScript = `
(() => {
  try {
    document.documentElement.dataset.platform =
      window.Capacitor?.isNativePlatform?.() ? "native" : "web";

    const stored = localStorage.getItem("${STORAGE_KEYS.themePreference}");
    const theme = stored === "DARK" || stored === "LIGHT" || stored === "SYSTEM" ? stored : "SYSTEM";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const useDark = theme === "DARK" || (theme === "SYSTEM" && prefersDark);
    document.documentElement.classList.toggle("dark", useDark);
  } catch {}
  // Capacitor: Android AssetManager can't serve files with "!" in their names.
  // The build script copies RSC files replacing "!" with "-"; patch fetch to match.
  try {
    if (window.Capacitor) {
      const _f = window.fetch.bind(window);
      window.fetch = function(input, opts) {
        var raw = typeof input === "string" ? input
                : (input && typeof input.href === "string") ? input.href
                : (input && typeof input.url === "string") ? input.url
                : String(input);
        if (raw.indexOf("__next.!") >= 0) {
          var fixed = raw.split("!").join("-");
          if (typeof input === "string") input = fixed;
          else if (input instanceof URL) input = new URL(fixed);
          else if (input instanceof Request) input = new Request(fixed, input);
          else input = fixed;
        }
        return _f(input, opts);
      };
    }
  } catch(e) { console.error("[fetch-patch] error", e); }
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
        <NativeDeepLinks />
        <OfflineBanner />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
