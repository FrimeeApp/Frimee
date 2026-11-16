"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { addMonths, endOfMonth, startOfMonth } from "date-fns";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/components/ui/Toaster";
import type { CreatePlanPayload } from "@/components/plans/modals/CreatePlanModal";
import { createPlan, listPlansByIdsInOrder } from "@/services/api/repositories/plans.repository";
import { invitePeople } from "@/services/api/repositories/invitations.repository";
import { syncGoogleCalendarBidirectional } from "@/services/api/repositories/events.repository";
import { resolveGoogleProviderToken } from "@/services/auth/googleProviderToken";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { syncPlanWidget } from "@/services/widget/planWidget";
import { planWhenToIso } from "@/lib/plan-dates";

/** What a plan without a place stores (plan.ubicacion_nombre is NOT NULL), as in «Crear plan desde un chat». */
export const PLACE_TBD = "Por decidir";

/** «Ana», «Ana y Clara», «Ana, Clara y Dani», «Ana, Clara y 3 más». */
function namesSentence(names: string[]) {
  const first = names.map((n) => n.trim().split(/\s+/)[0] || n);
  if (first.length <= 1) return first.join("");
  if (first.length <= 3) return `${first.slice(0, -1).join(", ")} y ${first[first.length - 1]}`;
  return `${first.slice(0, 2).join(", ")} y ${first.length - 2} más`;
}

/**
 * Creating a plan from «Nuevo plan» (Mis planes, the calendar, the sidebar): upload the cover, one
 * fn_plan_create call (so a failure leaves nothing half-saved), then the extras that must not fail the
 * creation (invitations, Google Calendar export, the home widget). Ends on the new plan with
 * «Plan creado. Hemos invitado a …».
 */
export function useCreatePlan() {
  const { user, session, googleProviderToken, settings } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  return useCallback(
    async (payload: CreatePlanPayload): Promise<{ id: number }> => {
      if (!user?.id) throw new Error("Inicia sesión para crear un plan.");

      let coverUrl: string | null = null;
      if (payload.coverFile) {
        const { uploadPlanCoverFile } = await import("@/services/firebase/upload");
        coverUrl = (await uploadPlanCoverFile({ file: payload.coverFile, userId: user.id })).downloadUrl;
      }

      const { inicioAt, finAt } = planWhenToIso(payload.when);
      const created = await createPlan({
        titulo: payload.title,
        descripcion: payload.description,
        inicioAt,
        finAt,
        ubicacionNombre: payload.location || PLACE_TBD,
        fotoPortada: coverUrl,
        allDay: payload.when.allDay,
        visibilidad: payload.visibility,
        ownerUserId: user.id,
        creadoPorUserId: user.id,
      });

      // Invitations go through fn_plan_invitar (checks friendship, blocks…); it says who got one.
      const wanted = payload.invited.filter((p) => p.id !== user.id);
      let invited = wanted;
      let inviteFailed = false;
      if (wanted.length) {
        try {
          const sent = new Set(await invitePeople(created.id, wanted.map((p) => p.id)));
          invited = wanted.filter((p) => sent.has(p.id));
        } catch {
          invited = [];
          inviteFailed = true;
        }
      }

      if (settings?.google_sync_enabled && settings.google_sync_export_plans) {
        try {
          const token = await resolveGoogleProviderToken({ supabase, session, userId: user.id, cachedToken: googleProviderToken });
          const [plan] = token ? await listPlansByIdsInOrder([created.id]) : [];
          if (token && plan) {
            await syncGoogleCalendarBidirectional({
              userId: user.id,
              accessToken: token,
              timeMin: startOfMonth(addMonths(new Date(), -12)).toISOString(),
              timeMax: endOfMonth(addMonths(new Date(), 12)).toISOString(),
              plans: [plan],
              googleSyncEnabled: settings.google_sync_enabled,
              googleSyncExportPlans: settings.google_sync_export_plans,
            });
          }
        } catch (error) {
          console.warn("[nuevo-plan] google sync after create failed:", error);
        }
      }

      void syncPlanWidget(user.id).catch((error: unknown) => console.warn("[nuevo-plan] widget sync failed:", error));

      toast(
        inviteFailed
          ? "Plan creado, pero no se pudieron enviar las invitaciones. Invita desde el plan."
          : invited.length ? `Plan creado. Hemos invitado a ${namesSentence(invited.map((p) => p.name))}.` : "Plan creado.",
        inviteFailed ? "error" : "success",
      );
      router.push(Capacitor.isNativePlatform() ? `/plans/static?id=${created.id}` : `/plans/${created.id}`);
      return created;
    },
    [googleProviderToken, router, session, settings, supabase, toast, user?.id],
  );
}
