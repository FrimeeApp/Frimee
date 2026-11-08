import type { LucideIcon } from "lucide-react";
import { Plane, Ship } from "lucide-react";
import { TRANSPORT_MAP } from "../_components/AddSubplanSheet";

/** Label and icon for a leg: travel modes in town, plus flights and ferries between cities. */
export function transportInfo(transporte: string | null | undefined): { label: string; Icon: LucideIcon } | null {
  if (!transporte) return null;
  if (transporte === "VUELO") return { label: "Avión", Icon: Plane };
  if (transporte === "BARCO") return { label: "Barco", Icon: Ship };
  const t = TRANSPORT_MAP[transporte];
  return t ? { label: t.label, Icon: t.Icon } : null;
}
