"use client";

import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { formatKm } from "@/lib/album";
import { fmtTime } from "@/lib/formatters";
import type { Ambient, Dashboard as DashboardData } from "@/lib/album-journey";

const AMBIENT: Record<Ambient, { Icon: typeof Sun; label: string; color: string }> = {
  manana: { Icon: Sunrise, label: "Mañana", color: "#fbbf24" },
  tarde: { Icon: Sun, label: "Tarde", color: "#fbbf24" },
  atardecer: { Icon: Sunset, label: "Atardecer", color: "#fb923c" },
  noche: { Icon: Moon, label: "Noche", color: "var(--al-muted)" },
};

/** Floating pill on the map: time of day, km so far today and money spent so far today. */
export function Dashboard({ data, currency, className = "inline-flex" }: { data: DashboardData; currency: string; className?: string }) {
  const { Icon, label, color } = AMBIENT[data.ambient];
  const money = new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 0 }).format(data.gasto);
  return (
    <div
      className={`pointer-events-none h-[34px] items-center gap-[10px] rounded-full border border-[var(--al-line)] bg-[var(--al-glass)] px-3 text-[12px] font-medium tabular-nums text-[var(--al-text)] backdrop-blur-sm ${className}`}
      aria-label={`${label}, ${fmtTime(data.time.toISOString())}, ${data.km > 0 ? formatKm(data.km) : "0 km"} recorridos, ${money} gastados hoy`}
    >
      <span className="flex items-center gap-1.5">
        <Icon className="size-[14px]" style={{ color }} aria-hidden />
        {fmtTime(data.time.toISOString())}
      </span>
      <span className="h-[14px] w-px bg-[var(--al-line)]" aria-hidden />
      <span>{data.km > 0 ? formatKm(data.km) : "0 km"}</span>
      <span className="h-[14px] w-px bg-[var(--al-line)]" aria-hidden />
      <span>{money}</span>
    </div>
  );
}
