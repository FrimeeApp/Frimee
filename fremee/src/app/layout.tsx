import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "/";
import { AuthProvider } from "@/providers/AuthProvider";
import NativeDeepLinks from "@/components/common/NativeDeepLinks";
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
  // Capacitor: Android AssetManager can't serve files with "!" in their names.
  // The build script copies RSC files replacing "!" with "-"; patch fetch to match.
  try {
    if (window.Capacitor) {
      const _f = window.fetch.bind(window);
      window.fetch = function(input, opts) {
        var s = typeof input === "string" ? input : (input && input.url) ? input.url : null;
        console.log("[fetch-patch] type=" + typeof input + " url=" + (s ? s.substring(0, 80) : "?") + " hasNext=" + (s ? s.indexOf("__next.!") >= 0 : false));
        if (typeof input === "string" && input.indexOf("__next.!") >= 0)
          input = input.split("!").join("-");
        else if (input && input.url && input.url.indexOf("__next.!") >= 0)
          input = new Request(input.url.split("!").join("-"), input);
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
