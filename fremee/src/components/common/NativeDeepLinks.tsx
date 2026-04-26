"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import { APP_DEEP_LINK_SCHEME } from "@/config/app";

function resolveNativePath(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== `${APP_DEEP_LINK_SCHEME}:`) return null;
    if (parsed.hostname !== "plans") return null;

    const queryPlanId = parsed.searchParams.get("id");
    if (queryPlanId) return `/plans/static?id=${encodeURIComponent(queryPlanId)}`;

    const pathPlanId = parsed.pathname.replace(/^\/+/, "");
    if (pathPlanId && pathPlanId !== "static") {
      return `/plans/static?id=${encodeURIComponent(pathPlanId)}`;
    }

    return "/calendar";
  } catch {
    return null;
  }
}

export default function NativeDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const navigateFromUrl = (url?: string | null) => {
      const nextPath = url ? resolveNativePath(url) : null;
      if (nextPath) router.push(nextPath);
    };

    void App.getLaunchUrl().then((result) => {
      navigateFromUrl(result?.url);
    });

    const listener = App.addListener("appUrlOpen", ({ url }) => {
      navigateFromUrl(url);
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [router]);

  return null;
}
