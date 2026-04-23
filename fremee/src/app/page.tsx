"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function resolveStaticFallback(url: URL): string | null {
  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length === 2 && parts[0] === "profile" && parts[1] !== "static") {
    return `/profile/static?id=${encodeURIComponent(parts[1])}`;
  }

  return null;
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const staticFallback = resolveStaticFallback(url);
    if (staticFallback) {
      router.replace(staticFallback);
      return;
    }

    const hasOAuthParams =
      url.searchParams.has("code") ||
      url.searchParams.has("error") ||
      url.searchParams.has("error_description");

    if (hasOAuthParams) {
      router.replace(`/auth/callback${url.search}`);
      return;
    }

    router.replace("/login");
  }, [router]);

  return null;
}
