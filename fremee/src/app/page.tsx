"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
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
