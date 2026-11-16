"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BusFront, CarFront, CarTaxiFront, Check, CircleAlert, CircleEllipsis,
  FerrisWheel, Footprints, Hotel, LoaderCircle, MapPin, Plane, Search, Ship,
  TrainFront, TramFront, UtensilsCrossed, X,
} from "lucide-react";
import {
  createSubplan, updateSubplan, deleteSubplan,
  type SubplanRow, type TipoSubplan, TIPOS_TRANSPORTE,
} from "@/services/api/endpoints/subplanes.endpoint";
import { loadGoogleMapsScript } from "@/lib/googleMaps";
import LocationAutocomplete, { type Coords } from "@/components/plans/LocationAutocomplete";
import { isoDateOnly, timeToMin, getOccupiedIntervals } from "./plan-utils";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { TimePicker } from "@/components/ui/TimePicker";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";
import { Wizard, WizardSection, WizardSummary } from "@/components/ui/Wizard";
import { useToast } from "@/components/ui/Toaster";
import { itineraryDayId } from "@/components/plans/itinerary/Itinerary";

// ── Transport & activity constants ────────────────────────────────────────────

export const TRANSPORT_LLEGADA = [
  { value: "APIE",  Icon: Footprints,   label: "A pie",  googleMode: "walking"  },
  { value: "COCHE", Icon: CarFront,     label: "Coche",  googleMode: "driving"  },
  { value: "TAXI",  Icon: CarTaxiFront, label: "Taxi",   googleMode: "driving"  },
  { value: "BUS",   Icon: BusFront,     label: "Bus",    googleMode: "transit"  },
  { value: "METRO", Icon: TramFront,    label: "Metro",  googleMode: "transit"  },
  { value: "TREN",  Icon: TrainFront,   label: "Tren",   googleMode: "transit"  },
] as const satisfies ReadonlyArray<{
  value: string;
  Icon: LucideIcon;
  label: string;
  googleMode: "walking" | "driving" | "transit";
}>;

export const TRANSPORT_MAP = Object.fromEntries(TRANSPORT_LLEGADA.map((t) => [t.value, t]));

export const ACTIVITY_TYPE_OPTIONS = [
  { value: "ACTIVIDAD",   label: "Actividad",   Icon: FerrisWheel       },
  { value: "VUELO",       label: "Vuelo",       Icon: Plane             },
  { value: "BARCO",       label: "Barco",       Icon: Ship              },
  { value: "HOTEL",       label: "Hotel",       Icon: Hotel             },
  { value: "RESTAURANTE", label: "Restaurante", Icon: UtensilsCrossed   },
  { value: "OTRO",        label: "Otro",        Icon: CircleEllipsis    },
] as const satisfies ReadonlyArray<{ value: TipoSubplan; label: string; Icon: LucideIcon }>;

const STEPS = ["Qué y dónde", "Cuándo", "Detalles"] as const;
const DAY_MS = 86_400_000;

// ── helpers ───────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const minToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00`);
  x.setDate(x.getDate() + n);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / DAY_MS);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00`).toLocaleDateString("es-ES", o).replace(/[.,]/g, "");
/** «sáb 21 nov» */
const fechaCorta = (d: string) => fmt(d, { weekday: "short", day: "numeric", month: "short" });
/** «21 – 25 nov», «28 nov – 2 dic» */
function rango(a: string, b: string) {
  if (a === b) return fmt(a, { day: "numeric", month: "short" });
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return `${sameMonth ? fmt(a, { day: "numeric" }) : fmt(a, { day: "numeric", month: "short" })} – ${fmt(b, { day: "numeric", month: "short" })}`;
}
function duracionTxt(min: number) {
  if (min <= 0) return null;
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`;
}
/** «Time Out Market, Avenida 24 de Julho, Lisboa» → main + secondary. */
function splitPlace(text: string): { main: string; secondary: string } {
  const i = text.indexOf(",");
  return i < 0 ? { main: text.trim(), secondary: "" } : { main: text.slice(0, i).trim(), secondary: text.slice(i + 1).trim() };
}
/** The name we propose from the type and the place («Comida en Time Out Market»). */
function proponerNombre(tipo: TipoSubplan | null, lugar: string, destino: string) {
  if (tipo === "VUELO") return destino ? `Vuelo a ${destino}` : "";
  if (tipo === "BARCO") return destino ? `Barco a ${destino}` : "";
  if (!lugar) return "";
  if (tipo === "RESTAURANTE") return `Comida en ${lugar}`;
  return lugar;
}

// ── Place field: search, or the chosen place as a card ───────────────────────

