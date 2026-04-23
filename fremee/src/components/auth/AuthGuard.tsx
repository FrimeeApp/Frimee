"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import LoadingScreen from "@/components/common/LoadingScreen";
import { syncPlanWidget } from "@/services/widget/planWidget";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  const router = useRouter();

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
