"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { APP_HOME_PATH } from "@/config/app";
import { pendingTrips } from "@/lib/passport";
import { useAuth } from "@/providers/AuthProvider";
import { leerPasaporte } from "@/services/api/endpoints/pasaporte.endpoint";

const CHECKED_KEY = "frimee-new-stamp-checked";

/**
 * Al abrir la app, si hay un viaje recién sellado que aún no has visto y no entraste por el aviso
 * (por ejemplo, con las notificaciones desactivadas), enseña «Sello nuevo» una vez.
 * Solo se mira al aterrizar en la pantalla de inicio y una vez por sesión: un enlace a un plan no se interrumpe.
 */
export default function NewStampOnOpen() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const userId = user?.id;
  const isGuest = Boolean(user?.is_anonymous);

  useEffect(() => {
    if (!userId || isGuest || pathname !== APP_HOME_PATH) return;
    try {
      if (sessionStorage.getItem(CHECKED_KEY) === userId) return;
      sessionStorage.setItem(CHECKED_KEY, userId);
    } catch {
      // Sin sessionStorage se mira en cada aterrizaje: no pasa nada.
    }
    let cancelled = false;
    leerPasaporte()
      .then((p) => {
        if (!cancelled && pendingTrips(p.sellos, 7).length > 0) router.push("/passport/new-stamp");
      })
      .catch((err) => console.error("[pasaporte] No se pudo comprobar si hay sellos nuevos:", (err as { message?: string } | null)?.message ?? err));
    return () => {
      cancelled = true;
    };
  }, [userId, isGuest, pathname, router]);

  return null;
}