function PlaceField({
  value, coords, onChange, placeholder, label,
}: {
  value: string; coords: Coords | null;
  onChange: (v: string, c: Coords | null) => void;
  placeholder: string; label: string;
}) {
  if (value && coords) {
    const { main, secondary } = splitPlace(value);
    return (
      <div className="wz-place">
        <span className="wz-place-ic"><MapPin className="size-[18px]" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="wz-ell text-[15px] font-semibold">{main}</div>
          {secondary && <div className="wz-tm wz-ell">{secondary}</div>}
        </div>
        <button type="button" className="wz-ib s" aria-label="Quitar el sitio" title="Quitar el sitio" onClick={() => onChange("", null)}>
          <X className="size-[18px]" aria-hidden />
        </button>
      </div>
    );
  }
  return (
    <div className="wz-fld wz-place-search">
      <Search className="size-[18px] shrink-0 text-[var(--text-secondary)]" aria-hidden />
      <LocationAutocomplete
        value={value}
        onChange={(v, c) => onChange(v, c ?? null)}
        dropdownVariant="surface"
        placeholder={placeholder}
        inputClassName="h-11 text-[15px]"
        className="min-w-0 flex-1"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ── Days of the plan: one row up to 7 days, a week grid beyond ───────────────

function DaysPicker({
  days, start, end, range, busyDays, onPick,
}: {
  days: string[]; start: string; end: string | null; range: boolean;
  busyDays: Set<string>; onPick: (d: string) => void;
}) {
  const selRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { selRef.current?.scrollIntoView({ block: "nearest" }); }, []);
  const realEnd = end ?? start;
  const cell = (d: string, compact: boolean) => {
    const on = d === start || d === realEnd;
    const mid = d > start && d < realEnd;
    const idx = days.indexOf(d) + 1;
    const dot = busyDays.has(d);
    const nice = fmt(d, { weekday: "long", day: "numeric", month: "long" });
    return (
      <button
        key={d} type="button" ref={d === start ? selRef : undefined}
        className={`wz-day ${on ? "on" : ""} ${mid ? "mid" : ""} ${dot ? "dot" : ""}`}
        aria-pressed={on || mid}
        aria-label={`${nice}, día ${idx}${dot ? ", con actividades" : ""}`}
        onClick={() => onPick(d)}
      >
        {compact ? (
          <><span className="n">{Number(d.slice(8))}</span><span className="d">D{idx}</span></>
        ) : (
          <><span className="w">{fmt(d, { weekday: "short" })} </span><span className="n">{Number(d.slice(8))}</span><span className="d">Día {idx}</span></>
        )}
      </button>
    );
  };

  if (days.length <= 7) {
    return (
      <div role="group" aria-label="Día del plan" className="wz-days" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 5) || 1}, 1fr)` }}>
        {days.map((d) => cell(d, false))}
        {range && <span className="sr-only">Toca el primer y el último día.</span>}
      </div>
    );
  }

  // Weeks Monday–Sunday, one block per month.
  const months: { key: string; label: string; cells: (string | null)[] }[] = [];
  for (const d of days) {
    const key = d.slice(0, 7);
    let m = months[months.length - 1];
    if (!m || m.key !== key) {
      m = { key, label: fmt(d, { month: "long", year: "numeric" }), cells: [] };
      const dow = (new Date(`${d}T12:00:00`).getDay() + 6) % 7;
      for (let i = 0; i < dow; i++) m.cells.push(null);
      months.push(m);
    }
    m.cells.push(d);
  }
  return (
    <div className="wz-cal" role="group" aria-label="Día del plan">
      <p className="wz-tm mb-1">D = día del viaje · punto = ya tiene actividades</p>
      {months.map((m) => (
        <div key={m.key} className="mb-3">
          <div className="wz-cal-m">{m.label}</div>
          <div className="wz-cal-g">
            {["L", "M", "X", "J", "V", "S", "D"].map((w) => <span key={w} className="wz-cal-h" aria-hidden>{w}</span>)}
            {m.cells.map((d, i) => d ? cell(d, true) : <span key={`p${i}`} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AddSubplanSheet ───────────────────────────────────────────────────────────

export type AddSheetProps = {
  planId: number;
  planStartDate: string;
  planEndDate: string;
  /** Shown in the header: «Nueva actividad · Escapada a Lisboa». */
  planTitle?: string;
  subplanes: SubplanRow[];
  onClose: () => void;
  onSaved: (saved: SubplanRow, original?: SubplanRow | null) => void;
  onDeleted?: (deleted: SubplanRow) => void;
  /** Active expenses linked to initialSubplan; when > 0 the delete dialog offers to void them. */
  gastosCount?: number;
  initialTitulo?: string;
  /** HH:MM, e.g. read from a chat message («Añadir al plan»). */
  initialHora?: string;
  /** From a chat message: the type @frimee read («RESTAURANTE»…). */
  initialTipo?: TipoSubplan;
  /**
   * From a chat message: the place. With coordinates (a shared place card) it is used as is; with
   * only a name it is looked up on Google Places (`buscar`, e.g. «Time Out Market, Lisboa»).
   */
  initialUbicacion?: { nombre: string; lat?: number; lng?: number; buscar?: string };
  initialDate?: string;
  initialSubplan?: SubplanRow | null;
};

export function AddSubplanSheet({
  planId, planStartDate, planEndDate, planTitle, subplanes,
  onClose, onSaved, onDeleted, gastosCount = 0, initialTitulo, initialHora, initialTipo, initialUbicacion, initialDate, initialSubplan,
}: AddSheetProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const { toast } = useToast();

  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const toLocalTime = (iso: string) => {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const minDate = toLocalDate(planStartDate);
  const maxDate = toLocalDate(planEndDate);
  const planStartTime = toLocalTime(planStartDate);
  const planEndTime   = toLocalTime(planEndDate);
  const planIsAllDay  = planStartTime === "00:00" && planEndTime === "23:59";
  const isEditing = Boolean(initialSubplan);

  const initialStartDate = initialSubplan ? toLocalDate(initialSubplan.inicio_at) : null;
  const initialEndDate   = initialSubplan ? toLocalDate(initialSubplan.fin_at) : null;
  const defaultDate =
    initialStartDate && initialStartDate >= minDate && initialStartDate <= maxDate ? initialStartDate :
    initialDate && initialDate >= minDate && initialDate <= maxDate ? initialDate :
    minDate;
  const horaFromMessage = !initialSubplan && initialHora && /^\d{2}:\d{2}$/.test(initialHora) ? initialHora : null;
  // Hours are optional: a new activity starts without them unless a chat message brought one.
  const defaultHoraInicio = initialSubplan ? (initialSubplan.all_day ? "" : toLocalTime(initialSubplan.inicio_at)) : horaFromMessage ?? "";
  const defaultHoraFin = initialSubplan ? (initialSubplan.all_day ? "" : toLocalTime(initialSubplan.fin_at))
    : horaFromMessage ? minToHHMM(Math.min(timeToMin(horaFromMessage) + 60, 23 * 60 + 59)) : "";

  const [titulo,             setTitulo]             = useState(initialSubplan?.titulo ?? initialTitulo ?? "");
  const [nombreTocado,       setNombreTocado]       = useState(Boolean(initialSubplan || initialTitulo));
  const [descripcion,        setDescripcion]        = useState(initialSubplan?.descripcion ?? "");
  const [fecha,              setFecha]              = useState(defaultDate);
  const [fechaFin,           setFechaFin]           = useState<string | null>(initialEndDate && initialEndDate !== defaultDate ? initialEndDate : null);
  const [variosDias,         setVariosDias]         = useState(Boolean(initialEndDate && initialEndDate !== defaultDate));
  const [esperandoFin,       setEsperandoFin]       = useState(false);
  const [horaInicio,         setHoraInicio]         = useState(defaultHoraInicio);
  const [horaFin,            setHoraFin]            = useState(defaultHoraFin);
  const [tipo,               setTipo]               = useState<TipoSubplan | null>(initialSubplan?.tipo ?? initialTipo ?? null);
  const [ubicacion,          setUbicacion]          = useState(initialSubplan?.ubicacion_nombre ?? initialUbicacion?.nombre ?? "");
  const [ubicacionCoords,    setUbicacionCoords]    = useState<Coords | null>(
    initialSubplan?.ubicacion_lat != null && initialSubplan?.ubicacion_lng != null
      ? { lat: initialSubplan.ubicacion_lat, lng: initialSubplan.ubicacion_lng }
      : !initialSubplan && initialUbicacion?.lat != null && initialUbicacion?.lng != null
        ? { lat: initialUbicacion.lat, lng: initialUbicacion.lng } : null,
  );
  const [ubicacionFin,       setUbicacionFin]       = useState(initialSubplan?.ubicacion_fin_nombre ?? "");
  const [ubicacionFinCoords, setUbicacionFinCoords] = useState<Coords | null>(
    initialSubplan?.ubicacion_fin_lat != null && initialSubplan?.ubicacion_fin_lng != null
      ? { lat: initialSubplan.ubicacion_fin_lat, lng: initialSubplan.ubicacion_fin_lng } : null,
  );
  const [transporteLlegada,  setTransporteLlegada]  = useState<string | null>(initialSubplan?.transporte_llegada ?? null);
  const [saving,             setSaving]             = useState(false);
  const [saveError,          setSaveError]          = useState<string | null>(null);
  const [discardOpen,        setDiscardOpen]        = useState(false);
  const [deleteOpen,         setDeleteOpen]         = useState(false);
  const [deleteGastos,       setDeleteGastos]       = useState(false);
  const [step,               setStep]               = useState(1);
  const [error,              setError]              = useState<string | null>(null);

  // A place read from a chat message has only a name: find it on Google Places (biased to the trip's
  // destination) and fill the first result in. It stays editable; if nothing is found, the name stays.
  useEffect(() => {
    if (initialSubplan || !initialUbicacion?.nombre || initialUbicacion.lat != null) return;
    let cancelled = false;
    void (async () => {
      try {
        await loadGoogleMapsScript();
        const { suggestions } = await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: initialUbicacion.buscar ?? initialUbicacion.nombre,
        });
        const first = suggestions?.[0]?.placePrediction;
        if (!first || cancelled) return;
        const place = first.toPlace();
        await place.fetchFields({ fields: ["location"] });
        if (cancelled || !place.location) return;
        setUbicacion(first.text.toString());
        setUbicacionCoords({ lat: place.location.lat(), lng: place.location.lng() });
      } catch {
        // Maps not available: the name read from the message stays, to pick the place by hand.
      }
    })();
    return () => { cancelled = true; };
    // Only once, when the sheet opens with a place from a message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const esTransporte = tipo != null && TIPOS_TRANSPORTE.includes(tipo);
  const tipoMeta = ACTIVITY_TYPE_OPTIONS.find((t) => t.value === tipo);

  // The proposed name follows the type and the place until the person types their own.
  const lugarMain = splitPlace(ubicacion).main;
  const destinoMain = splitPlace(ubicacionFin).main;
  const propuesto = proponerNombre(tipo, lugarMain, destinoMain);
  useEffect(() => {
    if (!nombreTocado) setTitulo(propuesto);
  }, [propuesto, nombreTocado]);

  const planDays = useMemo(() => {
    const out: string[] = [];
    for (let d = minDate; d <= maxDate && out.length < 400; d = addDays(d, 1)) out.push(d);
    return out;
  }, [minDate, maxDate]);
  const busyDays = useMemo(
    () => new Set(subplanes.filter((s) => s.id !== initialSubplan?.id).map((s) => isoDateOnly(s.inicio_at))),
    [subplanes, initialSubplan?.id],
  );

  const hayActividadEseDia = busyDays.has(fecha);
  const efectivaFechaFin = fechaFin ?? fecha;
  const sinHora = !horaInicio && !horaFin;
  const horasIncompletas = !sinHora && (!horaInicio || !horaFin);

  const clampedHoraInicio = (() => {
    if (planIsAllDay || !horaInicio) return horaInicio;
    if (fecha === minDate && horaInicio < planStartTime) return planStartTime;
    if (fecha === maxDate && horaInicio > planEndTime)   return planEndTime;
    return horaInicio;
  })();
  const clampedHoraFin = (() => {
    if (planIsAllDay || !horaFin) return horaFin;
    if (efectivaFechaFin === maxDate && horaFin > planEndTime) return planEndTime;
    return horaFin;
  })();

  const diaSiguiente = addDays(fecha, 1) <= maxDate ? addDays(fecha, 1) : null;
  const finAntesQueInicio = !sinHora && !horasIncompletas && efectivaFechaFin === fecha && timeToMin(horaFin) <= timeToMin(horaInicio);
  const duracionMin = sinHora || horasIncompletas ? 0 : daysBetween(fecha, efectivaFechaFin) * 1440 + timeToMin(horaFin) - timeToMin(horaInicio);
  const duracion = duracionTxt(duracionMin);
  const horaSubtitle = [cap(fechaCorta(fecha)), titulo.trim() || lugarMain].filter(Boolean).join(" · ");

  // Moving the start keeps the duration on the same day (an hour by default).
  const cambiarInicio = (v: string) => {
    const dur = horaInicio && horaFin && efectivaFechaFin === fecha && timeToMin(horaFin) > timeToMin(horaInicio)
      ? timeToMin(horaFin) - timeToMin(horaInicio) : 60;
    setHoraInicio(v);
    if (efectivaFechaFin === fecha || !horaFin) setHoraFin(minToHHMM(Math.min(timeToMin(v) + dur, 23 * 60 + 59)));
  };

  const pickDay = (d: string) => {
    setError(null);
    if (!variosDias) { setFecha(d); setFechaFin(null); return; }
    if (!esperandoFin || d < fecha) { setFecha(d); setFechaFin(null); setEsperandoFin(true); return; }
    setFechaFin(d === fecha ? null : d);
    setEsperandoFin(false);
  };

  const occupiedIntervals = getOccupiedIntervals(subplanes.filter((s) => s.id !== initialSubplan?.id), fecha);
  const canStep1 = tipo != null && titulo.trim().length > 0;
  const canStep2 = !finAntesQueInicio && !horasIncompletas;

  const handleSubmit = async () => {
    if (saving || !tipo || !canStep1 || !canStep2) return;
    if (fecha < minDate || fecha > maxDate || efectivaFechaFin > maxDate) { setError("La actividad tiene que estar dentro de las fechas del plan."); setStep(2); return; }
    if (!sinHora && occupiedIntervals.length > 0 && efectivaFechaFin === fecha) {
      const newFrom = timeToMin(clampedHoraInicio);
      const newTo   = timeToMin(clampedHoraFin);
      if (occupiedIntervals.some((b) => newFrom < b.to && newTo > b.from)) {
        setError("Este horario se solapa con una actividad existente o su tiempo de viaje.");
        setStep(2);
        return;
      }
    }

    setSaving(true);
    setSaveError(null);
    try {
      const inicioAt = `${fecha}T${sinHora ? "00:00" : clampedHoraInicio}:00`;
      const finAt    = `${efectivaFechaFin}T${sinHora ? "23:59" : clampedHoraFin}:00`;
      const normalized = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        inicio_at: new Date(inicioAt).toISOString(),
        fin_at: new Date(finAt).toISOString(),
        all_day: sinHora,
        tipo,
        ubicacion_nombre: ubicacion.trim(),
        ubicacion_fin_nombre: esTransporte ? ubicacionFin.trim() : null,
        ubicacion_lat: ubicacionCoords?.lat ?? null,
        ubicacion_lng: ubicacionCoords?.lng ?? null,
        ubicacion_fin_lat: esTransporte ? (ubicacionFinCoords?.lat ?? null) : null,
        ubicacion_fin_lng: esTransporte ? (ubicacionFinCoords?.lng ?? null) : null,
        transporte_llegada: hayActividadEseDia ? transporteLlegada : null,
      };
      const apiInput = {
        titulo: normalized.titulo,
        descripcion: normalized.descripcion,
        inicioAt: normalized.inicio_at,
        finAt: normalized.fin_at,
        allDay: normalized.all_day,
        tipo,
        ubicacionNombre: normalized.ubicacion_nombre,
        ubicacionFinNombre: normalized.ubicacion_fin_nombre,
        ubicacionLat: normalized.ubicacion_lat,
        ubicacionLng: normalized.ubicacion_lng,
        ubicacionFinLat: normalized.ubicacion_fin_lat,
        ubicacionFinLng: normalized.ubicacion_fin_lng,
        transporteLlegada: normalized.transporte_llegada,
      };

      let saved: SubplanRow;
      if (initialSubplan) {
        await updateSubplan({ subplanId: initialSubplan.id, ...apiInput });
        saved = { ...initialSubplan, ...normalized, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null };
      } else {
        const newId = await createSubplan({ planId, ...apiInput });
        saved = {
          id: newId, plan_id: planId, parent_subplan_id: null,
          ...normalized,
          ubicacion_direccion: null, ubicacion_fin_direccion: null,
          duracion_viaje: null, distancia_viaje: null, ruta_polyline: null,
          orden: 0, estado: "ACTIVO",
          creado_por_user_id: "", created_at: new Date().toISOString(),
        };
      }
      onSaved(saved, initialSubplan ?? undefined);
      const dayKey = fecha;
      toast(
        isEditing ? "Actividad guardada" : `Actividad creada el ${fechaCorta(fecha)}`,
        "success",
        { label: "Ver", onClick: () => document.getElementById(itineraryDayId(dayKey))?.scrollIntoView({ behavior: "smooth", block: "start" }) },
      );
      requestClose();
    } catch {
      setSaveError(`No se pudo ${isEditing ? "guardar" : "crear"} la actividad. Comprueba la conexión y vuelve a intentarlo. Lo que has escrito sigue aquí.`);
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialSubplan) return;
    setDeleteOpen(false);
    setSaving(true);
    try {
      await deleteSubplan(initialSubplan.id, gastosCount > 0 && deleteGastos);
      onDeleted?.(initialSubplan);
      toast("Actividad eliminada", "success");
      requestClose();
    } catch {
      setSaveError("No se pudo eliminar la actividad. Comprueba la conexión y vuelve a intentarlo.");
      setSaving(false);
    }
  };

  const snapshot = (v: object) => JSON.stringify(v);
  const initialSnapshot = useMemo(() => snapshot({
    titulo: initialSubplan?.titulo ?? initialTitulo ?? "", descripcion: initialSubplan?.descripcion ?? "",
    fecha: defaultDate, horaInicio: defaultHoraInicio, horaFin: defaultHoraFin,
    tipo: initialSubplan?.tipo ?? initialTipo ?? null, ubicacion: initialSubplan?.ubicacion_nombre ?? initialUbicacion?.nombre ?? "",
    transporteLlegada: initialSubplan?.transporte_llegada ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);
  const hasProgress = step > 1 || snapshot({
    titulo: nombreTocado ? titulo : initialSubplan?.titulo ?? initialTitulo ?? "", descripcion, fecha, horaInicio, horaFin, tipo,
    ubicacion: initialUbicacion && !initialSubplan ? initialUbicacion.nombre : ubicacion, transporteLlegada,
  }) !== initialSnapshot;

  function requestDismiss() {
    if (saving || discardOpen || deleteOpen) return;
    if (hasProgress) { setDiscardOpen(true); return; }
    requestClose();
  }

  const advance = () => {
    if (saving) return;
    if (step === 1 && canStep1) setStep(2);
    else if (step === 2 && canStep2) setStep(3);
    else if (step === 3) void handleSubmit();
  };

  // Enter in a field = main action (not in the description, nor while picking a place).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t.tagName !== "INPUT" || t.closest(".wz-place-search")) return;
    e.preventDefault();
    advance();
  };

  // Radio group with arrows (types).
  const tipoKeys = (e: React.KeyboardEvent, i: number) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const n = ACTIVITY_TYPE_OPTIONS.length;
    const next = ACTIVITY_TYPE_OPTIONS[(i + delta + n) % n];
    setTipo(next.value);
    (e.currentTarget.parentElement?.children[(i + delta + n) % n] as HTMLElement | undefined)?.focus();
  };

  const fechaLarga = cap(fmt(fecha, { weekday: "short", day: "numeric", month: "short" }));
  const horasTxt = sinHora || horasIncompletas ? null : `${clampedHoraInicio} – ${clampedHoraFin}`;
  const summary = [
    { key: "t", label: <>{tipoMeta && <tipoMeta.Icon className="size-[13px]" aria-hidden />}{tipoMeta?.label}</> },
    ...(lugarMain ? [{ key: "l", label: <><MapPin className="size-[13px]" aria-hidden />{lugarMain}</> }] : []),
    ...(step >= 3 ? [
      { key: "f", label: fechaFin ? cap(rango(fecha, fechaFin)) : fechaLarga },
      { key: "h", label: horasTxt ?? "Sin hora", missing: !horasTxt },
    ] : []),
  ];
  const transporte = transporteLlegada ? TRANSPORT_MAP[transporteLlegada] : null;

  const footer = (() => {
    if (step === 1) {
      return (
        <>
          {isEditing && onDeleted ? (
            <button type="button" className="wz-tbtn" style={{ color: "var(--error)" }} disabled={saving} onClick={() => { setDeleteGastos(false); setDeleteOpen(true); }}>
              Eliminar actividad
            </button>
          ) : (
            <button type="button" className="wz-tbtn mute" onClick={requestDismiss}>Cancelar</button>
          )}
          <button type="button" className="wz-fbtn" disabled={!canStep1} onClick={advance}>Continuar</button>
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <button type="button" className="wz-tbtn" disabled={!canStep2 || saving} onClick={() => void handleSubmit()}>
            {isEditing ? "Guardar ya" : "Crear ya, sin detalles"}
          </button>
          <button type="button" className="wz-fbtn" disabled={!canStep2} onClick={advance}>Siguiente</button>
        </>
      );
    }
    return (
      <>
        <button type="button" className="wz-tbtn mute" disabled={saving} onClick={() => setStep(2)}>Atrás</button>
        <button type="button" className="wz-fbtn" disabled={saving} onClick={() => void handleSubmit()}>
          {saving ? <><LoaderCircle className="wz-spin size-[18px]" aria-hidden />{isEditing ? "Guardando…" : "Creando…"}</>
            : saveError ? "Reintentar" : isEditing ? "Guardar cambios" : "Crear actividad"}
        </button>
      </>
    );
  })();

  return (
    <>
      <Wizard
        label={isEditing ? "Editar actividad" : "Nueva actividad"}
        headTitle={[isEditing ? "Editar actividad" : "Nueva actividad", planTitle].filter(Boolean).join(" · ")}
        steps={STEPS}
        step={step}
        onStep={setStep}
        onBack={() => setStep((s) => Math.max(1, s - 1))}
        onDismiss={requestDismiss}
        isClosing={isClosing}
        busy={saving}
        footer={footer}
      >
        <fieldset disabled={saving} className="contents" onKeyDown={onKeyDown}>
          {saveError && (
            <div role="alert" className="wz-ban">
              <CircleAlert className="mt-[1px] size-[18px] shrink-0" aria-hidden />
              <span>{saveError}</span>
            </div>
          )}

          {step === 1 && (
            <>
              <h2 className="wz-title" tabIndex={-1}>¿Qué hacéis?</h2>
              <WizardSection title="Tipo" id="wz-tipo" />
              <div role="radiogroup" aria-labelledby="wz-tipo" className="wz-tiles">
                {ACTIVITY_TYPE_OPTIONS.map((t, i) => {
                  const on = tipo === t.value;
                  return (
                    <button
                      key={t.value} type="button" role="radio" aria-checked={on}
                      tabIndex={on || (tipo == null && i === 0) ? 0 : -1}
                      data-autofocus={i === 0 ? "" : undefined}
                      className="wz-tile" onClick={() => setTipo(t.value)} onKeyDown={(e) => tipoKeys(e, i)}
                    >
                      <span className="ti"><t.Icon className="size-[22px]" aria-hidden /></span>
                      {t.label}
                      {on && <span className="wz-tick" aria-hidden><Check className="size-[13px]" /></span>}
                    </button>
                  );
                })}
              </div>

              <WizardSection title={esTransporte ? "Origen" : "Dónde"} optional />
              <PlaceField
                value={ubicacion} coords={ubicacionCoords}
                onChange={(v, c) => { setUbicacion(v); setUbicacionCoords(c); }}
                label={esTransporte ? "Origen" : "Buscar sitio o dirección"}
                placeholder={
                  tipo === "VUELO" ? "Aeropuerto de salida" :
                  tipo === "BARCO" ? "Puerto de salida" :
                  "Busca un sitio o una dirección"
                }
              />
              {esTransporte && (
                <>
                  <WizardSection title="Destino" optional />
                  <PlaceField
                    value={ubicacionFin} coords={ubicacionFinCoords}
                    onChange={(v, c) => { setUbicacionFin(v); setUbicacionFinCoords(c); }}
                    label="Destino"
                    placeholder={tipo === "VUELO" ? "Aeropuerto de llegada" : "Puerto de llegada"}
                  />
                </>
              )}

              <WizardSection title="Nombre" />
              <div className="wz-fld">
                <input
                  aria-label="Nombre de la actividad"
                  value={titulo}
                  onChange={(e) => { setTitulo(e.target.value); setNombreTocado(true); }}
                  placeholder="Ej.: Cena en Alfama"
                  style={{ fontWeight: titulo ? 600 : 400 }}
                />
              </div>
              {!nombreTocado && titulo && <p className="wz-tm mt-[6px]">Lo proponemos con el tipo y el sitio. Cámbialo si quieres.</p>}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="wz-title" tabIndex={-1}>¿Cuándo?</h2>
              <WizardSummary items={summary} />
              <WizardSection
                title="Día"
                optional={rango(minDate, maxDate) + (planDays.length > 7 ? ` · ${planDays.length} días` : "")}
                extra={planDays.length > 1 ? (
                  <button
                    type="button" role="switch" aria-checked={variosDias} className="wz-sw"
                    onClick={() => { setVariosDias((v) => !v); setFechaFin(null); setEsperandoFin(!variosDias); }}
                  >
                    Varios días <i aria-hidden />
                  </button>
                ) : undefined}
              />
              <DaysPicker days={planDays} start={fecha} end={fechaFin} range={variosDias} busyDays={busyDays} onPick={pickDay} />
              {variosDias && !fechaFin && <p className="wz-tm mt-2">Toca el primer y el último día.</p>}

              <WizardSection
                title="Horario" optional
                extra={!sinHora ? <button type="button" className="wz-link" onClick={() => { setHoraInicio(""); setHoraFin(""); setError(null); }}>Borrar horas</button> : undefined}
              />
              <div>
                <div className="flex min-h-[44px] items-center gap-3 border-t border-[var(--border)]">
                  <span className="wz-tm w-[72px] flex-none">Inicio</span>
                  <div className="min-w-0 flex-1">
                    <TimePicker
                      variant="row" label="Hora de inicio" subtitle={horaSubtitle} placeholder="Sin hora"
                      value={horaInicio} onChange={cambiarInicio}
                      minTime={fecha === minDate && !planIsAllDay ? planStartTime : undefined}
                      maxTime={fecha === maxDate && !planIsAllDay ? planEndTime : undefined}
                    />
                  </div>
                </div>
                <div className="flex min-h-[44px] items-center gap-3 border-y border-[var(--border)]">
                  <span className="wz-tm w-[72px] flex-none">Fin</span>
                  <div className="min-w-0 flex-1">
                    <TimePicker
                      variant="row" label="Hora de fin" subtitle={horaSubtitle} placeholder="Sin hora"
                      value={horaFin} invalid={finAntesQueInicio}
                      onChange={(v, o) => { setHoraFin(v); if (o?.nextDay && diaSiguiente) { setFechaFin(diaSiguiente); setVariosDias(true); } }}
                      nextDayBefore={efectivaFechaFin === fecha && diaSiguiente && horaInicio ? horaInicio : undefined}
                      maxTime={efectivaFechaFin === maxDate && !planIsAllDay ? planEndTime : undefined}
                    />
                  </div>
                </div>
              </div>
              {finAntesQueInicio ? (
                <div role="alert" className="wz-aviso">
                  <CircleAlert aria-hidden className="mt-[1px] size-[16px] shrink-0" />
                  <div>
                    La hora de fin es anterior a la de inicio.
                    {diaSiguiente && (
                      <div className="mt-[2px]">
                        <button type="button" className="wz-link" onClick={() => { setFechaFin(diaSiguiente); setVariosDias(true); }}>
                          Termina el {fechaCorta(diaSiguiente)}
                        </button>
                        <span className="text-[12px] text-[var(--text-secondary)]"> o cambia la hora de fin</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : sinHora ? (
                <p className="wz-tm mt-2">Sin hora, la actividad aparece arriba del día como «Sin hora».</p>
              ) : horasIncompletas ? (
                <p className="wz-tm mt-2">Falta la hora de {horaInicio ? "fin" : "inicio"}.</p>
              ) : duracion && (
                <p className="wz-tm mt-2">{fechaFin ? `Termina el ${fechaCorta(fechaFin)} · dura ${duracion}` : `Dura ${duracion}`}</p>
              )}
              {error && <p role="alert" className="wz-aviso">{error}</p>}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="wz-title" tabIndex={-1}>Últimos detalles</h2>
              <WizardSummary items={summary} />
              <WizardSection title="Descripción" optional />
              <div className="wz-fld">
                <textarea
                  aria-label="Descripción breve" rows={2}
                  value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej.: reservar mesa"
                />
              </div>
              {hayActividadEseDia && (
                <>
                  <WizardSection title="¿Cómo llegáis?" optional="opcional · toca otra vez para quitarlo" id="wz-llegada" />
                  <div role="radiogroup" aria-labelledby="wz-llegada" className="wz-chips">
                    {TRANSPORT_LLEGADA.map((t) => (
                      <button
                        key={t.value} type="button" role="radio" aria-checked={transporteLlegada === t.value} className="wz-chip"
                        onClick={() => setTransporteLlegada(transporteLlegada === t.value ? null : t.value)}
                      >
                        <span className="ti"><t.Icon className="size-[18px]" aria-hidden /></span>{t.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <WizardSection title="Así queda en el itinerario" />
              <div className="wz-prev">
                <div className="wz-tm mb-2">{fechaFin ? cap(rango(fecha, fechaFin)) : fechaLarga} · Día {planDays.indexOf(fecha) + 1}</div>
                <div className="flex gap-3">
                  <div className="wz-num-t w-[48px] flex-none text-right text-[12px] leading-[1.2] text-[var(--text-secondary)]">
                    {horasTxt ? <>{clampedHoraInicio}<br />{clampedHoraFin}</> : "Sin hora"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="wz-ell text-[15px] font-semibold">{titulo.trim()}</div>
                    {lugarMain && <div className="wz-tm wz-ell">{[lugarMain, splitPlace(ubicacion).secondary.split(",")[0]].filter(Boolean).join(" · ")}</div>}
                    {transporte && hayActividadEseDia && (
                      <div className="wz-tm mt-1 flex items-center gap-1"><transporte.Icon className="size-[13px]" aria-hidden />{transporte.label}</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </fieldset>
      </Wizard>

      <DiscardChangesDialog
        open={discardOpen}
        title={isEditing ? "¿Descartar los cambios?" : "¿Descartar la actividad?"}
        message="Se perderá lo que has rellenado."
        cancelLabel="Seguir editando"
        onCancel={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); requestClose(); }}
      />
      <DiscardChangesDialog
        open={deleteOpen}
        title="Eliminar actividad"
        message={`Se quitará "${initialSubplan?.titulo ?? ""}" del plan para todos los participantes.`}
        confirmLabel="Eliminar"
        onCancel={() => setDeleteOpen(false)}
        onDiscard={() => void handleDelete()}
      >
        {gastosCount > 0 && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 text-[14px] leading-snug text-app">
            <input
              type="checkbox"
              checked={deleteGastos}
              onChange={(e) => setDeleteGastos(e.target.checked)}
              className="mt-[2px] size-4 shrink-0 accent-[var(--error,#dc2626)]"
            />
            <span>
              Eliminar también {gastosCount === 1 ? "su gasto" : `sus ${gastosCount} gastos`}
              <span className="block text-[13px] text-muted">
                {deleteGastos
                  ? "Se anularán y se recalcularán las deudas del plan."
                  : "Si no lo marcas, se mantienen como gastos generales del plan."}
              </span>
            </span>
          </label>
        )}
      </DiscardChangesDialog>
    </>
  );
}
