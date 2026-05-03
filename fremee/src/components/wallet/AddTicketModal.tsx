"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  createTicketEndpoint,
  type TicketType,
  TICKET_COLOR_VARIANTS,
  TICKET_TYPE_LABELS,
} from "@/services/api/endpoints/wallet.endpoint";
import { TicketTypeIcon } from "@/app/(app)/wallet/page";
import type { TicketOcrResult } from "@/app/api/tickets/ocr/route";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { buildInternalApiUrl } from "@/config/external";
import { Upload, Loader2, Check, FileText, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FIELD_LINE_CLS } from "@/lib/styles";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseX } from "@/components/ui/CloseX";
import { ModalFeedback, type ModalFeedbackState } from "@/components/ui/ModalFeedback";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;
const TICKET_TYPES: TicketType[] = ["flight", "ferry", "train", "concert", "match", "hotel", "other"];
const ROUTE_TYPES: TicketType[] = ["flight", "ferry", "train"];

const STEP_META = [
  { title: "Sube tu ticket",          subtitle: "Foto, PDF o imagen — lo rellenamos automáticamente" },
  { title: "¿Qué tipo de ticket?",    subtitle: "Elige la categoría" },
  { title: "¿Cuándo?",                subtitle: "Fecha y hora del evento" },
  { title: "Ruta o lugar",            subtitle: "De dónde a dónde, o dónde es" },
  { title: "Detalles del ticket",     subtitle: "Asiento, puerta y más" },
];

function isRouteType(t: TicketType) { return ROUTE_TYPES.includes(t); }

function toDateInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Inline single-day calendar ────────────────────────────────────────────────

function InlineDayCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const todayStr = toDateInputValue(new Date());
  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  const [monthCount, setMonthCount] = useState(4);
  const [desktopPage, setDesktopPage] = useState(0);

  const mobileMonths = useMemo(() =>
    Array.from({ length: monthCount }, (_, i) => {
      const d = new Date(baseYear, baseMonth + i, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }),
    [baseMonth, baseYear, monthCount]
  );

  const desktopMonths = useMemo(() =>
    [0, 1].map((offset) => {
      const d = new Date(baseYear, baseMonth + desktopPage * 2 + offset, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    }),
    [baseMonth, baseYear, desktopPage]
  );

  function renderMonth(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7;
    const monthLabel = format(firstDay, "MMMM yyyy", { locale: es });

    const cells: React.ReactNode[] = Array.from({ length: startDow }, (_, i) => <div key={`pad-${i}`} />);

    for (let i = 0; i < daysInMonth; i++) {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isPast = dateStr < todayStr;
      const isSelected = dateStr === value;

      cells.push(
        <div
          key={dateStr}
          onClick={() => !isPast && onChange(dateStr)}
          className="relative flex h-12 items-center justify-center"
        >
          <div
            className={[
              "relative z-10 flex size-10 items-center justify-center rounded-full text-[15px] font-[var(--fw-semibold)] transition-colors select-none",
              isSelected
                ? "bg-[var(--text-primary)] text-[var(--bg)]"
                : isPast
                ? "cursor-default text-muted opacity-25"
                : "cursor-pointer text-app hover:bg-[var(--surface-2)]",
            ].join(" ")}
          >
            {day}
          </div>
        </div>
      );
    }

    while (cells.length < 42) cells.push(<div key={`tail-${year}-${month}-${cells.length}`} />);

    return (
      <div key={`${year}-${month}`} className="flex flex-col">
        <p className="mb-[var(--space-4)] text-center text-[15px] font-[var(--fw-bold)] capitalize text-app">
          {monthLabel}
        </p>
        <div className="mb-[var(--space-1)] grid grid-cols-7 text-center">
          {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
            <span key={d} className="py-1 text-[14px] font-[var(--fw-semibold)] text-muted">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7">{cells}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Mobile */}
      <div className="min-h-0 flex-1 space-y-[var(--space-8)] overflow-y-auto pr-1 md:hidden">
        {mobileMonths.map(({ year, month }) => renderMonth(year, month))}
        <button
          type="button"
          onClick={() => setMonthCount(c => c + 4)}
          className="w-full py-[var(--space-4)] text-body-sm font-[var(--fw-semibold)] text-muted transition-colors hover:text-app"
        >
          Cargar más fechas
        </button>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex md:h-full md:items-start md:gap-[var(--space-3)]">
        <button
          type="button"
          onClick={() => setDesktopPage(p => Math.max(0, p - 1))}
          disabled={desktopPage === 0}
          className="mt-[54px] flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface disabled:opacity-20"
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        <div className="grid flex-1 grid-cols-2 gap-[var(--space-8)]">
          {desktopMonths.map(({ year, month }) => renderMonth(year, month))}
        </div>
        <button
          type="button"
          onClick={() => setDesktopPage(p => p + 1)}
          className="mt-[54px] flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function AddTicketModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const handleNextRef   = useRef<() => void>(() => {});
  const handleSubmitRef = useRef<() => void | Promise<void>>(() => {});
  const fileInputRef    = useRef<HTMLInputElement | null>(null);

  const [step, setStep]   = useState(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<ModalFeedbackState | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Step 1 — source file + OCR
  const [sourceFile, setSourceFile]             = useState<File | null>(null);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string | null>(null);
  const [sourcePath, setSourcePath]             = useState<string | null>(null);
  const [ocrLoading, setOcrLoading]             = useState(false);
  const [ocrError, setOcrError]                 = useState<string | null>(null);

  // Step 2
  const [type, setType]   = useState<TicketType>("flight");
  const [title, setTitle] = useState("");

  // Step 2 — date/time
  const [dateStr, setDateStr]     = useState(() => toDateInputValue(new Date()));
  const [timeStr, setTimeStr]     = useState("12:00");
  const [endDateStr, setEndDateStr] = useState("");
  const [endTimeStr, setEndTimeStr] = useState("");

  // Step 3 — route / place
  const [fromLabel, setFromLabel]     = useState("");
  const [toLabel, setToLabel]         = useState("");
  const [placeLabel, setPlaceLabel]   = useState("");
  const [bookingCode, setBookingCode] = useState("");

  // Step 4 — details
  const [seatLabel, setSeatLabel]         = useState("");
  const [gateLabel, setGateLabel]         = useState("");
  const [terminalLabel, setTerminalLabel] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [notes, setNotes]                 = useState("");
  const [hasQr, setHasQr]                 = useState(false);

  function isTicketType(value: string): value is TicketType {
    return TICKET_TYPES.includes(value as TicketType);
  }

  const canContinue = useMemo(() => {
    if (step === 1) return !ocrLoading; // esperar a que termine el OCR
    if (step === 2) return title.trim().length > 0;
    if (step === 3) return dateStr !== "";
    if (step === 4) return isRouteType(type) ? fromLabel.trim().length > 0 && toLabel.trim().length > 0 : true;
    return true;
  }, [dateStr, fromLabel, ocrLoading, step, title, toLabel, type]);

  async function runOcr(file: File) {
    setOcrLoading(true);
    setOcrError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");
      const { data: { session } } = await supabase.auth.getSession();

      let fileToSend: File | Blob = file;
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf && file.type.startsWith("image/")) {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width; canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("No se pudo preparar la imagen");
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        fileToSend = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("No se pudo convertir la imagen"));
              return;
            }
            resolve(blob);
          }, "image/jpeg", 0.92);
        });
      }

      const fd = new FormData();
      fd.append("file", fileToSend, isPdf ? file.name : "ticket.jpg");
      fd.append("user_id", user.id);

      const res  = await fetch(buildInternalApiUrl("/api/tickets/ocr"), {
        method: "POST",
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {},
        body: fd,
      });
      const data = await res.json() as TicketOcrResult & { error?: string };
      if (data.error) throw new Error(data.error);

      // Pre-fill fields
      if (data.source_path)    setSourcePath(data.source_path);
      if (data.type && isTicketType(data.type)) setType(data.type);
      if (data.title)          setTitle(data.title);
      if (data.from_label)     setFromLabel(data.from_label);
      if (data.to_label)       setToLabel(data.to_label);
      if (data.place_label)    setPlaceLabel(data.place_label);
      if (data.booking_code)   setBookingCode(data.booking_code);
      if (data.seat_label)     setSeatLabel(data.seat_label);
      if (data.gate_label)     setGateLabel(data.gate_label);
      if (data.terminal_label) setTerminalLabel(data.terminal_label);
      if (data.passenger_name) setPassengerName(data.passenger_name);
      if (data.has_qr)         setHasQr(true);
      if (data.starts_at) {
        const d = new Date(data.starts_at);
        setDateStr(toDateInputValue(d));
        setTimeStr(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }
      if (data.ends_at) {
        const d = new Date(data.ends_at);
        setEndDateStr(toDateInputValue(d));
        setEndTimeStr(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      }
    } catch (e) {
      setOcrError(e instanceof Error ? e.message : "Error al analizar el archivo");
    } finally {
      setOcrLoading(false);
    }
  }

  function handleNext() { if (step < TOTAL_STEPS) setStep(s => s + 1); }
  function handleBack() { if (step > 1) setStep(s => s - 1); }

  async function handleSubmit() {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    setFeedbackState({ type: "loading" });
    try {
      const startsAt = `${dateStr}T${timeStr || "00:00"}:00`;
      const endsAt   = endDateStr ? `${endDateStr}T${endTimeStr || "00:00"}:00` : null;

      const isPdf = sourceFile?.type === "application/pdf" || sourceFile?.name.toLowerCase().endsWith(".pdf");
      const sourceImageUrl = sourcePath && !isPdf ? sourcePath : null;
      const sourcePdfUrl   = sourcePath && isPdf  ? sourcePath : null;

      await createTicketEndpoint({
        plan_id:          null,
        type,
        title:            title.trim(),
        subtitle:         null,
        from_label:       fromLabel.trim() || null,
        to_label:         toLabel.trim() || null,
        place_label:      placeLabel.trim() || null,
        starts_at:        startsAt,
        ends_at:          endsAt,
        booking_code:     bookingCode.trim() || null,
        seat_label:       seatLabel.trim() || null,
        gate_label:       gateLabel.trim() || null,
        terminal_label:   terminalLabel.trim() || null,
        passenger_name:   passengerName.trim() || null,
        notes:            notes.trim() || null,
        qr_image_url:     null,
        barcode_value:    hasQr ? "detected" : null,
        source_image_url: sourceImageUrl,
        source_pdf_url:   sourcePdfUrl,
        cover_color:      null,
        status:           "upcoming",
      });
      setFeedbackState({ type: "success", label: "Ticket guardado" });
    } catch (e) {
      const msg = typeof e === "object" && e && "message" in e ? String((e as { message: string }).message) : "No se pudo guardar el ticket.";
      setErrorMsg(msg);
      setFeedbackState({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  handleNextRef.current   = handleNext;
  handleSubmitRef.current = handleSubmit;

  const meta = STEP_META[step - 1];
  const desktopMaxWidth = step === 3 ? "840px" : "540px";
  const primaryBtnCls = "rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85 disabled:opacity-[var(--disabled-opacity)]";
  const hasProgress =
    step > 1 ||
    sourceFile !== null ||
    sourcePath !== null ||
    title.trim().length > 0 ||
    fromLabel.trim().length > 0 ||
    toLabel.trim().length > 0 ||
    placeLabel.trim().length > 0 ||
    bookingCode.trim().length > 0 ||
    notes.trim().length > 0;

  function requestDismiss() {
    if (saving || ocrLoading) return;
    if (hasProgress) {
      setDiscardOpen(true);
      return;
    }
    requestClose();
  }

  return (
    <>
    <div
      data-closing={isClosing ? "true" : "false"}
      className="app-modal-overlay fixed inset-0 z-[60] flex items-end justify-center md:items-center"
      onClick={saving ? undefined : requestDismiss}
      role="presentation"
    >
      <div
        className="app-modal-panel relative flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg)] md:h-[min(760px,90dvh)] md:w-full md:max-w-[var(--modal-max-width)] md:rounded-[24px] md:shadow-elev-4 md:transition-[max-width] md:duration-300 md:[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
        style={{ "--modal-max-width": desktopMaxWidth } as CSSProperties}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {feedbackState && (
          <ModalFeedback
            state={feedbackState}
            onSuccess={() => { onCreated(); requestClose(); }}
            onDismissError={() => setFeedbackState(null)}
          />
        )}
        {/* Progress bar */}
        <div className="h-[3px] w-full shrink-0 bg-[var(--surface-2)]">
          <div
            className="h-full bg-primary-token transition-all duration-[400ms] [transition-timing-function:var(--ease-standard)]"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Top nav */}
        <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] py-[var(--space-3)]">
          <button
            type="button"
            onClick={step === 1 ? requestDismiss : handleBack}
            disabled={saving}
            className="flex size-9 items-center justify-center rounded-full text-app transition-colors hover:bg-surface disabled:opacity-50"
            aria-label={step === 1 ? "Cerrar" : "Volver"}
          >
            {step === 1 ? (
              <CloseX />
            ) : (
              <ChevronLeft className="size-[18px]" aria-hidden />
            )}
          </button>
          <span className="text-caption font-[var(--fw-medium)] text-muted">{step} de {TOTAL_STEPS}</span>
          <div className="size-9" aria-hidden="true" />
        </div>

        {/* Content */}
        <div
          className={`flex-1 min-h-0 px-[var(--space-6)] pt-[var(--space-2)] ${
            step === 3
              ? "flex flex-col overflow-hidden pb-[var(--space-6)]"
              : "overflow-y-scroll [scrollbar-gutter:stable] pb-[var(--space-8)]"
          }`}
        >
          <div className={`shrink-0 ${step === 3 ? "mb-[var(--space-5)] md:mb-[var(--space-6)]" : "mb-[var(--space-8)]"}`}>
            <h2 className="font-[var(--fw-bold)] leading-tight text-app" style={{ fontSize: "clamp(22px, 5vw, 28px)" }}>
              {meta.title}
            </h2>
            <p className="mt-[var(--space-1)] text-body-sm text-muted">{meta.subtitle}</p>
          </div>

          {/* Step 1: subida de archivo */}
          {step === 1 && (
            <UploadStep
              file={sourceFile}
              previewUrl={sourcePreviewUrl}
              fileInputRef={fileInputRef}
              ocrLoading={ocrLoading}
              ocrError={ocrError}
              onFile={(f, url) => {
                setSourceFile(f);
                setSourcePreviewUrl(url);
                void runOcr(f);
              }}
              onClear={() => {
                setSourceFile(null);
                setSourcePreviewUrl(null);
                setSourcePath(null);
                setOcrError(null);
                setHasQr(false);
              }}
            />
          )}

          {/* Step 2: tipo + título */}
          {step === 2 && (
            <div className="space-y-[var(--space-8)]">
              {/* Type picker */}
              <div className="flex flex-wrap gap-2">
                {TICKET_TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-[var(--fw-semibold)] transition-colors ${
                      type === t
                        ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg)]"
                        : "border-app text-muted hover:border-[var(--border-strong)] hover:text-app"
                    }`}
                  >
                    <TicketTypeIcon type={t} className="size-[13px]" />
                    {TICKET_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>

              {/* Color preview */}
              <div className="grid grid-cols-4 gap-1.5">
                {TICKET_COLOR_VARIANTS[type].map((g, i) => (
                  <div key={i} className="h-2 rounded-full" style={{ background: g }} />
                ))}
              </div>

              {/* Title */}
              <div className={`flex items-center gap-[var(--space-3)] ${FIELD_LINE_CLS}`}>
                <TicketTypeIcon type={type} className="size-5 shrink-0 text-muted" />
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={
                    type === "flight" ? "Iberia IB3157" :
                    type === "concert" ? "Coldplay · Madrid" :
                    type === "match" ? "Real Madrid vs Inter" :
                    type === "hotel" ? "Hotel Arts Barcelona" :
                    "Nombre del ticket"
                  }
                  autoFocus
                  className="w-full flex-1 bg-transparent text-[22px] font-[var(--fw-semibold)] text-app outline-none placeholder:text-muted"
                />
              </div>
            </div>
          )}

          {/* Step 3: fecha + hora */}
          {step === 3 && (
            <div className="flex min-h-0 flex-1 flex-col gap-[var(--space-5)]">
              {/* Time pickers */}
              <div className="grid shrink-0 grid-cols-2 gap-[var(--space-4)]">
                <div>
                  <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Hora de inicio</p>
                  <div className={FIELD_LINE_CLS}>
                    <input
                      type="time"
                      value={timeStr}
                      onChange={e => setTimeStr(e.target.value)}
                      className="w-full bg-transparent text-body text-app outline-none"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Hora de fin (opcional)</p>
                  <div className={FIELD_LINE_CLS}>
                    <input
                      type="time"
                      value={endTimeStr}
                      onChange={e => setEndTimeStr(e.target.value)}
                      className="w-full bg-transparent text-body text-app outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Calendar */}
              <div className="min-h-0 flex-1">
                <InlineDayCalendar value={dateStr} onChange={setDateStr} />
              </div>
            </div>
          )}

          {/* Step 4: ruta / lugar + localizador */}
          {step === 4 && (
            <div className="space-y-[var(--space-6)]">
              {isRouteType(type) ? (
                <div className="grid grid-cols-2 gap-[var(--space-5)]">
                  <div>
                    <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Origen</p>
                    <div className={FIELD_LINE_CLS}>
                      <input
                        type="text"
                        value={fromLabel}
                        onChange={e => setFromLabel(e.target.value.toUpperCase())}
                        placeholder={type === "flight" ? "MAD" : "Barcelona"}
                        maxLength={type === "flight" ? 3 : 40}
                        autoFocus
                        className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] uppercase text-app outline-none placeholder:text-muted"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Destino</p>
                    <div className={FIELD_LINE_CLS}>
                      <input
                        type="text"
                        value={toLabel}
                        onChange={e => setToLabel(e.target.value.toUpperCase())}
                        placeholder={type === "flight" ? "JFK" : "Paris"}
                        maxLength={type === "flight" ? 3 : 40}
                        className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] uppercase text-app outline-none placeholder:text-muted"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                    {type === "hotel" ? "Nombre del hotel" : "Lugar / recinto"}
                  </p>
                  <div className={FIELD_LINE_CLS}>
                    <input
                      type="text"
                      value={placeLabel}
                      onChange={e => setPlaceLabel(e.target.value)}
                      placeholder={
                        type === "concert" ? "WiZink Center" :
                        type === "match" ? "Estadio Santiago Bernabéu" :
                        type === "hotel" ? "Hotel Arts Barcelona" :
                        "Lugar del evento"
                      }
                      autoFocus
                      className="w-full bg-transparent text-[22px] font-[var(--fw-semibold)] text-app outline-none placeholder:text-muted"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Localizador / código de reserva</p>
                <div className={FIELD_LINE_CLS}>
                  <input
                    type="text"
                    value={bookingCode}
                    onChange={e => setBookingCode(e.target.value.toUpperCase())}
                    placeholder="Q7L29K"
                    className="w-full bg-transparent text-body text-app tracking-widest outline-none placeholder:text-muted"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: detalles */}
          {step === 5 && (
            <div className="space-y-[var(--space-6)]">
              {type !== "hotel" && (
                <div className="grid grid-cols-2 gap-[var(--space-5)]">
                  <div>
                    <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                      {type === "concert" || type === "match" ? "Sector / zona" : "Asiento"}
                    </p>
                    <div className={FIELD_LINE_CLS}>
                      <input
                        type="text"
                        value={seatLabel}
                        onChange={e => setSeatLabel(e.target.value)}
                        placeholder={type === "flight" ? "14A" : type === "concert" ? "Pista A" : "22C"}
                        className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted"
                      />
                    </div>
                  </div>
                  {isRouteType(type) && (
                    <div>
                      <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Puerta</p>
                      <div className={FIELD_LINE_CLS}>
                        <input
                          type="text"
                          value={gateLabel}
                          onChange={e => setGateLabel(e.target.value)}
                          placeholder="K21"
                          className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {type === "flight" && (
                <div>
                  <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Terminal</p>
                  <div className={FIELD_LINE_CLS}>
                    <input
                      type="text"
                      value={terminalLabel}
                      onChange={e => setTerminalLabel(e.target.value)}
                      placeholder="T4"
                      className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Nombre del titular</p>
                <div className={FIELD_LINE_CLS}>
                  <input
                    type="text"
                    value={passengerName}
                    onChange={e => setPassengerName(e.target.value)}
                    placeholder="Carlos García"
                    className="w-full bg-transparent text-body text-app outline-none placeholder:text-muted"
                  />
                </div>
              </div>

              <div>
                <p className="mb-[var(--space-2)] text-[13px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Notas</p>
                <div className="border-b border-app pb-[var(--space-2)] transition-colors focus-within:border-primary-token">
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Llegar 30 min antes del embarque..."
                    rows={3}
                    className="w-full resize-none bg-transparent text-body-sm text-app outline-none placeholder:text-muted"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[var(--border)] px-[var(--space-6)] pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] pt-[var(--space-4)]">
          <div className="min-h-[20px] flex-1">
            {errorMsg && <p className="text-caption text-red-500">{errorMsg}</p>}
          </div>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={handleNext}
              className={primaryBtnCls}
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className={primaryBtnCls}
            >
              {saving ? "Guardando..." : "Guardar ticket"}
            </button>
          )}
        </div>
      </div>
    </div>
    <DiscardChangesDialog
      open={discardOpen}
      onCancel={() => setDiscardOpen(false)}
      onDiscard={() => {
        setDiscardOpen(false);
        requestClose();
      }}
    />
    </>
  );
}

// ── UploadStep ────────────────────────────────────────────────────────────────

function UploadStep({
  file,
  previewUrl,
  fileInputRef,
  ocrLoading,
  ocrError,
  onFile,
  onClear,
}: {
  file: File | null;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  ocrLoading: boolean;
  ocrError: string | null;
  onFile: (f: File, url: string) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    const url = f.type.startsWith("image/") ? URL.createObjectURL(f) : null;
    onFile(f, url ?? "");
  }

  const isPdf = file?.type === "application/pdf";

  return (
    <div className="space-y-[var(--space-5)]">
      {!file ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed transition-colors ${
            dragging
              ? "border-primary-token bg-[var(--primary)]/8"
              : "border-app hover:border-[var(--border-strong)] hover:bg-surface"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
            <UploadIcon className="size-6 text-muted" />
          </div>
          <div className="text-center">
            <p className="text-body-sm font-[var(--fw-semibold)] text-app">Arrastra o haz clic para subir</p>
            <p className="mt-0.5 text-caption text-muted">Imagen o PDF del ticket / boarding pass</p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-[20px] border border-app">
          {isPdf ? (
            <div className="flex h-[160px] flex-col items-center justify-center gap-2 bg-[var(--surface)]">
              <PdfIcon className="size-10 text-muted" />
              <p className="max-w-[240px] truncate text-body-sm font-[var(--fw-semibold)] text-app">{file.name}</p>
            </div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Vista previa" className="h-[200px] w-full object-cover" />
          ) : null}
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* OCR status */}
      {ocrLoading && (
        <div className="flex items-center gap-2 rounded-[14px] bg-[var(--surface-2)] px-4 py-3">
          <SpinnerIcon className="size-4 animate-spin text-muted" />
          <p className="text-body-sm text-muted">Analizando ticket…</p>
        </div>
      )}
      {!ocrLoading && ocrError && (
        <div className="rounded-[14px] bg-red-500/10 px-4 py-3">
          <p className="text-body-sm text-red-500">{ocrError}</p>
          <p className="mt-0.5 text-caption text-muted">Puedes continuar y rellenar los datos manualmente.</p>
        </div>
      )}
      {!ocrLoading && !ocrError && file && (
        <div className="flex items-center gap-2 rounded-[14px] bg-[var(--success-token,#16a34a)]/10 px-4 py-3">
          <CheckIcon className="size-4 text-[var(--success-token,#16a34a)]" />
          <p className="text-body-sm text-[var(--success-token,#16a34a)]">Datos extraídos. Revísalos en los pasos siguientes.</p>
        </div>
      )}
      {!file && (
        <p className="text-center text-caption text-muted">
          Opcional — también puedes rellenar todo manualmente.
        </p>
      )}
    </div>
  );
}

function UploadIcon({ className = "size-6" }: { className?: string }) {
  return <Upload className={className} aria-hidden />;
}
function SpinnerIcon({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden />;
}
function CheckIcon({ className = "size-4" }: { className?: string }) {
  return <Check className={className} aria-hidden />;
}
function PdfIcon({ className = "size-6" }: { className?: string }) {
  return <FileText className={className} aria-hidden />;
}
