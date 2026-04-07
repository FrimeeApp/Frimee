import { Capacitor, registerPlugin } from "@capacitor/core";
import { fetchUserRelatedPlans } from "@/services/api/endpoints/plans.endpoint";

interface WidgetPluginInterface {
  updatePlanWidget(options: {
    title: string;
    subtitle: string;
    coverUrl: string;
    planId: string;
    startAt: string;
  }): Promise<void>;
}

const WidgetPlugin = registerPlugin<WidgetPluginInterface>("WidgetPlugin");

export async function syncPlanWidget(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

  try {
    const plans = await fetchUserRelatedPlans({ userId, limit: 300 });
    const now = new Date();

    const upcoming = plans
      .filter((plan) => new Date(plan.fin_at) >= now)
      .sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime())[0];

    if (!upcoming) {
      await WidgetPlugin.updatePlanWidget({
        title: "Sin planes proximos",
        subtitle: "Abre Frimee para organizar tu siguiente plan",
        coverUrl: "",
        planId: "",
        startAt: "",
      });
      return;
    }

    const startDate = new Date(upcoming.inicio_at).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
    const subtitle = [startDate, upcoming.ubicacion_nombre].filter(Boolean).join(" - ");

    await WidgetPlugin.updatePlanWidget({
      title: upcoming.titulo,
      subtitle,
      coverUrl: upcoming.foto_portada ?? "",
      planId: String(upcoming.id),
      startAt: upcoming.inicio_at,
    });
  } catch (error) {
    console.error("[planWidget] Error syncing widget:", error);
  }
}
