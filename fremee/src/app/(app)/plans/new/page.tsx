"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoadingScreen from "@/components/common/LoadingScreen";

export default function NewPlanPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/calendar?create=1");
  }, [router]);

  return <LoadingScreen />;
}
