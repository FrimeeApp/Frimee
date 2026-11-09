"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { NavigationBar } from "@capgo/capacitor-navigation-bar";
import { ScreenOrientation } from "@capacitor/screen-orientation";

/**
 * Android's navigation bar (gestures or the back / home / recent buttons) in the app's own
 * background colour, with dark buttons on the light theme and light ones on the dark theme.
 * "transparent" let the system draw its own veil, a shade lighter than the app.
 */
async function paintNavigationBar() {
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim() || (dark ? "#111111" : "#ffffff");
  try {
    await NavigationBar.setNavigationBarColor({ color: bg, darkButtons: !dark });
  } catch (error) {
    console.warn("[native-ui] navigation bar setup failed:", error);
  }
}

export default function NativeSystemUi() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupSystemUi = async () => {
      try {
        await ScreenOrientation.lock({ orientation: "portrait" });
      } catch (error) {
        console.warn("[native-ui] orientation lock failed:", error);
      }

      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.hide();
      } catch (error) {
        console.warn("[native-ui] status bar setup failed:", error);
      }

      if (Capacitor.getPlatform() === "android") await paintNavigationBar();
    };

    void setupSystemUi();

    // Follow the theme: the app switches it with the "dark" class on <html>.
    if (Capacitor.getPlatform() !== "android") return;
    const observer = new MutationObserver(() => void paintNavigationBar());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return null;
}
