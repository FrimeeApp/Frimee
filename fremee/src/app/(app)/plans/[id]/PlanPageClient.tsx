"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import { useAuth } from "@/providers/AuthProvider";
import { fetchPlansByIds, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import { fetchSubplanes, createSubplan, updateSubplanTransporte, updateSubplanViaje, type SubplanRow, type TipoSubplan, TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { Calendar } from "@/components/ui/calendar";
import DayRouteMap from "@/components/plans/DayRouteMap";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const MOCK_DAYS = [
  {
    day: 1,
    label: "Arrival",
    date: "SEPT 14, 2024",
    activities: [
      {
        time: "08:30 AM",
        title: "Vuelo a Santorini",
        subtitle: "MAD (T4) → JTR Airport",
        badge: { text: "CONFIRMED", color: "green" as const },
        icon: "plane",
      },
      {
        time: "02:00 PM",
        title: "Check-in Hotel",
        subtitle: "Katikies Garden Santorini, Fira",
        badge: { text: "RESERVATION #9301", color: "gray" as const },
        icon: "hotel",
      },
      {
        time: "08:00 PM",
        title: "Cena Atardecer",
        subtitle: "Ammoudi Fish Tavern, Oia",
        icon: "food",
      },
    ],
  },
  {
    day: 2,
    label: "Exploring Oia",
    date: "SEPT 15, 2024",
    activities: [
      {
        time: "09:00 AM",
        title: "Desayuno en el hotel",
        subtitle: "Katikies Garden Santorini",
        icon: "food",
      },
      {
        time: "11:00 AM",
        title: "Paseo por Oia",
        subtitle: "Calles y cúpulas azules",
        icon: "walk",
      },
      {
        time: "01:30 PM",
        title: "Almuerzo en Ammoudi Bay",
        subtitle: "Sunset Tavern",
        icon: "food",
      },
      {
        time: "05:00 PM",
        title: "Catamaran Tour",
        subtitle: "Sailing Santorini, puerto de Fira",
        badge: { text: "BOOKED", color: "green" as const },
        icon: "boat",
      },
    ],
  },
];

const MOCK_EXPENSES = {
  total: 1250.0,
  categories: [
    { name: "Vuelos", detail: "Lufthansa Airlines", amount: 420.0, status: "PAID" as const, icon: "plane" },
    { name: "Hotel", detail: "Katikies Garden", amount: 680.0, status: "PENDING" as const, icon: "hotel" },
    { name: "Excursiones", detail: "Catamaran Tour", amount: 150.0, status: "PAID" as const, icon: "boat" },
  ],
};

type Tab = "itinerario" | "mapa" | "gastos";

/* ───────────── icons ───────────── */

function BackIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6L12 2L8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M16.474 5.408L18.592 7.526M17.836 3.186L12.109 8.913C11.81 9.212 11.601 9.589 11.506 10.002L11 12L12.998 11.494C13.411 11.399 13.788 11.19 14.087 10.891L19.814 5.164C20.395 4.583 20.395 3.767 19.814 3.186C19.233 2.605 18.417 2.605 17.836 3.186Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 15V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlaneIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 16L22 2M22 2L17 22L13 13L22 2ZM22 2L2 7L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function HotelIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 21V7L12 3L21 7V21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 21V15H15V21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 11H10M14 11H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FoodIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 8C18 4.69 15.31 2 12 2C8.69 2 6 4.69 6 8C6 10.22 7.21 12.16 9 13.2V22H15V13.2C16.79 12.16 18 10.22 18 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8V2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BoatIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 20C4 18 6 17 8 17C10 17 12 19 14 19C16 19 18 18 22 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4V15M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 15L12 15L18 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WalkIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 22L11 16L9 14V10L12 7L15 10V14L13 16L14 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ExpandIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 3H21V9M9 21H3V15M21 3L14 10M3 21L10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarSmallIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const ACTIVITY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  plane: PlaneIcon,
  hotel: HotelIcon,
  food: FoodIcon,
  boat: BoatIcon,
  walk: WalkIcon,
};

/* ───────────── skeleton ───────────── */

function PlanDetailSkeleton() {
  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />
        <main className="pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-0 md:pr-[var(--space-14)] md:pl-[102px]">

          {/* Hero skeleton */}
          <div
            className="relative w-full overflow-hidden md:ml-0 md:rounded-b-[20px] animate-pulse bg-[var(--surface-2)]"
            style={{ height: "clamp(260px, 40vh, 380px)" }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            {/* Back button placeholder */}
            <div className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] md:top-[var(--space-6)] h-9 w-9 rounded-full bg-white/20" />
            {/* Title & meta placeholders */}
            <div className="absolute bottom-0 left-0 right-0 px-[var(--page-margin-x)] pb-[var(--space-6)] space-y-[var(--space-2)]">
              <div className="h-8 w-2/3 rounded-lg bg-white/20" />
              <div className="h-4 w-1/3 rounded-md bg-white/15" />
              <div className="flex gap-[var(--space-4)] pt-[var(--space-1)]">
                <div className="h-4 w-24 rounded-md bg-white/15" />
                <div className="h-4 w-28 rounded-md bg-white/15" />
              </div>
            </div>
          </div>

          {/* Tabs skeleton */}
          <div className="border-b border-app px-[var(--page-margin-x)]">
            <div className="flex gap-[var(--space-8)] py-[var(--space-4)]">
              {[80, 56, 64].map((w, i) => (
                <div key={i} className="h-4 rounded-md bg-[var(--surface-2)] animate-pulse" style={{ width: w }} />
              ))}
            </div>
          </div>

          {/* Content skeleton */}
          <div className="px-[var(--page-margin-x)] pt-[var(--space-8)] space-y-[var(--space-6)]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-[var(--space-4)]">
                <div className="h-6 w-6 shrink-0 rounded-full bg-[var(--surface-2)] animate-pulse" />
                <div className="flex-1 space-y-[var(--space-2)]">
                  <div className="h-4 w-1/4 rounded-md bg-[var(--surface-2)] animate-pulse" />
                  <div className="h-4 w-1/2 rounded-md bg-[var(--surface-2)] animate-pulse" />
                  <div className="h-3 w-1/3 rounded-md bg-[var(--surface-2)] animate-pulse" />
                </div>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}

/* ───────────── page ───────────── */

function formatDateRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} – ${end.getDate()} ${months[start.getMonth()]}`;
  }
  return `${start.getDate()} ${months[start.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
}

/* ───────────── helpers ───────────── */

const MONTHS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function fmtDayHeader(iso: string) {
  const d = new Date(iso);
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function isoDateOnly(iso: string) {
  return iso.slice(0, 10);
}

const TIPO_ICON: Record<string, string> = {
  VUELO: "✈️",
  BARCO: "🚢",
  TREN: "🚆",
  BUS: "🚌",
  COCHE: "🚗",
};

function tipoIcon(tipo: string) {
  return TIPO_ICON[tipo] ?? "↓";
}

function groupByDay(subplanes: SubplanRow[]) {
  const map = new Map<string, SubplanRow[]>();
  for (const s of subplanes) {
    const key = isoDateOnly(s.inicio_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

/* ───────────── location autocomplete ───────────── */

/* ───────────── occupied-time helpers ───────────── */

function parseDurMinutes(text: string | null | undefined): number {
  if (!text) return 0;
  const h = text.match(/(\d+)\s*h/)?.[1];
  const m = text.match(/(\d+)\s*min/)?.[1];
  return Number(h ?? 0) * 60 + Number(m ?? 0);
}

function timeToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minToTime(total: number): string {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type Interval = { from: number; to: number };

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (!intervals.length) return [];
  const sorted = [...intervals].sort((a, b) => a.from - b.from);
  const merged: Interval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].from < last.to) last.to = Math.max(last.to, sorted[i].to);
    else merged.push({ ...sorted[i] });
  }
  return merged;
}

function getOccupiedIntervals(subplanes: SubplanRow[], fecha: string): Interval[] {
  const toLocalHHMM = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const daySubplanes = subplanes
    .filter(s => toLocalDate(s.inicio_at) === fecha)
    .sort((a, b) => new Date(a.inicio_at).getTime() - new Date(b.inicio_at).getTime());

  const intervals: Interval[] = [];
  daySubplanes.forEach((s, i) => {
    const from = timeToMin(toLocalHHMM(s.inicio_at));
    let to = timeToMin(toLocalHHMM(s.fin_at));
    // Add travel time of the next subplan (you need to leave before it starts)
    if (i + 1 < daySubplanes.length) {
      const travelMin = parseDurMinutes(daySubplanes[i + 1].duracion_viaje);
      if (travelMin > 0) to = Math.min(to + travelMin, 24 * 60 - 1);
    }
    intervals.push({ from, to });
  });

  return mergeIntervals(intervals);
}

function getFreeSlots(occupied: Interval[], dayStart: number, dayEnd: number): Interval[] {
  const free: Interval[] = [];
  let cursor = dayStart;
  for (const iv of occupied) {
    if (cursor < iv.from) free.push({ from: cursor, to: iv.from });
    cursor = Math.max(cursor, iv.to);
  }
  if (cursor < dayEnd) free.push({ from: cursor, to: dayEnd });
  return free;
}

/* ───────────── time wheel picker ───────────── */

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const ITEM_H    = 32;
const PAD_ITEMS = 1;
const PAD_PX    = ITEM_H * PAD_ITEMS;
const TOTAL_H   = ITEM_H * (PAD_ITEMS * 2 + 1);

function TimeWheel({ values, selected, onSelect }: { values: string[]; selected: string; onSelect: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const settling = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const snapTo = (idx: number, smooth: boolean) => {
    ref.current?.scrollTo({ top: idx * ITEM_H, behavior: smooth ? "smooth" : "instant" });
  };

  // Scroll to selected on mount (instant)
  useEffect(() => {
    const idx = values.indexOf(selected);
    if (idx >= 0) snapTo(idx, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow external selected changes (e.g. min/max clamp from parent)
  useEffect(() => {
    if (settling.current) return;
    const idx = values.indexOf(selected);
    if (idx >= 0) snapTo(idx, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, values]);

  const handleScroll = () => {
    settling.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const idx = Math.round(ref.current.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, values.length - 1));
      snapTo(clamped, true); // smooth-snap to nearest
      const v = values[clamped];
      if (v && v !== selected) onSelect(v);
      setTimeout(() => { settling.current = false; }, 200);
    }, 60);
  };

  return (
    <div className="relative overflow-hidden" style={{ width: 52, height: TOTAL_H }}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ height: PAD_PX, background: "linear-gradient(to bottom, var(--surface), transparent)" }} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10" style={{ height: PAD_PX, background: "linear-gradient(to top, var(--surface), transparent)" }} />
      <div className="pointer-events-none absolute inset-x-1 z-0 rounded-[8px] bg-primary-token/20 border border-primary-token/40" style={{ top: PAD_PX, height: ITEM_H }} />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="scrollbar-hide h-full overflow-y-scroll"
        style={{ paddingTop: PAD_PX, paddingBottom: PAD_PX }}
      >
        {values.map((v) => (
          <div
            key={v}
            style={{ height: ITEM_H }}
            className={`flex cursor-pointer select-none items-center justify-center text-[16px] font-[var(--fw-semibold)] transition-colors ${v === selected ? "text-primary-token" : "text-muted/50"}`}
            onMouseDown={() => {
              const idx = values.indexOf(v);
              snapTo(idx, true);
              onSelect(v);
            }}
          >
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeWheelPicker({ value, onChange, minTime, maxTime, blockedIntervals }: {
  value: string;
  onChange: (v: string) => void;
  minTime?: string;
  maxTime?: string;
  blockedIntervals?: Interval[]; // minutes from midnight
}) {
  const [hh, mm] = value.split(":");
  const minH = minTime ? Number(minTime.split(":")[0]) : 0;
  const maxH = maxTime ? Number(maxTime.split(":")[0]) : 23;
  const minM = minTime ? Number(minTime.split(":")[1]) : 0;
  const maxM = maxTime ? Number(maxTime.split(":")[1]) : 59;

  // An hour is fully blocked if every minute [h*60, h*60+59] is inside a blocked interval
  const isHourFullyBlocked = (h: number) =>
    !!blockedIntervals?.some(b => b.from <= h * 60 && b.to >= h * 60 + 59);

  const hours = HOURS.filter(h => {
    const hN = Number(h);
    return hN >= minH && hN <= maxH && !isHourFullyBlocked(hN);
  });
  const minutes = MINUTES.filter(m => {
    const mN = Number(m), hN = Number(hh);
    if (hN === minH && mN < minM) return false;
    if (hN === maxH && mN > maxM) return false;
    return true;
  });

  const safeHh = hours.includes(hh)  ? hh  : (hours[0]   ?? "00");
  const safeMm = minutes.includes(mm) ? mm  : (minutes[0] ?? "00");

  const handleHourChange = (h: string) => {
    const hN = Number(h);
    const newMinM = hN === minH ? minM : 0;
    const newMaxM = hN === maxH ? maxM : 59;
    const clampedM = Math.max(newMinM, Math.min(newMaxM, Number(safeMm)));
    onChange(`${h}:${String(clampedM).padStart(2, "0")}`);
  };

  return (
    <div className="flex items-center justify-center gap-1 rounded-[12px] border border-app bg-surface-inset py-[var(--space-2)]">
      <TimeWheel values={hours}   selected={safeHh} onSelect={handleHourChange} />
      <span className="text-[16px] font-[var(--fw-semibold)] text-primary-token">:</span>
      <TimeWheel values={minutes} selected={safeMm} onSelect={(m) => onChange(`${safeHh}:${m}`)} />
    </div>
  );
}

type PlaceSuggestion = {
  placePrediction: {
    text: { toString(): string };
    mainText: { toString(): string };
    secondaryText?: { toString(): string };
    toPlace(): { fetchFields(opts: { fields: string[] }): Promise<void>; location?: { lat(): number; lng(): number } };
  };
};

type Coords = { lat: number; lng: number };

function LocationAutocomplete({ value, onChange, placeholder = "¿Dónde será?" }: { value: string; onChange: (v: string, coords?: Coords) => void; placeholder?: string }) {
  const [mapsReady, setMapsReady] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.places?.AutocompleteSuggestion) { setMapsReady(true); return; }
    if (document.getElementById("google-maps-script")) return;
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly&libraries=places`;
    script.async = true;
    script.onload = () => setMapsReady(true);
    document.head.appendChild(script);
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { suggestions: results } = await (window as any).google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input });
      setSuggestions(results ?? []);
      setOpen((results ?? []).length > 0);
    } catch { setSuggestions([]); }
  };

  const handleSelect = async (s: PlaceSuggestion) => {
    const text = s.placePrediction.text.toString();
    onChange(text); // optimistic: show text immediately
    setSuggestions([]);
    setOpen(false);
    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({ fields: ["location"] });
      if (place.location) {
        onChange(text, { lat: place.location.lat(), lng: place.location.lng() });
      }
    } catch { /* coords unavailable, geocoding will be used as fallback */ }
  };

  const handleChange = (v: string) => {
    onChange(v);
    if (!mapsReady) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full bg-transparent text-body outline-none placeholder:text-muted"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-[calc(100%+8px)] left-0 z-[90] w-[280px] max-h-[220px] overflow-y-auto scrollbar-thin rounded-[12px] border border-app bg-surface shadow-elev-4">
          {suggestions.slice(0, 5).map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
              className="cursor-pointer px-[var(--space-3)] py-[var(--space-3)] hover:bg-surface-inset"
            >
              <p className="text-body-sm font-[var(--fw-medium)] text-primary">{s.placePrediction.mainText.toString()}</p>
              <p className="text-caption text-muted">{s.placePrediction.secondaryText?.toString() ?? ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────── add sheet ───────────── */

const TRANSPORT_LLEGADA = [
  { value: "APIE",  emoji: "🚶", label: "A pie",  googleMode: "walking" },
  { value: "COCHE", emoji: "🚗", label: "Coche",  googleMode: "driving" },
  { value: "TAXI",  emoji: "🚕", label: "Taxi",   googleMode: "driving" },
  { value: "BUS",   emoji: "🚌", label: "Bus",    googleMode: "transit" },
  { value: "METRO", emoji: "🚇", label: "Metro",  googleMode: "transit" },
  { value: "TREN",  emoji: "🚆", label: "Tren",   googleMode: "transit" },
];

const TRANSPORT_MAP = Object.fromEntries(TRANSPORT_LLEGADA.map((t) => [t.value, t]));

type AddSheetProps = {
  planId: number;
  planStartDate: string;
  planEndDate: string;
  subplanes: SubplanRow[];
  onClose: () => void;
  onCreated: (s: SubplanRow) => void;
};

function AddSubplanSheet({ planId, planStartDate, planEndDate, subplanes, onClose, onCreated }: AddSheetProps) {
  // Use local date to avoid UTC-offset shifting the allowed range by one day
  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const toLocalTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };
  const minDate = toLocalDate(planStartDate);
  const maxDate = toLocalDate(planEndDate);
  const planStartTime = toLocalTime(planStartDate);
  const planEndTime   = toLocalTime(planEndDate);
  const planIsAllDay  = planStartTime === "00:00" && planEndTime === "23:59";

  const defaultDate = minDate;
  // Default hours clamped to plan bounds (only matters when plan has specific hours)
  const defaultHoraInicio = planIsAllDay ? "10:00" : planStartTime;
  const defaultHoraFin    = planIsAllDay ? "11:00" : planEndTime;

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(defaultDate);
  const [horaInicio, setHoraInicio] = useState(defaultHoraInicio);
  const [horaFin, setHoraFin] = useState(defaultHoraFin);
  const allDay = false;
  const [tipo, setTipo] = useState<TipoSubplan>("ACTIVIDAD");
  const [ubicacion, setUbicacion] = useState("");
  const [ubicacionCoords, setUbicacionCoords] = useState<Coords | null>(null);
  const [ubicacionFin, setUbicacionFin] = useState("");
  const [ubicacionFinCoords, setUbicacionFinCoords] = useState<Coords | null>(null);
  const [transporteLlegada, setTransporteLlegada] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ¿Ya hay actividades ese día? → mostrar selector de transporte
  const hayActividadEseDia = subplanes.some((s) => isoDateOnly(s.inicio_at) === fecha);
  const esTransporte = TIPOS_TRANSPORTE.includes(tipo);
  const [error, setError] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Clamp hours when date or hours change to ensure they stay within plan bounds
  const clampedHoraInicio = (() => {
    if (planIsAllDay) return horaInicio;
    if (fecha === minDate && horaInicio < planStartTime) return planStartTime;
    if (fecha === maxDate && horaInicio > planEndTime)   return planEndTime;
    return horaInicio;
  })();

  const clampedHoraFin = (() => {
    if (planIsAllDay) return horaFin;
    if (fecha === maxDate && horaFin > planEndTime) return planEndTime;
    if (horaFin <= clampedHoraInicio) {
      // ensure fin > inicio
      const [h, m] = clampedHoraInicio.split(":").map(Number);
      const totalMin = h * 60 + m + 60;
      const maxTotal = planIsAllDay ? 23 * 60 + 59 : (Number(planEndTime.split(":")[0]) * 60 + Number(planEndTime.split(":")[1]));
      const clamped = Math.min(totalMin, maxTotal);
      return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
    }
    return horaFin;
  })();

  // Occupied intervals for the selected day (existing subplans + travel time)
  const occupiedIntervals = fecha ? getOccupiedIntervals(subplanes, fecha) : [];
  const dayStart = fecha === minDate && !planIsAllDay ? timeToMin(planStartTime) : 0;
  const dayEnd   = fecha === maxDate && !planIsAllDay ? timeToMin(planEndTime)   : 24 * 60 - 1;
  const freeSlots = getFreeSlots(occupiedIntervals, dayStart, dayEnd);

  const canSubmit = titulo.trim().length > 0 && fecha.length > 0 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Validate no overlap with existing subplans + travel time
    if (!allDay && occupiedIntervals.length > 0) {
      const newFrom = timeToMin(clampedHoraInicio);
      const newTo   = timeToMin(clampedHoraFin);
      const overlaps = occupiedIntervals.some(b => newFrom < b.to && newTo > b.from);
      if (overlaps) {
        setError("Este horario se solapa con una actividad existente o su tiempo de viaje.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const inicioAt = allDay ? `${fecha}T00:00:00` : `${fecha}T${clampedHoraInicio}:00`;
      const finAt    = allDay ? `${fecha}T23:59:59` : `${fecha}T${clampedHoraFin}:00`;
      const newId = await createSubplan({
        planId,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        inicioAt: new Date(inicioAt).toISOString(),
        finAt:    new Date(finAt).toISOString(),
        allDay,
        tipo,
        ubicacionNombre: ubicacion.trim(),
        ubicacionFinNombre: esTransporte ? ubicacionFin.trim() : null,
        ubicacionLat:    ubicacionCoords?.lat ?? null,
        ubicacionLng:    ubicacionCoords?.lng ?? null,
        ubicacionFinLat: esTransporte ? (ubicacionFinCoords?.lat ?? null) : null,
        ubicacionFinLng: esTransporte ? (ubicacionFinCoords?.lng ?? null) : null,
        transporteLlegada: hayActividadEseDia ? transporteLlegada : null,
      });
      const newSubplan: SubplanRow = {
        id: newId, plan_id: planId, parent_subplan_id: null,
        titulo: titulo.trim(), descripcion: descripcion.trim(),
        inicio_at: new Date(inicioAt).toISOString(),
        fin_at:    new Date(finAt).toISOString(),
        all_day: allDay, tipo,
        ubicacion_nombre: ubicacion.trim(), ubicacion_direccion: null,
        ubicacion_fin_nombre: esTransporte ? ubicacionFin.trim() : null,
        ubicacion_fin_direccion: null,
        ubicacion_lat:    ubicacionCoords?.lat ?? null,
        ubicacion_lng:    ubicacionCoords?.lng ?? null,
        ubicacion_fin_lat: esTransporte ? (ubicacionFinCoords?.lat ?? null) : null,
        ubicacion_fin_lng: esTransporte ? (ubicacionFinCoords?.lng ?? null) : null,
        transporte_llegada: hayActividadEseDia ? transporteLlegada : null,
        duracion_viaje: null, distancia_viaje: null, ruta_polyline: null,
        orden: 0, estado: "ACTIVO",
        creado_por_user_id: "", created_at: new Date().toISOString(),
      };
      onCreated(newSubplan);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la actividad");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Backdrop with blur */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-4)]">
      <div
        ref={sheetRef}
        className="flex w-full max-w-[540px] flex-col rounded-[20px] bg-surface shadow-elev-3 max-h-[90dvh] overflow-hidden"
      >

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto scrollbar-thin">
          <div className="px-[var(--page-margin-x)] pt-[var(--space-5)] pb-[var(--space-2)] space-y-[var(--space-6)]">

            {/* Título + descripción */}
            <div>
              <input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Nombre de la actividad"
                className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] outline-none placeholder:text-muted"
              />
              <input
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Descripción breve (opcional)"
                className="mt-[var(--space-1)] w-full bg-transparent text-body-sm text-muted outline-none placeholder:text-muted/60"
              />
            </div>

            {/* Tipo de actividad */}
            <div>
              <p className="mb-[var(--space-2)] text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Tipo</p>
              <div className="flex flex-wrap gap-[var(--space-2)]">
                {([
                  { value: "ACTIVIDAD",   label: "Actividad",   emoji: "🎡" },
                  { value: "VUELO",       label: "Vuelo",       emoji: "✈️" },
                  { value: "BARCO",       label: "Barco",       emoji: "🚢" },
                  { value: "HOTEL",       label: "Hotel",       emoji: "🏨" },
                  { value: "RESTAURANTE", label: "Restaurante", emoji: "🍽️" },
                  { value: "OTRO",        label: "Otro",        emoji: "📌" },
                ] as { value: TipoSubplan; label: string; emoji: string }[]).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTipo(t.value)}
                    className={`flex items-center gap-[var(--space-1)] rounded-chip px-[var(--space-3)] py-[var(--space-1)] text-body-sm font-[var(--fw-medium)] border transition-colors ${
                      tipo === t.value
                        ? "border-primary-token bg-primary-token/15 text-primary-token"
                        : "border-app bg-surface-inset text-muted"
                    }`}
                  >
                    <span>{t.emoji}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ubicación */}
            <div className="space-y-[var(--space-3)]">
              <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">
                {esTransporte ? "Origen" : "Ubicación"}
              </p>
              <div className="flex h-input items-center gap-[var(--space-2)] rounded-input border border-app bg-surface-inset px-[var(--space-3)]">
                <MapPinIcon className="size-[16px] shrink-0 text-muted" />
                <LocationAutocomplete
                  value={ubicacion}
                  onChange={(v, coords) => { setUbicacion(v); if (coords) setUbicacionCoords(coords); else setUbicacionCoords(null); }}
                  placeholder={
                    tipo === "VUELO"       ? "Aeropuerto de salida" :
                    tipo === "BARCO"       ? "Puerto de salida" :
                    tipo === "HOTEL"       ? "Nombre del hotel" :
                    tipo === "RESTAURANTE" ? "Nombre del restaurante" :
                    "¿Dónde será?"
                  }
                />
              </div>
              {esTransporte && (
                <>
                  <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Destino</p>
                  <div className="flex h-input items-center gap-[var(--space-2)] rounded-input border border-app bg-surface-inset px-[var(--space-3)]">
                    <MapPinIcon className="size-[16px] shrink-0 text-primary-token" />
                    <LocationAutocomplete
                      value={ubicacionFin}
                      onChange={(v, coords) => { setUbicacionFin(v); if (coords) setUbicacionFinCoords(coords); else setUbicacionFinCoords(null); }}
                      placeholder={
                        tipo === "VUELO" ? "Aeropuerto de llegada" : "Puerto de llegada"
                      }
                    />
                  </div>
                </>
              )}
            </div>

            {/* Transporte llegada */}
            {hayActividadEseDia && (
              <div className="space-y-[var(--space-2)]">
                <p className="text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">
                  ¿Cómo llegas?
                </p>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {TRANSPORT_LLEGADA.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTransporteLlegada(transporteLlegada === t.value ? null : t.value)}
                      className={`flex items-center gap-[6px] rounded-chip border px-[var(--space-3)] py-[6px] text-body-sm transition-colors ${
                        transporteLlegada === t.value
                          ? "border-primary-token bg-primary-token/10 text-primary-token"
                          : "border-app bg-surface-inset text-muted"
                      }`}
                    >
                      <span>{t.emoji}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <div>
                <p className="mb-[var(--space-2)] text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Fecha</p>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex h-input w-full items-center rounded-input border border-app bg-surface-inset px-[var(--space-3)] text-body"
                    >
                      {fecha
                        ? new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                        : "Seleccionar"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fecha ? new Date(fecha + "T00:00:00") : undefined}
                      onSelect={(d) => {
                        if (d) {
                          const y = d.getFullYear();
                          const m = String(d.getMonth() + 1).padStart(2, "0");
                          const day = String(d.getDate()).padStart(2, "0");
                          setFecha(`${y}-${m}-${day}`);
                        }
                        setCalendarOpen(false);
                      }}
                      disabled={(d) => {
                        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                        return iso < minDate || iso > maxDate;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

            </div>

            {/* Horas */}
            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <div>
                <p className="mb-[var(--space-2)] text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Hora inicio</p>
                <TimeWheelPicker
                  value={horaInicio}
                  onChange={setHoraInicio}
                  minTime={fecha === minDate && !planIsAllDay ? planStartTime : undefined}
                  maxTime={fecha === maxDate && !planIsAllDay ? planEndTime   : undefined}
                  blockedIntervals={occupiedIntervals}
                />
              </div>
              <div>
                <p className="mb-[var(--space-2)] text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Hora fin</p>
                <TimeWheelPicker
                  value={horaFin}
                  onChange={setHoraFin}
                  minTime={horaInicio}
                  maxTime={fecha === maxDate && !planIsAllDay ? planEndTime : undefined}
                  blockedIntervals={occupiedIntervals}
                />
              </div>
            </div>

            {error && <p className="text-body-sm text-[var(--error)]">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-app px-[var(--page-margin-x)] py-[var(--space-4)]">
            <button
              type="button"
              onClick={onClose}
              className="text-body-sm font-[var(--fw-medium)] text-[var(--error)] transition-opacity hover:opacity-70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-chip bg-primary-token px-[var(--space-6)] py-[var(--space-2)] text-body-sm font-[var(--fw-semibold)] text-contrast-token disabled:opacity-[var(--disabled-opacity)]"
            >
              {saving ? "Guardando..." : "Crear"}
            </button>
          </div>
        </form>
      </div>
      </div>
    </>
  );
}

/* ───────────── page ───────────── */

export default function PlanDetailPage() {
  const { loading } = useAuth();
  const router = useRouter();
  const { id: paramId } = useParams<{ id: string }>();
  // In Capacitor static export we navigate to /plans/static?id=18.
  // Read the real id from query params and store it in state so effects re-run.
  const [id, setId] = useState<string>(paramId);
  useEffect(() => {
    if (paramId === "static") {
      const queryId = new URLSearchParams(window.location.search).get("id");
      setId(queryId ?? paramId);
    } else {
      setId(paramId);
    }
  }, [paramId]);
  const [activeTab, setActiveTab] = useState<Tab>("itinerario");
  const [plan, setPlan] = useState<PlanByIdRow | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [subplanes, setSubplanes] = useState<SubplanRow[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingTransporteId, setEditingTransporteId] = useState<number | null>(null);

  const handleSubplanCreated = (s: SubplanRow) => {
    setSubplanes((prev) => [...prev, s].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at)));
  };

  const handleViajeComputed = (subplanId: number, duracion: string, distancia: string, polyline: string) => {
    setSubplanes((prev) => prev.map((s) =>
      s.id === subplanId ? { ...s, duracion_viaje: duracion, distancia_viaje: distancia, ruta_polyline: polyline } : s
    ));
    updateSubplanViaje(subplanId, duracion, distancia, polyline).catch(() => {});
  };

  const handleTransporteChange = async (subplanId: number, transporte: string | null) => {
    // Clear cached route so DayRouteMap recalculates with the new travel mode
    setSubplanes((prev) => prev.map((s) =>
      s.id === subplanId
        ? { ...s, transporte_llegada: transporte, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
        : s
    ));
    setEditingTransporteId(null);
    try { await updateSubplanTransporte(subplanId, transporte); }
    catch { setSubplanes((prev) => prev.map((s) => s.id === subplanId ? { ...s, transporte_llegada: null } : s)); }
  };

  useEffect(() => {
    if (id === "static") return; // still resolving real id from query params
    const planId = Number(id);
    if (!planId) { setPlanLoading(false); return; }
    setPlanLoading(true);
    fetchPlansByIds({ planIds: [planId] })
      .then((rows) => setPlan(rows[0] ?? null))
      .catch(console.error)
      .finally(() => setPlanLoading(false));
  }, [id]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId) return;
    fetchSubplanes(planId).then(setSubplanes).catch(console.error);
  }, [id]);

  if (loading || planLoading) return <PlanDetailSkeleton />;
  if (!plan) return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      Plan no encontrado.
    </div>
  );

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-0 md:pr-[var(--space-14)] md:pl-[102px]">

          {/* ─── Hero ─── */}
          <div className="relative w-full overflow-hidden md:ml-0 md:rounded-b-[20px]" style={{ height: "clamp(260px, 40vh, 380px)" }}>
            {plan.foto_portada ? (
              <img
                src={plan.foto_portada}
                alt={plan.titulo}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/60 to-primary/30" />
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] md:top-[var(--space-6)] flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <BackIcon className="size-[20px]" />
            </button>

            {/* Title & meta */}
            <div className="absolute bottom-0 left-0 right-0 px-[var(--page-margin-x)] pb-[var(--space-6)]">
              <h1 className="text-[clamp(24px,5vw,36px)] font-[var(--fw-bold)] leading-[1.1] tracking-[-0.02em] text-white">
                {plan.titulo}
              </h1>
              {plan.descripcion && (
                <p className="mt-[var(--space-1)] text-body-sm text-white/75 line-clamp-2">
                  {plan.descripcion}
                </p>
              )}
              <div className="mt-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-3)] text-white/85">
                <span className="flex items-center gap-[5px] text-body-sm">
                  <CalendarSmallIcon className="size-[14px]" />
                  {formatDateRange(plan.inicio_at, plan.fin_at)}
                </span>
                <span className="flex items-center gap-[5px] text-body-sm">
                  <MapPinIcon className="size-[14px]" />
                  {plan.ubicacion_nombre}
                </span>
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-[var(--space-6)] right-[var(--page-margin-x)] flex gap-[var(--space-2)]">
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <ShareIcon className="size-[18px]" />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <EditIcon className="size-[18px]" />
                </button>
              </div>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="border-b border-app px-[var(--page-margin-x)]">
            <div className="flex gap-[var(--space-8)]">
              {(["itinerario", "mapa", "gastos"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative py-[var(--space-4)] text-body-sm font-[var(--fw-medium)] capitalize transition-colors ${
                    activeTab === tab
                      ? "text-app"
                      : "text-muted hover:text-app"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary-token" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Content ─── */}
          <div className="px-[var(--page-margin-x)] pt-[var(--space-8)] pb-[var(--space-16)]">

            {activeTab === "itinerario" && (
              <div className="flex flex-col gap-[var(--space-8)] lg:flex-row lg:gap-[var(--space-12)]">

                {/* Left column — itinerary */}
                <div className="flex-1 min-w-0">
                  {subplanes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-[var(--space-16)] text-muted">
                      <CalendarSmallIcon className="size-[40px] mb-[var(--space-3)] opacity-30" />
                      <p className="text-body font-[var(--fw-medium)]">Sin actividades</p>
                      <p className="text-body-sm mt-[var(--space-1)]">Añade la primera actividad del plan</p>
                      <button
                        onClick={() => setShowAddSheet(true)}
                        className="mt-[var(--space-5)] flex items-center gap-[var(--space-2)] rounded-chip border border-primary-token px-[var(--space-4)] py-[var(--space-2)] text-body-sm font-[var(--fw-medium)] text-primary-token transition-colors hover:bg-primary-token/10"
                      >
                        <span className="text-lg leading-none">+</span> Añadir actividad
                      </button>
                    </div>
                  ) : (
                    <>
                      {groupByDay(subplanes).map(([dateKey, items]) => (
                        <div key={dateKey} className="mb-[var(--space-6)]">
                          {/* Day header */}
                          <div className="flex items-center justify-between mb-[var(--space-5)]">
                            <h2 className="text-body font-[var(--fw-semibold)] uppercase tracking-wider text-muted">
                              {fmtDayHeader(items[0].inicio_at)}
                            </h2>
                          </div>

                          {/* Timeline */}
                          <div className="relative">
                            {items.map((s, idx) => {
                              const isLast = idx === items.length - 1;
                              const nextTransporte = !isLast ? TRANSPORT_MAP[items[idx + 1]?.transporte_llegada ?? ""] : null;
                              return (
                                <div key={s.id}>
                                <div className="relative flex gap-[var(--space-4)] pb-[var(--space-7)]">
                                  {/* Timeline line */}
                                  {!isLast && (
                                    <div className="absolute left-[11px] top-[26px] bottom-0 w-[1.5px] bg-[var(--border)]" />
                                  )}
                                  {/* Dot */}
                                  <div className="relative z-10 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border-[2px] border-primary-token bg-app">
                                    <div className="h-[8px] w-[8px] rounded-full bg-primary-token" />
                                  </div>
                                  {/* Content */}
                                  <div className="flex-1 min-w-0 -mt-[2px]">
                                    {!s.all_day && (
                                      <span className="text-body-sm font-[var(--fw-semibold)] text-primary-token">
                                        {fmtTime(s.inicio_at)} – {fmtTime(s.fin_at)}
                                      </span>
                                    )}
                                    <h4 className="mt-[2px] text-body font-[var(--fw-semibold)]">{s.titulo}</h4>
                                    {s.descripcion && (
                                      <p className="mt-[1px] text-body-sm text-muted line-clamp-2">{s.descripcion}</p>
                                    )}
                                    {s.ubicacion_nombre && !s.ubicacion_fin_nombre && (
                                      <p className="mt-[2px] flex items-center gap-[4px] text-body-sm text-muted">
                                        <MapPinIcon className="size-[13px] shrink-0" />
                                        {s.ubicacion_nombre}
                                      </p>
                                    )}
                                    {s.ubicacion_nombre && s.ubicacion_fin_nombre && (
                                      <div className="mt-[2px] flex flex-col gap-[2px] text-body-sm text-muted">
                                        <p className="flex items-center gap-[4px]">
                                          <MapPinIcon className="size-[13px] shrink-0" />
                                          {s.ubicacion_nombre}
                                        </p>
                                        <div className="flex justify-center text-[11px] leading-none text-primary-token">↓</div>
                                        <p className="flex items-center gap-[4px]">
                                          <MapPinIcon className="size-[13px] shrink-0" />
                                          {s.ubicacion_fin_nombre}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {/* Transport connector between activities */}
                                {!isLast && (
                                  <div className="relative pl-[36px] pb-[var(--space-3)]">
                                    <div className="absolute left-[11px] top-0 bottom-0 w-[1.5px] bg-[var(--border)]" />
                                    {editingTransporteId === items[idx + 1].id ? (
                                      <div className="flex flex-wrap gap-[var(--space-2)]">
                                        {TRANSPORT_LLEGADA.map((t) => (
                                          <button
                                            key={t.value}
                                            onClick={() => handleTransporteChange(items[idx + 1].id, t.value)}
                                            className={`flex items-center gap-[6px] rounded-chip border px-[var(--space-2)] py-[4px] text-caption transition-colors ${
                                              items[idx + 1].transporte_llegada === t.value
                                                ? "border-primary-token bg-primary-token/10 text-primary-token"
                                                : "border-app bg-surface-inset text-muted"
                                            }`}
                                          >
                                            <span>{t.emoji}</span><span>{t.label}</span>
                                          </button>
                                        ))}
                                        <button onClick={() => setEditingTransporteId(null)} className="text-caption text-muted px-[var(--space-2)]">✕</button>
                                      </div>
                                    ) : nextTransporte ? (
                                      <div className="flex items-center gap-[var(--space-3)]">
                                        <button
                                          onClick={() => setEditingTransporteId(items[idx + 1].id)}
                                          className="flex items-center gap-[var(--space-2)] text-body-sm text-muted hover:text-primary-token transition-colors"
                                        >
                                          <span className="text-[13px]">{nextTransporte.emoji}</span>
                                          <span>{nextTransporte.label}</span>
                                          {items[idx + 1].duracion_viaje && (
                                            <>
                                              <span className="text-muted opacity-40">·</span>
                                              <span className="text-primary-token font-[var(--fw-medium)]">{items[idx + 1].duracion_viaje}</span>
                                              {items[idx + 1].distancia_viaje && (
                                                <span className="text-caption text-muted">{items[idx + 1].distancia_viaje}</span>
                                              )}
                                            </>
                                          )}
                                        </button>
                                        <a
                                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(s.ubicacion_fin_nombre ?? s.ubicacion_nombre ?? "")}&destination=${encodeURIComponent(items[idx + 1].ubicacion_nombre ?? "")}&travelmode=${nextTransporte.googleMode ?? "driving"}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-caption text-muted hover:text-primary-token transition-colors"
                                          title="Abrir en Google Maps"
                                        >
                                          🗺️
                                        </a>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setEditingTransporteId(items[idx + 1].id)}
                                        className="text-caption text-muted hover:text-primary-token transition-colors"
                                      >
                                        + ¿Cómo llegas?
                                      </button>
                                    )}
                                  </div>
                                )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {/* Add button */}
                      <button
                        onClick={() => setShowAddSheet(true)}
                        className="mt-[var(--space-2)] flex w-full items-center gap-[var(--space-3)] rounded-card border border-dashed border-app px-[var(--space-4)] py-[var(--space-3)] text-body-sm text-muted transition-colors hover:border-primary-token hover:text-primary-token"
                      >
                        <span className="text-lg leading-none">+</span> Añadir actividad
                      </button>
                    </>
                  )}
                </div>

                {/* Right column — route map + expenses */}
                <div className="lg:w-[340px] lg:shrink-0">

                  {/* Route map card */}
                  <div className="mb-[var(--space-8)]">
                    <h3 className="mb-[var(--space-3)] text-body font-[var(--fw-semibold)]">Ruta del Día</h3>
                    <DayRouteMap
                      subplanes={subplanes}
                      selectedDate={groupByDay(subplanes)[0]?.[0] ?? isoDateOnly(plan?.inicio_at ?? "")}
                      onViajeComputed={handleViajeComputed}
                    />
                  </div>

                  {/* Expenses summary */}
                  <div>
                    <div className="flex items-baseline justify-between mb-[2px]">
                      <h3 className="text-body font-[var(--fw-semibold)]">Resumen Gastos</h3>
                      <span className="text-[var(--font-h2)] font-[var(--fw-bold)] leading-[var(--lh-h2)]">
                        €{MOCK_EXPENSES.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-caption uppercase tracking-wider text-muted mb-[var(--space-5)]">
                      Estimación Total
                    </p>

                    <div className="flex flex-col gap-[var(--space-5)]">
                      {MOCK_EXPENSES.categories.map((cat) => {
                        const Icon = ACTIVITY_ICONS[cat.icon] || MapPinIcon;
                        return (
                          <div key={cat.name} className="flex items-center gap-[var(--space-3)]">
                            <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-card bg-[var(--surface-2)]">
                              <Icon className="size-[18px] text-muted" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm font-[var(--fw-medium)]">{cat.name}</p>
                              <p className="text-caption text-muted">{cat.detail}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-body-sm font-[var(--fw-semibold)]">€{cat.amount.toFixed(2)}</p>
                              <p className={`text-[10px] font-[var(--fw-semibold)] uppercase tracking-wider ${
                                cat.status === "PAID" ? "text-success-token" : "text-warning-token"
                              }`}>
                                {cat.status === "PAID" ? "Paid" : "Pending"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button className="mt-[var(--space-6)] w-full border-t border-app pt-[var(--space-4)] text-center text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted hover:text-app transition-colors">
                      View Detailed Finances
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "mapa" && (
              <div className="flex flex-col items-center justify-center py-[var(--space-24)] text-muted">
                <MapPinIcon className="size-[48px] mb-[var(--space-4)] opacity-30" />
                <p className="text-body font-[var(--fw-medium)]">Mapa del viaje</p>
                <p className="text-body-sm mt-[var(--space-1)]">Próximamente</p>
              </div>
            )}

            {activeTab === "gastos" && (
              <div className="mx-auto max-w-[500px]">
                <div className="flex items-baseline justify-between mb-[2px]">
                  <h3 className="text-[var(--font-h3)] font-[var(--fw-bold)]">Resumen Gastos</h3>
                  <span className="text-[var(--font-h2)] font-[var(--fw-bold)] leading-[var(--lh-h2)]">
                    €{MOCK_EXPENSES.total.toFixed(2)}
                  </span>
                </div>
                <p className="text-caption uppercase tracking-wider text-muted mb-[var(--space-6)]">
                  Estimación Total
                </p>

                <div className="flex flex-col gap-[var(--space-5)]">
                  {MOCK_EXPENSES.categories.map((cat) => {
                    const Icon = ACTIVITY_ICONS[cat.icon] || MapPinIcon;
                    return (
                      <div key={cat.name} className="flex items-center gap-[var(--space-3)]">
                        <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-card bg-[var(--surface-2)]">
                          <Icon className="size-[20px] text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-[var(--fw-medium)]">{cat.name}</p>
                          <p className="text-body-sm text-muted">{cat.detail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-body font-[var(--fw-semibold)]">€{cat.amount.toFixed(2)}</p>
                          <p className={`text-caption font-[var(--fw-semibold)] uppercase tracking-wider ${
                            cat.status === "PAID" ? "text-success-token" : "text-warning-token"
                          }`}>
                            {cat.status === "PAID" ? "Paid" : "Pending"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {showAddSheet && plan && (
        <AddSubplanSheet
          planId={plan.id}
          planStartDate={plan.inicio_at}
          planEndDate={plan.fin_at}
          subplanes={subplanes}
          onClose={() => setShowAddSheet(false)}
          onCreated={handleSubplanCreated}
        />
      )}
    </div>
  );
}
