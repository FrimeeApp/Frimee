"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/providers/AuthProvider";
import {
  initPushNotifications,
  deliverInitialNotification,
  removeToken,
} from "@/services/notifications/push.service";

export function PushProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const initializedRef = useRef(false);
  const prevUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!user?.id) {
      // User signed out: clear device token
      if (prevUserRef.current) {
        void removeToken();
        initializedRef.current = false;
      }
      prevUserRef.current = null;
      return;
    }

    // Avoid re-initializing for the same user session
    if (initializedRef.current && prevUserRef.current === user.id) return;
    prevUserRef.current = user.id;
    initializedRef.current = true;

    const navigate = (path: string) => router.push(path);

    void initPushNotifications(navigate).then(() => {
      // Check if the app was opened by tapping a notification
      void deliverInitialNotification();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <>{children}</>;
}
