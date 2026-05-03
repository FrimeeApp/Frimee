"use client";

import { useEffect, useState } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const onOffline = () => setOffline(true);
    const onOnline  = () => setOffline(false);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online",  onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online",  onOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top)+var(--space-3))] left-0 right-0 z-[300] flex justify-center">
      <p className="text-caption text-muted">
        Sin conexión
      </p>
    </div>
  );
}
