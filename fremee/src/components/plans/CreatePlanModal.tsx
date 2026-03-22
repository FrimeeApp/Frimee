"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { format, parse } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type CreatePlanPayload = {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  startAllDay: boolean;
  endAllDay: boolean;
  coverImageUrl: string | null;
  coverFile: File | null;
  visibility: "PUBLICO" | "SOLO_GRUPO";
  inviteMode: "now" | "later";
};

type CreatePlanModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePlanPayload) => void | Promise<void>;
};

const DEFAULT_VISIBILITY: CreatePlanPayload["visibility"] = "SOLO_GRUPO";
const DEFAULT_INVITE_MODE: CreatePlanPayload["inviteMode"] = "later";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isBlobUrl(url: string) {
  return url.startsWith("blob:");
}

export default function CreatePlanModal({ open, onClose, onCreate }: CreatePlanModalProps) {
  const wasOpenRef = useRef(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(addDays(new Date(), 1)));
  const [visibility, setVisibility] = useState<CreatePlanPayload["visibility"]>(DEFAULT_VISIBILITY);
  const [inviteMode, setInviteMode] = useState<CreatePlanPayload["inviteMode"]>(DEFAULT_INVITE_MODE);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [startAllDay, setStartAllDay] = useState(true);
  const [endAllDay, setEndAllDay] = useState(true);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!location.trim()) return false;
    if (!startDate || !endDate) return false;
    return endDate >= startDate;
  }, [endDate, location, startDate, title]);

  const resetForm = () => {
    const today = new Date();
    setTitle("");
    setDescription("");
    setLocation("");
    setStartDate(toDateInputValue(today));
    setEndDate(toDateInputValue(addDays(today, 1)));
    setVisibility(DEFAULT_VISIBILITY);
    setInviteMode(DEFAULT_INVITE_MODE);
    setStartTime("09:00");
    setEndTime("18:00");
    setStartAllDay(true);
    setEndAllDay(true);
    setCoverImageUrl(null);
    setCoverFile(null);
    setSaving(false);
    setErrorMsg(null);
  };

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open, saving]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (coverImageUrl && isBlobUrl(coverImageUrl)) {
        URL.revokeObjectURL(coverImageUrl);
      }
    };
  }, [coverImageUrl]);

  if (!open) return null;

  const onPickCover = () => {
    coverInputRef.current?.click();
  };

  const onCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (coverImageUrl && isBlobUrl(coverImageUrl)) {
      URL.revokeObjectURL(coverImageUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setCoverImageUrl(nextUrl);
    setCoverFile(file);
  };

  const onStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value && endDate < value) {
      setEndDate(value);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || saving) {
      if (!canSubmit) setErrorMsg("Completa el nombre y el destino para continuar.");
      return;
    }

    setErrorMsg(null);
    setSaving(true);

    try {
      await onCreate({
        title: title.trim(),
        location: location.trim(),
        startDate,
        endDate,
        startTime: startAllDay ? null : startTime,
        endTime: endAllDay ? null : endTime,
        startAllDay,
        endAllDay,
        coverImageUrl,
        coverFile,
        visibility,
        inviteMode,
      });
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err
          ? String(err.message)
          : "No se pudo crear el plan.";
      setErrorMsg(message);
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-safe py-[var(--space-4)] sm:py-[var(--space-6)] backdrop-blur-sm bg-black/40"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="flex w-full max-w-[520px] max-h-full flex-col overflow-hidden rounded-[20px] bg-surface shadow-elev-4"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-plan-title"
      >
        {/* ─── Cover header ─── */}
        <div
          className="relative flex h-[140px] shrink-0 flex-col justify-end bg-cover bg-center"
          style={coverImageUrl ? { backgroundImage: `url(${coverImageUrl})` } : undefined}
        >
          {!coverImageUrl && (
            <div className="absolute inset-0 bg-[var(--surface-2)]" />
          )}
          {coverImageUrl && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          )}

          <div className="relative z-10 px-[var(--space-5)] pb-[var(--space-4)] pt-[var(--space-4)]">
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre del plan"
              className={`w-full bg-transparent text-[var(--font-h2)] font-[var(--fw-bold)] leading-[var(--lh-h2)] tracking-[-0.01em] outline-none ring-0 focus:ring-0 focus:outline-none ${
                coverImageUrl ? "text-white placeholder:text-white" : "text-app placeholder:text-tertiary"
              }`}
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción breve (opcional)"
              className={`mt-1.5 w-full bg-transparent text-body outline-none ring-0 focus:ring-0 focus:outline-none ${
                coverImageUrl ? "text-white placeholder:text-white/80" : "text-muted placeholder:text-tertiary"
              }`}
            />
          </div>

          <button
            type="button"
            onClick={onPickCover}
            className={`absolute right-3 top-3 rounded-chip border px-3 py-1.5 text-caption font-[var(--fw-medium)] transition-colors ${
              coverImageUrl
                ? "border-white/30 bg-black/30 text-white backdrop-blur-sm hover:bg-black/40"
                : "border-app bg-surface text-muted hover:bg-[var(--interactive-hover-surface)]"
            }`}
          >
            Cambiar portada
          </button>

          <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverChange} className="hidden" />
        </div>

        {/* ─── Form body ─── */}
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col overflow-y-auto">
          <div className="space-y-[var(--space-3)] p-[var(--space-5)]">

            {/* Destino */}
            <div>
              <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Destino</p>
              <div className="relative">
                <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 size-[16px] -translate-y-1/2 text-primary-token" aria-hidden="true">
                  <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="9" r="2.5" fill="currentColor" />
                </svg>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="¿A dónde quieres ir?"
                  className="h-input w-full rounded-[12px] border border-app bg-app pl-10 pr-[var(--space-3)] text-body-sm outline-none transition-colors focus:border-[var(--border-strong)]"
                />
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-[var(--space-3)]">
              <div>
                <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Fecha inicio</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="relative flex h-input w-full items-center rounded-[12px] border border-app bg-app pl-10 pr-[var(--space-3)] text-body-sm outline-none transition-colors hover:border-[var(--border-strong)]">
                      <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span className="capitalize">
                        {format(parse(startDate, "yyyy-MM-dd", new Date()), "d MMM yyyy", { locale: es })}
                        {!startAllDay && <span className="ml-1 text-muted">{startTime}</span>}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] border-b border-app pb-[var(--space-2)]">
                      <div className="flex flex-1 items-center gap-[var(--space-2)]">
                        <span className="text-caption font-[var(--fw-medium)] text-muted whitespace-nowrap">Todo el día</span>
                        <button
                          type="button"
                          onClick={() => setStartAllDay(!startAllDay)}
                          className={`relative h-[22px] w-[40px] shrink-0 rounded-chip transition-colors duration-200 ${startAllDay ? "bg-primary-token" : "bg-[var(--surface-2)]"}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${startAllDay ? "translate-x-[18px]" : "translate-x-0"}`} />
                        </button>
                      </div>
                      <div className="flex-1 transition-opacity duration-200" style={{ opacity: startAllDay ? 0.4 : 1, pointerEvents: startAllDay ? "none" : "auto" }}>
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="h-input w-full rounded-[10px] border border-app bg-app px-[var(--space-3)] text-body-sm outline-none transition-colors focus:border-[var(--border-strong)]"
                        />
                      </div>
                    </div>
                    <Calendar
                      mode="single"
                      selected={parse(startDate, "yyyy-MM-dd", new Date())}
                      onSelect={(day) => {
                        if (day) onStartDateChange(format(day, "yyyy-MM-dd"));
                      }}
                      defaultMonth={parse(startDate, "yyyy-MM-dd", new Date())}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Fecha final</p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="relative flex h-input w-full items-center rounded-[12px] border border-app bg-app pl-10 pr-[var(--space-3)] text-body-sm outline-none transition-colors hover:border-[var(--border-strong)]">
                      <svg viewBox="0 0 24 24" fill="none" className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-muted" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      <span className="capitalize">
                        {format(parse(endDate, "yyyy-MM-dd", new Date()), "d MMM yyyy", { locale: es })}
                        {!endAllDay && <span className="ml-1 text-muted">{endTime}</span>}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end">
                    <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] border-b border-app pb-[var(--space-2)]">
                      <div className="flex flex-1 items-center gap-[var(--space-2)]">
                        <span className="text-caption font-[var(--fw-medium)] text-muted whitespace-nowrap">Todo el día</span>
                        <button
                          type="button"
                          onClick={() => setEndAllDay(!endAllDay)}
                          className={`relative h-[22px] w-[40px] shrink-0 rounded-chip transition-colors duration-200 ${endAllDay ? "bg-primary-token" : "bg-[var(--surface-2)]"}`}
                        >
                          <span className={`absolute top-[2px] left-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${endAllDay ? "translate-x-[18px]" : "translate-x-0"}`} />
                        </button>
                      </div>
                      <div className="flex-1 transition-opacity duration-200" style={{ opacity: endAllDay ? 0.4 : 1, pointerEvents: endAllDay ? "none" : "auto" }}>
                        <input
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="h-input w-full rounded-[10px] border border-app bg-app px-[var(--space-3)] text-body-sm outline-none transition-colors focus:border-[var(--border-strong)]"
                        />
                      </div>
                    </div>
                    <Calendar
                      mode="single"
                      selected={parse(endDate, "yyyy-MM-dd", new Date())}
                      onSelect={(day) => {
                        if (day) setEndDate(format(day, "yyyy-MM-dd"));
                      }}
                      disabled={{ before: parse(startDate, "yyyy-MM-dd", new Date()) }}
                      defaultMonth={parse(endDate, "yyyy-MM-dd", new Date())}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Visibilidad + Tipo de plan */}
            <div className="grid grid-cols-2 gap-[var(--space-5)]">
              <div>
                <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Visibilidad</p>
                <div className="relative flex h-input items-center rounded-chip border border-app bg-app p-[3px]">
                  <div
                    className="absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-chip bg-primary-token shadow-sm transition-transform duration-200 ease-out"
                    style={{ transform: visibility === "PUBLICO" ? "translateX(0)" : "translateX(100%)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setVisibility("PUBLICO")}
                    className={`relative z-10 flex h-full flex-1 items-center justify-center rounded-chip text-body-sm font-[var(--fw-medium)] transition-colors duration-200 ${
                      visibility === "PUBLICO" ? "text-contrast-token" : "text-muted"
                    }`}
                  >
                    Público
                  </button>
                  <button
                    type="button"
                    onClick={() => setVisibility("SOLO_GRUPO")}
                    className={`relative z-10 flex h-full flex-1 items-center justify-center rounded-chip text-body-sm font-[var(--fw-medium)] transition-colors duration-200 ${
                      visibility === "SOLO_GRUPO" ? "text-contrast-token" : "text-muted"
                    }`}
                  >
                    Privado
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-[var(--space-2)] text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Tipo de plan</p>
                <div className="relative flex h-input items-center rounded-chip border border-app bg-app p-[3px]">
                  <div
                    className="absolute top-[3px] bottom-[3px] w-[calc(50%-3px)] rounded-chip bg-primary-token shadow-sm transition-transform duration-200 ease-out"
                    style={{ transform: inviteMode === "later" ? "translateX(0)" : "translateX(100%)" }}
                  />
                  <button
                    type="button"
                    onClick={() => setInviteMode("later")}
                    className={`relative z-10 flex h-full flex-1 items-center justify-center rounded-chip text-body-sm font-[var(--fw-medium)] transition-colors duration-200 ${
                      inviteMode === "later" ? "text-contrast-token" : "text-muted"
                    }`}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteMode("now")}
                    className={`relative z-10 flex h-full flex-1 items-center justify-center rounded-chip text-body-sm font-[var(--fw-medium)] transition-colors duration-200 ${
                      inviteMode === "now" ? "text-contrast-token" : "text-muted"
                    }`}
                  >
                    Grupal
                  </button>
                </div>
              </div>
            </div>

            {/* Invitar amigos (si grupal) */}
            <div
              className="grid transition-all duration-250 ease-out"
              style={{ gridTemplateRows: inviteMode === "now" ? "1fr" : "0fr", opacity: inviteMode === "now" ? 1 : 0 }}
            >
              <div className="overflow-hidden">
                <div className="rounded-[12px] border border-dashed border-app p-[var(--space-3)]">
                  <div className="flex items-center gap-2 text-muted">
                    <svg viewBox="0 0 24 24" fill="none" className="size-[18px]" aria-hidden="true">
                      <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M2 20C2.5 16.5 5.5 14 9 14C12.5 14 15.5 16.5 16 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      <path d="M19 11V15M17 13H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span className="text-body-sm font-[var(--fw-medium)]">Invitar amigos +</span>
                  </div>
                  <p className="mt-[var(--space-2)] text-caption text-muted">
                    Podrás invitar amigos una vez creado el plan.
                  </p>
                </div>
              </div>
            </div>

            {errorMsg ? <p className="text-body-sm text-error-token">{errorMsg}</p> : null}
          </div>

          {/* ─── Footer ─── */}
          <div className="flex items-center justify-between border-t border-app px-[var(--space-5)] py-[var(--space-4)]">
            <button
              type="button"
              onClick={saving ? undefined : onClose}
              disabled={saving}
              className="text-body-sm font-[var(--fw-semibold)] text-error-token transition-opacity hover:opacity-70 disabled:opacity-[var(--disabled-opacity)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="h-btn-primary rounded-[12px] bg-primary-token px-[var(--space-8)] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity disabled:opacity-[var(--disabled-opacity)]"
            >
              {saving ? "Creando..." : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
