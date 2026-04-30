"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BusFront, CarFront, CarTaxiFront, ChevronLeft, CircleEllipsis,
  FerrisWheel, Footprints, Hotel, MapPin, Plane, Ship,
  TrainFront, TramFront, UtensilsCrossed,
} from "lucide-react";
import {
  createSubplan, updateSubplan,
  type SubplanRow, type TipoSubplan, TIPOS_TRANSPORTE,
} from "@/services/api/endpoints/subplanes.endpoint";
import LocationAutocomplete, { type Coords } from "@/components/plans/LocationAutocomplete";
import { FIELD_LINE_CLS } from "@/lib/styles";
import { isoDateOnly, timeToMin, getOccupiedIntervals } from "./plan-utils";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseX } from "@/components/ui/CloseX";
import { ModalFeedback, type ModalFeedbackState } from "@/components/ui/ModalFeedback";

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

// ── PlanInlineCalendar ────────────────────────────────────────────────────────

function PlanInlineCalendar({
  minDate, maxDate, startDate, endDate, onChange,
}: {
  minDate: string; maxDate: string;
  startDate: string; endDate: string | null;
  onChange: (start: string, end: string | null) => void;
}) {
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const parseYMD = (s: string) => new Date(s + "T12:00:00");

  const handleDayClick = (dateStr: string) => {
    if (dateStr < minDate || dateStr > maxDate) return;
    if (phase === "start") {
      onChange(dateStr, null);
      setPhase("end");
    } else {
      if (dateStr === startDate) { onChange(startDate, null); setPhase("start"); }
      else if (dateStr > startDate) { onChange(startDate, dateStr); setPhase("start"); }
      else { onChange(dateStr, null); setPhase("end"); }
    }
  };

  const hasRange = !!endDate && endDate !== startDate;
  const previewEnd = phase === "end" && hoverDate && hoverDate > startDate ? hoverDate : null;

  const renderMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7;
    const monthLabel = firstDay.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

    const cells: React.ReactNode[] = Array.from({ length: startDow }, (_, i) => <div key={`pad-${i}`} />);

    for (let i = 0; i < daysInMonth; i++) {
      const day = i + 1;
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const isOutside = dateStr < minDate || dateStr > maxDate;
      const isStart = dateStr === startDate;
      const isEnd = hasRange && dateStr === endDate;
      const inRange = hasRange && dateStr > startDate && dateStr < endDate;
      const inPreview = !!previewEnd && dateStr > startDate && dateStr < previewEnd && !hasRange;
      const isPreviewEnd = dateStr === previewEnd && !hasRange;

      cells.push(
        <div
          key={dateStr}
          className="relative flex h-12 items-center justify-center"
          onClick={() => !isOutside && handleDayClick(dateStr)}
          onMouseEnter={() => !isOutside && setHoverDate(dateStr)}
          onMouseLeave={() => setHoverDate(null)}
        >
          {inRange && <div className="absolute inset-y-[4px] inset-x-0 bg-[var(--surface-2)]" />}
          {!inRange && inPreview && <div className="absolute inset-y-[4px] inset-x-0 bg-[var(--surface-2)] opacity-50" />}
          {isStart && (hasRange || !!previewEnd) && (
            <div className={`absolute inset-y-[4px] left-1/2 right-0 bg-[var(--surface-2)] ${!hasRange ? "opacity-50" : ""}`} />
          )}
          {(isEnd || isPreviewEnd) && (
            <div className={`absolute inset-y-[4px] left-0 right-1/2 bg-[var(--surface-2)] ${isPreviewEnd ? "opacity-50" : ""}`} />
          )}
          <div className={[
            "relative z-10 flex size-10 items-center justify-center rounded-full text-[15px] font-[var(--fw-semibold)] select-none transition-colors",
            isStart || isEnd ? "bg-[var(--text-primary)] text-[var(--bg)]" :
            isPreviewEnd ? "bg-[var(--surface-2)] text-app" :
            isOutside ? "cursor-default text-muted opacity-20" :
            "cursor-pointer text-app hover:bg-[var(--surface-2)]",
          ].join(" ")}>
            {day}
          </div>
        </div>,
      );
    }

    while (cells.length < 42) cells.push(<div key={`tail-${cells.length}`} />);

    return (
      <div key={`${year}-${month}`}>
        <p className="mb-[var(--space-4)] text-center text-[15px] font-[var(--fw-bold)] capitalize text-app">{monthLabel}</p>
        <div className="mb-[var(--space-1)] grid grid-cols-7 text-center">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
            <span key={d} className="py-1 text-[14px] font-[var(--fw-semibold)] text-muted">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">{cells}</div>
      </div>
    );
  };

  const startMonthDate = parseYMD(minDate);
  const endMonthDate = parseYMD(maxDate);
  const allMonths: { year: number; month: number }[] = [];
  const cur = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth(), 1);
  const last = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth(), 1);
  while (cur <= last) {
    allMonths.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }

  const totalMonths = allMonths.length;

  return (
    <div>
      <div className="space-y-[var(--space-8)] md:hidden">
        {allMonths.map(({ year, month }) => renderMonth(year, month))}
      </div>
      <div className="hidden md:block">
        {totalMonths === 1 ? (
          <div className="mx-auto max-w-[320px]">
            {allMonths.map(({ year, month }) => renderMonth(year, month))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-[var(--space-8)]">
            {allMonths.map(({ year, month }) => renderMonth(year, month))}
          </div>
        )}
      </div>
      <p className="mt-[var(--space-3)] text-center text-caption text-muted">
        {!endDate || endDate === startDate
          ? parseYMD(startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
          : `${parseYMD(startDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })} → ${parseYMD(endDate).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
        }
        {phase === "end" && (!endDate || endDate === startDate) && (
          <span className="ml-1 opacity-60">— elige fecha de fin o continúa</span>
        )}
      </p>
    </div>
  );
}

// ── TimeWheelInput ────────────────────────────────────────────────────────────

function TimeWheelInput({ value, onChange, minTime, maxTime }: {
  value: string;
  onChange: (v: string) => void;
  minTime?: string;
  maxTime?: string;
}) {
  const [hStr, mStr] = value.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  const touchHRef = useRef<{ startY: number; start: number } | null>(null);
  const touchMRef = useRef<{ startY: number; start: number } | null>(null);

  const emit = (hh: number, mm: number) => {
    let total = Math.max(0, Math.min(23 * 60 + 59, hh * 60 + mm));
    if (minTime) { const [a, b] = minTime.split(":").map(Number); total = Math.max((a ?? 0) * 60 + (b ?? 0), total); }
    if (maxTime) { const [a, b] = maxTime.split(":").map(Number); total = Math.min((a ?? 0) * 60 + (b ?? 0), total); }
    onChange(`${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`);
  };

  const inputCls = "w-[46px] bg-transparent text-[28px] font-[var(--fw-bold)] text-app outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden";

  return (
    <div className="flex items-baseline">
      <input
        type="number" min={0} max={23}
        value={String(h).padStart(2, "0")}
        onChange={(e) => emit(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)), m)}
        onWheel={(e) => { e.preventDefault(); emit(h + (e.deltaY > 0 ? -1 : 1), m); }}
        onTouchStart={(e) => { touchHRef.current = { startY: e.touches[0].clientY, start: h }; }}
        onTouchMove={(e) => {
          if (!touchHRef.current) return;
          e.preventDefault();
          const delta = Math.round((touchHRef.current.startY - e.touches[0].clientY) / 20);
          emit(touchHRef.current.start + delta, m);
        }}
        onTouchEnd={() => { touchHRef.current = null; }}
        className={inputCls}
      />
      <span className="select-none text-[28px] font-[var(--fw-bold)] text-app">:</span>
      <input
        type="number" min={0} max={59}
        value={String(m).padStart(2, "0")}
        onChange={(e) => emit(h, Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
        onWheel={(e) => { e.preventDefault(); emit(h, m + (e.deltaY > 0 ? -1 : 1)); }}
        onTouchStart={(e) => { touchMRef.current = { startY: e.touches[0].clientY, start: m }; }}
        onTouchMove={(e) => {
          if (!touchMRef.current) return;
          e.preventDefault();
          const delta = Math.round((touchMRef.current.startY - e.touches[0].clientY) / 8);
          emit(h, touchMRef.current.start + delta);
        }}
        onTouchEnd={() => { touchMRef.current = null; }}
        className={inputCls}
      />
    </div>
  );
}

// ── AddSubplanSheet ───────────────────────────────────────────────────────────

export type AddSheetProps = {
  planId: number;
  planStartDate: string;
  planEndDate: string;
  subplanes: SubplanRow[];
  onClose: () => void;
  onSaved: (saved: SubplanRow, original?: SubplanRow | null) => void;
  initialTitulo?: string;
  initialDate?: string;
  initialSubplan?: SubplanRow | null;
};

export function AddSubplanSheet({
  planId, planStartDate, planEndDate, subplanes,
  onClose, onSaved, initialTitulo, initialDate, initialSubplan,
}: AddSheetProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const TOTAL_STEPS = 3;
  const STEP_META = [
    { title: "¿Qué hacéis?",   subtitle: "Tipo y lugar de la actividad" },
    { title: "¿Cuándo?",       subtitle: "Fecha y horario" },
    { title: initialSubplan ? "Editar actividad" : "¿Cómo se llama?", subtitle: "Dale un nombre a la actividad" },
  ];

  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const toLocalTime = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const defaultHoraInicio = initialSubplan ? toLocalTime(initialSubplan.inicio_at) : (planIsAllDay ? "10:00" : planStartTime);
  const defaultHoraFin    = initialSubplan ? toLocalTime(initialSubplan.fin_at)    : (planIsAllDay ? "11:00" : planEndTime);

  const [titulo,             setTitulo]             = useState(initialSubplan?.titulo ?? initialTitulo ?? "");
  const [descripcion,        setDescripcion]        = useState(initialSubplan?.descripcion ?? "");
  const [fecha,              setFecha]              = useState(defaultDate);
  const [fechaFin,           setFechaFin]           = useState<string | null>(initialEndDate && initialEndDate !== defaultDate ? initialEndDate : null);
  const [horaInicio,         setHoraInicio]         = useState(defaultHoraInicio);
  const [horaFin,            setHoraFin]            = useState(defaultHoraFin);
  const allDay = false;
  const [tipo,               setTipo]               = useState<TipoSubplan>(initialSubplan?.tipo ?? "ACTIVIDAD");
  const [ubicacion,          setUbicacion]          = useState(initialSubplan?.ubicacion_nombre ?? "");
  const [ubicacionCoords,    setUbicacionCoords]    = useState<Coords | null>(
    initialSubplan?.ubicacion_lat != null && initialSubplan?.ubicacion_lng != null
      ? { lat: initialSubplan.ubicacion_lat, lng: initialSubplan.ubicacion_lng } : null,
  );
  const [ubicacionFin,       setUbicacionFin]       = useState(initialSubplan?.ubicacion_fin_nombre ?? "");
  const [ubicacionFinCoords, setUbicacionFinCoords] = useState<Coords | null>(
    initialSubplan?.ubicacion_fin_lat != null && initialSubplan?.ubicacion_fin_lng != null
      ? { lat: initialSubplan.ubicacion_fin_lat, lng: initialSubplan.ubicacion_fin_lng } : null,
  );
  const [transporteLlegada,  setTransporteLlegada]  = useState<string | null>(initialSubplan?.transporte_llegada ?? null);
  const [feedbackState,      setFeedbackState]      = useState<ModalFeedbackState | null>(null);
  const [wizardStep,         setWizardStep]         = useState(1);
  const [error,              setError]              = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const savedResultRef = useRef<{ saved: SubplanRow; original: SubplanRow | null } | null>(null);

  const planMonthCount = useMemo(() => {
    const s = new Date(minDate + "T12:00:00");
    const e = new Date(maxDate + "T12:00:00");
    return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  }, [minDate, maxDate]);

  const hayActividadEseDia = subplanes.some((s) => s.id !== initialSubplan?.id && isoDateOnly(s.inicio_at) === fecha);
  const esTransporte = TIPOS_TRANSPORTE.includes(tipo);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const clampedHoraInicio = (() => {
    if (planIsAllDay) return horaInicio;
    if (fecha === minDate && horaInicio < planStartTime) return planStartTime;
    if (fecha === maxDate && horaInicio > planEndTime)   return planEndTime;
    return horaInicio;
  })();

  const efectivaFechaFin = fechaFin ?? fecha;
  const clampedHoraFin = (() => {
    if (planIsAllDay) return horaFin;
    if (efectivaFechaFin === maxDate && horaFin > planEndTime) return planEndTime;
    if (efectivaFechaFin === fecha && horaFin <= clampedHoraInicio) {
      const [hh, mm] = clampedHoraInicio.split(":").map(Number);
      const totalMin = (hh ?? 0) * 60 + (mm ?? 0) + 60;
      const maxTotal = planIsAllDay ? 23 * 60 + 59 : (Number(planEndTime.split(":")[0]) * 60 + Number(planEndTime.split(":")[1]));
      const clamped = Math.min(totalMin, maxTotal);
      return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
    }
    return horaFin;
  })();

  const occupiedIntervals = fecha ? getOccupiedIntervals(subplanes.filter((s) => s.id !== initialSubplan?.id), fecha) : [];
  const isSaving = feedbackState?.type === "loading";
  const canSubmit = titulo.trim().length > 0 && fecha.length > 0 && fecha >= minDate && fecha <= maxDate && !isSaving;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    if (fecha < minDate || fecha > maxDate) { setError(`La actividad debe estar entre el ${minDate} y el ${maxDate}.`); return; }
    if (efectivaFechaFin > maxDate) { setError("La fecha de fin debe estar dentro del rango del plan."); return; }
    if (!allDay && occupiedIntervals.length > 0) {
      const newFrom = timeToMin(clampedHoraInicio);
      const newTo   = timeToMin(clampedHoraFin);
      if (occupiedIntervals.some((b) => newFrom < b.to && newTo > b.from)) {
        setError("Este horario se solapa con una actividad existente o su tiempo de viaje.");
        return;
      }
    }

    setFeedbackState({ type: "loading" });
    try {
      const inicioAt = `${fecha}T${clampedHoraInicio}:00`;
      const finAt    = `${efectivaFechaFin}T${clampedHoraFin}:00`;
      const normalized = {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        inicio_at: new Date(inicioAt).toISOString(),
        fin_at: new Date(finAt).toISOString(),
        all_day: allDay,
        tipo,
        ubicacion_nombre: ubicacion.trim(),
        ubicacion_fin_nombre: esTransporte ? ubicacionFin.trim() : null,
        ubicacion_lat: ubicacionCoords?.lat ?? null,
        ubicacion_lng: ubicacionCoords?.lng ?? null,
        ubicacion_fin_lat: esTransporte ? (ubicacionFinCoords?.lat ?? null) : null,
        ubicacion_fin_lng: esTransporte ? (ubicacionFinCoords?.lng ?? null) : null,
        transporte_llegada: hayActividadEseDia ? transporteLlegada : null,
      };

      if (initialSubplan) {
        await updateSubplan({
          subplanId: initialSubplan.id,
          titulo: normalized.titulo,
          descripcion: normalized.descripcion,
          inicioAt: normalized.inicio_at,
          finAt: normalized.fin_at,
          allDay,
          tipo,
          ubicacionNombre: normalized.ubicacion_nombre,
          ubicacionFinNombre: normalized.ubicacion_fin_nombre,
          ubicacionLat: normalized.ubicacion_lat,
          ubicacionLng: normalized.ubicacion_lng,
          ubicacionFinLat: normalized.ubicacion_fin_lat,
          ubicacionFinLng: normalized.ubicacion_fin_lng,
          transporteLlegada: normalized.transporte_llegada,
        });
        savedResultRef.current = {
          saved: { ...initialSubplan, ...normalized, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null },
          original: initialSubplan,
        };
      } else {
        const newId = await createSubplan({
          planId,
          titulo: normalized.titulo,
          descripcion: normalized.descripcion,
          inicioAt: normalized.inicio_at,
          finAt: normalized.fin_at,
          allDay,
          tipo,
          ubicacionNombre: normalized.ubicacion_nombre,
          ubicacionFinNombre: normalized.ubicacion_fin_nombre,
          ubicacionLat: normalized.ubicacion_lat,
          ubicacionLng: normalized.ubicacion_lng,
          ubicacionFinLat: normalized.ubicacion_fin_lat,
          ubicacionFinLng: normalized.ubicacion_fin_lng,
          transporteLlegada: normalized.transporte_llegada,
        });
        savedResultRef.current = {
          saved: {
            id: newId, plan_id: planId, parent_subplan_id: null,
            ...normalized,
            ubicacion_direccion: null, ubicacion_fin_direccion: null,
            duracion_viaje: null, distancia_viaje: null, ruta_polyline: null,
            orden: 0, estado: "ACTIVO",
            creado_por_user_id: "", created_at: new Date().toISOString(),
          },
          original: null,
        };
      }
      setFeedbackState({ type: "success", label: isEditing ? "Actividad guardada" : "Actividad creada" });
    } catch (err) {
      setFeedbackState({ type: "error", message: err instanceof Error ? err.message : `Error al ${isEditing ? "guardar" : "crear"} la actividad` });
    }
  };

  const canContinueWizard = wizardStep === 3 ? titulo.trim().length > 0 : true;
  const isLastStep = wizardStep === TOTAL_STEPS;
  const meta = STEP_META[wizardStep - 1];

  const handleAdvance = () => {
    if (!canContinueWizard || isSaving) return;
    if (isLastStep) { void handleSubmit(); }
    else { setWizardStep((s) => s + 1); }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
      e.preventDefault();
      handleAdvance();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canContinueWizard, isSaving, isLastStep, wizardStep, titulo]);

  return (
    <>
      <div data-closing={isClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-40" onClick={requestClose} />
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" onClick={requestClose}>
        <div
          ref={sheetRef}
          data-closing={isClosing ? "true" : "false"}
          className={`relative app-modal-panel flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg)] transition-[max-width] duration-[400ms] [transition-timing-function:var(--ease-standard)] md:h-auto md:max-h-[90dvh] md:rounded-[24px] md:shadow-elev-4 ${
            wizardStep === 2
              ? planMonthCount === 1 ? "md:max-w-[420px]" : "md:max-w-[760px]"
              : "md:max-w-[520px]"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {feedbackState && (
            <ModalFeedback
              state={feedbackState}
              onSuccess={() => {
                if (savedResultRef.current) {
                  onSaved(savedResultRef.current.saved, savedResultRef.current.original ?? undefined);
                }
                requestClose();
              }}
              onDismissError={() => setFeedbackState(null)}
            />
          )}

          {/* Progress bar */}
          <div className="h-[3px] w-full shrink-0 bg-[var(--surface-2)]">
            <div
              className="h-full bg-primary-token transition-all duration-[400ms] [transition-timing-function:var(--ease-standard)]"
              style={{ width: `${(wizardStep / TOTAL_STEPS) * 100}%` }}
            />
          </div>

          {/* Top nav */}
          <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] py-[var(--space-3)]">
            <button
              type="button"
              onClick={wizardStep === 1 ? requestClose : () => setWizardStep((s) => s - 1)}
              className="flex size-9 items-center justify-center rounded-full text-app transition-colors hover:bg-surface"
            >
              {wizardStep === 1 ? <CloseX /> : <ChevronLeft className="size-[18px]" aria-hidden />}
            </button>
            <span className="text-caption font-[var(--fw-medium)] text-muted">{wizardStep} de {TOTAL_STEPS}</span>
            <div className="size-9" aria-hidden="true" />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-[var(--space-6)] pb-[var(--space-8)] pt-[var(--space-2)]">
            <div className="mb-[var(--space-6)]">
              <h2 className="font-[var(--fw-bold)] leading-tight text-app" style={{ fontSize: "clamp(22px, 5vw, 28px)" }}>
                {meta.title}
              </h2>
              <p className="mt-[var(--space-1)] text-body-sm text-muted">{meta.subtitle}</p>
            </div>

            {/* Step 1: Tipo + Ubicación */}
            {wizardStep === 1 && (
              <div className="space-y-[var(--space-6)]">
                <div className="grid grid-cols-3 gap-[var(--space-2)] sm:gap-[var(--space-3)]">
                  {ACTIVITY_TYPE_OPTIONS.map((t) => (
                    <button
                      key={t.value} type="button" onClick={() => setTipo(t.value)}
                      className={`flex flex-col items-start gap-[var(--space-2)] rounded-[14px] border-2 px-[var(--space-3)] py-[var(--space-3)] text-left transition-colors sm:rounded-[16px] sm:p-[var(--space-4)] ${
                        tipo === t.value ? "border-[var(--primary)]/40 bg-[var(--primary)]/10" : "border-app bg-app hover:bg-surface"
                      }`}
                    >
                      <t.Icon className={`size-5 shrink-0 ${tipo === t.value ? "text-primary-token" : "text-muted"}`} strokeWidth={1.5} />
                      <span className="text-[14px] leading-[1.15] font-[var(--fw-semibold)] text-app sm:text-body-sm">{t.label}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <p className="mb-[var(--space-2)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                    {esTransporte ? "Origen" : "Ubicación"} <span className="normal-case font-[var(--fw-normal)]">(opcional)</span>
                  </p>
                  <div className={`group flex items-center gap-[var(--space-3)] ${FIELD_LINE_CLS}`}>
                    <MapPin className="size-[16px] shrink-0 text-muted transition-colors group-focus-within:text-primary-token" aria-hidden />
                    <LocationAutocomplete
                      value={ubicacion}
                      onChange={(v, coords) => { setUbicacion(v); setUbicacionCoords(coords ?? null); }}
                      dropdownVariant="surface"
                      placeholder={
                        tipo === "VUELO" ? "Aeropuerto de salida" :
                        tipo === "BARCO" ? "Puerto de salida" :
                        tipo === "HOTEL" ? "Nombre del hotel" :
                        tipo === "RESTAURANTE" ? "Nombre del restaurante" :
                        "¿Dónde será?"
                      }
                    />
                  </div>
                </div>
                {esTransporte && (
                  <div>
                    <p className="mb-[var(--space-2)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Destino</p>
                    <div className={`group flex items-center gap-[var(--space-3)] ${FIELD_LINE_CLS}`}>
                      <MapPin className="size-[16px] shrink-0 text-primary-token" aria-hidden />
                      <LocationAutocomplete
                        value={ubicacionFin}
                        onChange={(v, coords) => { setUbicacionFin(v); setUbicacionFinCoords(coords ?? null); }}
                        dropdownVariant="surface"
                        placeholder={tipo === "VUELO" ? "Aeropuerto de llegada" : "Puerto de llegada"}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Cuándo */}
            {wizardStep === 2 && (
              <div className="space-y-[var(--space-6)]">
                <PlanInlineCalendar
                  key={`${minDate}-${maxDate}`}
                  minDate={minDate} maxDate={maxDate}
                  startDate={fecha} endDate={fechaFin}
                  onChange={(start, end) => { setFecha(start); setFechaFin(end); }}
                />
                <div className="grid grid-cols-2 gap-[var(--space-5)]">
                  {[
                    { label: "Hora inicio", value: horaInicio, onChange: setHoraInicio, minTime: fecha === minDate && !planIsAllDay ? planStartTime : undefined, maxTime: fecha === maxDate && !planIsAllDay ? planEndTime : undefined },
                    { label: "Hora fin",    value: horaFin,    onChange: setHoraFin,    minTime: efectivaFechaFin === fecha ? horaInicio : undefined, maxTime: efectivaFechaFin === maxDate && !planIsAllDay ? planEndTime : undefined },
                  ].map((p) => (
                    <div key={p.label}>
                      <p className="mb-[var(--space-2)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">{p.label}</p>
                      <div className="border-b-2 border-app pb-[var(--space-1)] transition-colors focus-within:border-primary-token">
                        <TimeWheelInput value={p.value} onChange={p.onChange} minTime={p.minTime} maxTime={p.maxTime} />
                      </div>
                    </div>
                  ))}
                </div>
                {error && wizardStep === 2 && <p className="text-body-sm text-[var(--error)]">{error}</p>}
              </div>
            )}

            {/* Step 3: Nombre */}
            {wizardStep === 3 && (
              <div className="space-y-[var(--space-5)]">
                <div className={FIELD_LINE_CLS}>
                  <input
                    value={titulo} onChange={(e) => setTitulo(e.target.value)}
                    placeholder={
                      tipo === "VUELO" ? "Vuelo a París" :
                      tipo === "HOTEL" ? "Hotel Marina Bay" :
                      tipo === "RESTAURANTE" ? "Cena en La Trattoria" :
                      tipo === "BARCO" ? "Ferry a Ibiza" :
                      "Tarde en el museo"
                    }
                    autoFocus
                    className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] text-app outline-none placeholder:text-muted"
                  />
                </div>
                <div className="border-b border-app pb-[var(--space-1)] transition-colors focus-within:border-[var(--border-strong)]">
                  <input
                    value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                    placeholder="Descripción breve (opcional)"
                    className="w-full bg-transparent text-body-sm text-app outline-none placeholder:text-muted"
                  />
                </div>
                {hayActividadEseDia && (
                  <div>
                    <p className="mb-[var(--space-3)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">¿Cómo llegas?</p>
                    <div className="grid grid-cols-3 gap-[var(--space-2)]">
                      {TRANSPORT_LLEGADA.map((t) => (
                        <button
                          key={t.value} type="button"
                          onClick={() => setTransporteLlegada(transporteLlegada === t.value ? null : t.value)}
                          className={`flex flex-col items-center gap-[var(--space-1)] rounded-[14px] border-2 py-[var(--space-3)] transition-colors ${
                            transporteLlegada === t.value ? "border-[var(--primary)]/40 bg-[var(--primary)]/10" : "border-app bg-app hover:bg-surface"
                          }`}
                        >
                          <t.Icon className={`size-[18px] shrink-0 ${transporteLlegada === t.value ? "text-primary-token" : "text-muted"}`} strokeWidth={1.5} />
                          <span className={`text-[14px] font-[var(--fw-semibold)] ${transporteLlegada === t.value ? "text-primary-token" : "text-app"}`}>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && isLastStep && <p className="text-body-sm text-[var(--error)]">{error}</p>}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-app px-[var(--space-5)] py-[var(--space-4)]">
            <div className="flex items-center justify-between">
              {wizardStep === 2 ? (
                <button
                  type="button"
                  onClick={() => { setFecha(defaultDate); setFechaFin(null); setHoraInicio(defaultHoraInicio); setHoraFin(defaultHoraFin); }}
                  className="text-body-sm font-[var(--fw-semibold)] text-app underline underline-offset-2 transition-opacity hover:opacity-60"
                >
                  Restablecer
                </button>
              ) : <div />}
              <button
                type="button"
                disabled={!canContinueWizard || (isLastStep && isSaving)}
                onClick={handleAdvance}
                className="rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85 disabled:opacity-[var(--disabled-opacity)]"
              >
                {isLastStep ? (isSaving ? "Guardando..." : isEditing ? "Guardar cambios" : "Crear actividad") : wizardStep === 2 ? "Siguiente" : "Continuar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
