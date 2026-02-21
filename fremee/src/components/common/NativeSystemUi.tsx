"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { NavigationBar } from "@capgo/capacitor-navigation-bar";

export default function NativeSystemUi() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupSystemUi = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.hide();
      } catch (error) {
        console.warn("[native-ui] status bar setup failed:", error);
      }

      if (Capacitor.getPlatform() === "android") {
        try {
          // Android gesture area cannot be removed permanently, but this blends the nav bar with the app.
          await NavigationBar.setNavigationBarColor({
            color: "transparent",
            darkButtons: false,
          });
        } catch (error) {
          console.warn("[native-ui] navigation bar setup failed:", error);
        }
      }
    };

    void setupSystemUi();
  }, []);

  return null;
}

