"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import LoadingScreen from "@/components/common/LoadingScreen";
import { syncPlanWidget } from "@/services/widget/planWidget";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, user, signOut } = useAuth();
  const router = useRouter();

  // The session comes from browser storage. A guest deleted by the nightly cleanup
  // keeps a valid-looking token for up to an hour, so ask the server once.
  useEffect(() => {
    if (!user?.is_anonymous) return;
    void createBrowserSupabaseClient().auth.getUser().then(({ error }) => {
      if (error) void signOut();
    });
  }, [user?.id, user?.is_anonymous, signOut]);

  useEffect(() => {
    if (!loading && !user) {
      const redirect = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?redirect=${redirect}`);
    }
    if (!loading && user) {
      void syncPlanWidget(user.id);
    }
  }, [loading, user, router]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return <>{children}</>;
}
