"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { NavigationBar } from "@capgo/capacitor-navigation-bar";
import { ScreenOrientation } from "@capacitor/screen-orientation";
import { Keyboard } from "@capacitor/keyboard";
import { setWindowBackground } from "@/services/native/appSettings";

/**
 * Android's navigation bar (gestures or the back / home / recent buttons) in the app's own
 * background colour, with dark buttons on the light theme and light ones on the dark theme.
 * "transparent" let the system draw its own veil, a shade lighter than the app.
 */
/** Any CSS colour as #RRGGBB (Android accepts only that): the browser resolves it. */
function toHex6(color: string, fallback: string): string {
  const probe = document.createElement("span");
  probe.style.color = color;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
  probe.remove();
  if (!rgb || rgb.length < 3) return fallback;
  return "#" + rgb.slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, "0")).join("");
}

async function paintNavigationBar() {
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  const fallback = dark ? "#111111" : "#ffffff";
  const bg = toHex6(getComputedStyle(root).getPropertyValue("--bg").trim() || fallback, fallback);
  try {
    await NavigationBar.setNavigationBarColor({ color: bg, darkButtons: !dark });
  } catch (error) {
    console.warn("[native-ui] navigation bar setup failed:", error);
  }
  // Android 15 ignores that colour: the window behind the (now veil-less) bar gets it instead.
  await setWindowBackground(bg);
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

    // The keyboard covers the page (Keyboard resize "none"): its height goes to --keyboard-height
    // so screens like the chat keep their input and last messages above it.
    const root = document.documentElement;
    const subs = [
      Keyboard.addListener("keyboardWillShow", (info) => {
        root.style.setProperty("--keyboard-height", `${info.keyboardHeight}px`);
        window.dispatchEvent(new Event("frimee:keyboard"));
      }),
      Keyboard.addListener("keyboardWillHide", () => {
        root.style.setProperty("--keyboard-height", "0px");
        window.dispatchEvent(new Event("frimee:keyboard"));
      }),
    ];

    // Follow the theme: the app switches it with the "dark" class on <html>.
    const observer = Capacitor.getPlatform() === "android" ? new MutationObserver(() => void paintNavigationBar()) : null;
    observer?.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      observer?.disconnect();
      subs.forEach((sub) => void sub.then((s) => s.remove()));
      root.style.removeProperty("--keyboard-height");
    };
  }, []);

  return null;
}
