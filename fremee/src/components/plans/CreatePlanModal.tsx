"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Globe, Lock, Plane, User, Users } from "lucide-react";
import LocationAutocomplete from "@/components/plans/LocationAutocomplete";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { listChats, type ChatListItem } from "@/services/api/repositories/chat.repository";

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
  visibility: "PÚBLICO" | "SOLO_GRUPO";
  inviteMode: "now" | "later";
  invitedFriendIds: string[];
};

export type EditPlanInitialValues = {
  title: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  visibility: CreatePlanPayload["visibility"];
};

type CreatePlanModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePlanPayload) => void | Promise<void>;
  currentUserId?: string;
  initialValues?: EditPlanInitialValues;
  mode?: "create" | "edit";
};

const DEFAULT_VISIBILITY: CreatePlanPayload["visibility"] = "SOLO_GRUPO";
const DEFAULT_INVITE_MODE: CreatePlanPayload["inviteMode"] = "later";
const TOTAL_STEPS = 4;

const STEP_META = [
  { title: "¿A dónde vas?", subtitle: "Elige tu próximo destino" },
  { title: "¿Cuándo?", subtitle: "Añade las fechas del viaje" },
  { title: "Dale un nombre", subtitle: "¿Cómo llamarás a este plan?" },
  { title: "Últimos detalles", subtitle: "Privacidad y participantes" },
];

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

// ─── Inline range calendar ────────────────────────────────────────────────────

function InlineRangeCalendar({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const todayStr = toDateInputValue(new Date());
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [phase, setPhase] = useState<"start" | "end">("start");
  const [monthCount, setMonthCount] = useState(4);
  const [desktopPage, setDesktopPage] = useState(0);

  const now = new Date();
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();

  const handleDayClick = (dateStr: string) => {
    if (dateStr < todayStr) return;
    if (phase === "start") {
      onChange(dateStr, dateStr);
      setPhase("end");
    } else {
      if (dateStr >= startDate) {
        onChange(startDate, dateStr);
        setPhase("start");
      } else {
        onChange(dateStr, dateStr);
        setPhase("end");
      }
    }
  };

  const hasRange = startDate !== endDate;
  const previewEnd = phase === "end" && hoverDate && hoverDate > startDate ? hoverDate : null;

  const renderMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDow = firstDay.getDay();
    startDow = (startDow + 6) % 7; // Mon=0 … Sun=6
    const monthLabel = format(firstDay, "MMMM yyyy", { locale: es });

    const cells: React.ReactNode[] = Array.from({ length: startDow }, (_, i) => (
      <div key={`pad-${i}`} />
    ));

    for (let i = 0; i < daysInMonth; i++) {
      const day = i + 1;
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const isPast = dateStr < todayStr;
      const isStart = dateStr === startDate;
      const isEnd = hasRange && dateStr === endDate;
      const inRange = hasRange && dateStr > startDate && dateStr < endDate;
      const inPreview = !!previewEnd && dateStr > startDate && dateStr < previewEnd;
      const isPreviewEnd = dateStr === previewEnd;

      cells.push(
        <div
          key={dateStr}
          className="relative flex h-12 items-center justify-center"
          onClick={() => !isPast && handleDayClick(dateStr)}
          onMouseEnter={() => !isPast && setHoverDate(dateStr)}
          onMouseLeave={() => setHoverDate(null)}
        >
          {/* Solid range strip */}
          {inRange && <div className="absolute inset-y-[4px] inset-x-0 bg-[var(--surface-2)]" />}

          {/* Preview range strip */}
          {!inRange && inPreview && (
            <div className="absolute inset-y-[4px] inset-x-0 bg-[var(--surface-2)] opacity-50" />
          )}

          {/* Start right-half connector */}
          {isStart && (hasRange || !!previewEnd) && (
            <div className={`absolute inset-y-[4px] left-1/2 right-0 bg-[var(--surface-2)] ${!hasRange ? "opacity-50" : ""}`} />
          )}

          {/* End left-half connector */}
          {(isEnd || isPreviewEnd) && (
            <div className={`absolute inset-y-[4px] left-0 right-1/2 bg-[var(--surface-2)] ${isPreviewEnd ? "opacity-50" : ""}`} />
          )}

          {/* Day circle */}
          <div
            className={[
              "relative z-10 flex size-10 items-center justify-center rounded-full text-[15px] font-[var(--fw-semibold)] transition-colors select-none",
              isStart || isEnd
                ? "bg-[var(--text-primary)] text-[var(--bg)]"
                : isPreviewEnd
                ? "bg-[var(--surface-2)] text-app"
                : isPast
                ? "text-muted opacity-25 cursor-default"
                : "cursor-pointer text-app hover:bg-[var(--surface-2)]",
            ].join(" ")}
          >
            {day}
          </div>
        </div>
      );
    }

    while (cells.length < 42) {
      cells.push(<div key={`tail-${year}-${month}-${cells.length}`} />);
    }

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
  };

  const mobileMonths = useMemo(
    () =>
      Array.from({ length: monthCount }, (_, i) => {
        const d = new Date(baseYear, baseMonth + i, 1);
        return { year: d.getFullYear(), month: d.getMonth() };
      }),
    [monthCount, baseYear, baseMonth]
  );

  const desktopMonths = useMemo(
    () =>
      [0, 1].map((offset) => {
        const d = new Date(baseYear, baseMonth + desktopPage * 2 + offset, 1);
        return { year: d.getFullYear(), month: d.getMonth() };
      }),
    [desktopPage, baseYear, baseMonth]
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Mobile: vertical scrollable months */}
      <div className="min-h-0 flex-1 space-y-[var(--space-8)] overflow-y-auto pr-1 md:hidden">
        {mobileMonths.map(({ year, month }) => renderMonth(year, month))}
        <button
          type="button"
          onClick={() => setMonthCount((c) => c + 4)}
          className="w-full py-[var(--space-4)] text-body-sm font-[var(--fw-semibold)] text-muted transition-colors hover:text-app"
        >
          Cargar más fechas
        </button>
      </div>

      {/* Desktop: two columns with side arrows */}
      <div className="hidden md:flex md:h-full md:items-start md:gap-[var(--space-3)]">
        <button
          type="button"
          onClick={() => setDesktopPage((p) => Math.max(0, p - 1))}
          disabled={desktopPage === 0}
          className="mt-[54px] flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface disabled:opacity-20"
          aria-label="Mes anterior"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-4">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="grid flex-1 grid-cols-2 gap-[var(--space-8)]">
          {desktopMonths.map(({ year, month }) => renderMonth(year, month))}
        </div>
        <button
          type="button"
          onClick={() => setDesktopPage((p) => p + 1)}
          className="mt-[54px] flex size-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-surface"
          aria-label="Mes siguiente"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-4">
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function CreatePlanModal({ open, onClose, onCreate, currentUserId, initialValues, mode = "create" }: CreatePlanModalProps) {
  const wasOpenRef = useRef(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const handleNextRef = useRef<() => void>(() => {});
  const handleSubmitRef = useRef<() => void | Promise<void>>(() => {});

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(addDays(new Date(), 1)));
  const [visibility, setVisibility] = useState<CreatePlanPayload["visibility"]>(DEFAULT_VISIBILITY);
  const [inviteMode, setInviteMode] = useState<CreatePlanPayload["inviteMode"]>(DEFAULT_INVITE_MODE);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [friends, setFriends] = useState<PublicUserProfileRow[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<ChatListItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [inviteTab, setInviteTab] = useState<"friends" | "groups">("friends");

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!location.trim()) return false;
    if (!startDate || !endDate) return false;
    return endDate >= startDate;
  }, [endDate, location, startDate, title]);

  const canContinue = useMemo(() => {
    if (step === 1) return location.trim().length > 0;
    if (step === 2) return !!(startDate && endDate && endDate >= startDate);
    if (step === 3) return title.trim().length > 0;
    return true;
  }, [step, location, startDate, endDate, title]);

  const resetForm = () => {
    const today = new Date();
    setStep(1);
    setTitle(initialValues?.title ?? "");
    setDescription(initialValues?.description ?? "");
    setLocation(initialValues?.location ?? "");
    setStartDate(initialValues?.startDate ?? toDateInputValue(today));
    setEndDate(initialValues?.endDate ?? toDateInputValue(addDays(today, 1)));
    setVisibility(initialValues?.visibility ?? DEFAULT_VISIBILITY);
    setInviteMode(DEFAULT_INVITE_MODE);
    setCoverImageUrl(initialValues?.coverImageUrl ?? null);
    setCoverFile(null);
    setSaving(false);
    setErrorMsg(null);
    setInvitedFriendIds(new Set());
    setSelectedGroupIds(new Set());
    setInviteTab("friends");
  };

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const resetTimer = window.setTimeout(() => {
      resetForm();
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        onClose();
        return;
      }

      if (e.key !== "Enter" || saving || e.defaultPrevented || e.isComposing) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest("button, a, [role='button'], [contenteditable='true']")) return;
      if (target instanceof HTMLTextAreaElement) return;

      e.preventDefault();
      if (step === TOTAL_STEPS) {
        void handleSubmitRef.current();
        return;
      }
      if (canContinue) {
        handleNextRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [canContinue, onClose, open, saving, step]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-create-plan-open", "true");
    return () => {
      document.body.style.overflow = prev;
      document.body.removeAttribute("data-create-plan-open");
    };
  }, [open]);

  useEffect(() => {
    if (inviteMode !== "now" || friends.length > 0) return;
    let cancelled = false;
    const load = async () => {
      setLoadingFriends(true);
      try {
        const activeFriends = await fetchActiveFriends();
        if (!cancelled) setFriends(activeFriends);
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoadingFriends(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [inviteMode, friends.length]);

  useEffect(() => {
    if (inviteMode !== "now" || groups.length > 0) return;
    let cancelled = false;
    const load = async () => {
      setLoadingGroups(true);
      try {
        const all = await listChats();
        if (!cancelled) setGroups(all.filter((c) => c.tipo === "GRUPO"));
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [inviteMode, groups.length]);

  useEffect(() => {
    return () => { if (coverImageUrl && isBlobUrl(coverImageUrl)) URL.revokeObjectURL(coverImageUrl); };
  }, [coverImageUrl]);

  if (!open) return null;

  const onPickCover = () => coverInputRef.current?.click();

  const onCoverChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (coverImageUrl && isBlobUrl(coverImageUrl)) URL.revokeObjectURL(coverImageUrl);
    setCoverImageUrl(URL.createObjectURL(file));
    setCoverFile(file);
  };

  function handleNext() {
    if (step < TOTAL_STEPS) setStep((s) => s + 1);
  }

  function handleBack() {
    if (step > 1) setStep((s) => s - 1);
  }

  async function handleSubmit() {
    if (!canSubmit || saving) {
      if (!canSubmit) setErrorMsg("Completa todos los campos para continuar.");
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
        startTime: null,
        endTime: null,
        startAllDay: true,
        endAllDay: true,
        coverImageUrl,
        coverFile,
        visibility,
        inviteMode,
        invitedFriendIds: [...invitedFriendIds].filter((id) => id !== currentUserId),
      });
    } catch (err) {
      const message =
        typeof err === "object" && err && "message" in err ? String(err.message) : "No se pudo crear el plan.";
      setErrorMsg(message);
      setSaving(false);
    }
  }

  handleNextRef.current = handleNext;
  handleSubmitRef.current = handleSubmit;

  const meta = STEP_META[step - 1];
  const desktopMaxWidth = step === 2 ? "840px" : step === 4 ? "620px" : "540px";
  const primaryFooterButtonClass =
    "rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85 disabled:opacity-[var(--disabled-opacity)]";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm md:items-center"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        className="relative flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg)] md:h-[min(760px,90dvh)] md:w-full md:max-w-[var(--create-plan-desktop-max-width)] md:rounded-[24px] md:shadow-elev-4 md:transition-[max-width] md:duration-300 md:[transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
        style={{ "--create-plan-desktop-max-width": desktopMaxWidth } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* ── Progress bar ── */}
        <div className="h-[3px] w-full shrink-0 bg-[var(--surface-2)]">
          <div
            className="h-full bg-primary-token transition-all duration-[400ms] [transition-timing-function:var(--ease-standard)]"
            style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* ── Top nav ── */}
        <div className="flex shrink-0 items-center justify-between px-[var(--space-5)] py-[var(--space-3)]">
          <button
            type="button"
            onClick={step === 1 ? onClose : handleBack}
            disabled={saving}
            className="flex size-9 items-center justify-center rounded-full text-app transition-colors hover:bg-surface disabled:opacity-50"
            aria-label={step === 1 ? "Cerrar" : "Volver"}
          >
            {step === 1 ? (
              <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="size-[18px]">
                <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <span className="text-caption font-[var(--fw-medium)] text-muted">{step} de {TOTAL_STEPS}</span>
          <div className="size-9" aria-hidden="true" />
        </div>

        {/* ── Content ── */}
        <div className={`flex-1 min-h-0 px-[var(--space-6)] pt-[var(--space-2)] ${step === 2 ? "flex flex-col overflow-hidden pb-[var(--space-6)]" : "overflow-y-scroll [scrollbar-gutter:stable] pb-[var(--space-8)]"}`}>
          <div className={`shrink-0 ${step === 2 ? "mb-[var(--space-5)] md:mb-[var(--space-6)]" : "mb-[var(--space-8)]"}`}>
            <h2 className="font-[var(--fw-bold)] leading-tight text-app" style={{ fontSize: "clamp(22px, 5vw, 28px)" }}>
              {meta.title}
            </h2>
            <p className="mt-[var(--space-1)] text-body-sm text-muted">{meta.subtitle}</p>
          </div>

          {/* ── Step 1: Destino ── */}
          {step === 1 && (
            <div className="group flex items-center gap-[var(--space-3)] border-b-2 border-app pb-[var(--space-3)] transition-colors duration-200 focus-within:border-primary-token">
              <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0 text-muted transition-colors group-focus-within:text-primary-token" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="9" r="2.5" fill="currentColor" />
              </svg>
              <LocationAutocomplete
                value={location}
                onChange={(v) => setLocation(v)}
                placeholder="París, Tokyo, Nueva York..."
                onCommit={canContinue ? handleNext : undefined}
                onEnter={canContinue ? handleNext : undefined}
              />
            </div>
          )}

          {/* ── Step 2: Fechas ── */}
          {step === 2 && (
            <div className="min-h-0 flex-1">
              <InlineRangeCalendar
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => { setStartDate(start); setEndDate(end); }}
              />
            </div>
          )}

          {/* ── Step 3: Nombre + portada ── */}
          {step === 3 && (
            <div className="space-y-[var(--space-5)]">
              <div className="flex items-center gap-[var(--space-3)] border-b-2 border-app pb-[var(--space-2)]">
                <Plane className="size-5 shrink-0 text-muted" strokeWidth={1.5} aria-hidden="true" />
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Verano en Italia"
                  autoFocus
                  className="w-full flex-1 bg-transparent text-[22px] font-[var(--fw-semibold)] text-app shadow-none outline-none ring-0 placeholder:text-muted focus:outline-none focus:ring-0 focus:shadow-none focus-visible:shadow-none"
                />
              </div>
              <div className="border-b border-app pb-[var(--space-2)]">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción breve (opcional)"
                  className="w-full bg-transparent text-body-sm text-app shadow-none outline-none ring-0 placeholder:text-muted focus:outline-none focus:ring-0 focus:shadow-none focus-visible:shadow-none"
                />
              </div>
              {coverImageUrl ? (
                <div className="relative h-[160px] w-full overflow-hidden rounded-[16px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImageUrl} alt="Portada" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={onPickCover}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 text-body-sm font-[var(--fw-semibold)] text-white transition-colors hover:bg-black/45"
                  >
                    Cambiar foto
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onPickCover}
                  className="flex w-full items-center gap-[var(--space-3)] rounded-[16px] border-2 border-dashed border-app p-[var(--space-4)] text-muted transition-colors hover:border-[var(--border-strong)] hover:text-app"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-5 shrink-0" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="3" />
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                    <path d="M3 16l5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-body-sm font-[var(--fw-medium)]">Añadir foto de portada (opcional)</span>
                </button>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverChange} className="hidden" />
            </div>
          )}

          {/* ── Step 4: Detalles ── */}
          {step === 4 && (
            <div className="space-y-[var(--space-6)]">
              <div>
                <p className="mb-[var(--space-3)] text-body-sm font-[var(--fw-semibold)] text-app">Visibilidad</p>
                <div className="grid grid-cols-2 gap-[var(--space-3)]">
                  {([
                    {
                      value: "PÚBLICO" as const,
                      label: "Público",
                      description: "Visible en el feed para todos",
                      Icon: Globe,
                    },
                    {
                      value: "SOLO_GRUPO" as const,
                      label: "Privado",
                      description: "Solo los invitados pueden verlo",
                      Icon: Lock,
                    },
                  ]).map(({ value, label, description, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setVisibility(value)}
                      className={`flex flex-col items-start gap-[var(--space-2)] rounded-[16px] border-2 p-[var(--space-4)] text-left transition-colors ${
                        visibility === value ? "border-[var(--primary)]/40 bg-[var(--primary)]/10" : "border-app bg-app hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Icon className={`${visibility === value ? "text-primary-token" : "text-muted"} size-[18px] shrink-0`} strokeWidth={1.7} />
                        <span className="text-body-sm font-[var(--fw-semibold)] text-app">{label}</span>
                      </div>
                      <span className="text-caption text-muted">{description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-[var(--space-3)] text-body-sm font-[var(--fw-semibold)] text-app">Tipo de plan</p>
                <div className="grid grid-cols-2 gap-[var(--space-3)]">
                  {([
                    {
                      value: "later" as const,
                      label: "Individual",
                      description: "Solo tú de momento",
                      Icon: User,
                    },
                    {
                      value: "now" as const,
                      label: "Grupal",
                      description: "Invita amigos ahora",
                      Icon: Users,
                    },
                  ]).map(({ value, label, description, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInviteMode(value)}
                      className={`flex flex-col items-start gap-[var(--space-2)] rounded-[16px] border-2 p-[var(--space-4)] text-left transition-colors ${
                        inviteMode === value ? "border-[var(--primary)]/40 bg-[var(--primary)]/10" : "border-app bg-app hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Icon className={`${inviteMode === value ? "text-primary-token" : "text-muted"} size-[18px] shrink-0`} strokeWidth={1.7} />
                        <span className="text-body-sm font-[var(--fw-semibold)] text-app">{label}</span>
                      </div>
                      <span className="text-caption text-muted">{description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="grid transition-all duration-[250ms] ease-out"
                style={{ gridTemplateRows: inviteMode === "now" ? "1fr" : "0fr", opacity: inviteMode === "now" ? 1 : 0 }}
              >
                <div className="overflow-hidden">
                  {/* ── Tabs ── */}
                  <div className="mb-[var(--space-3)] flex gap-[2px] rounded-[12px] bg-[var(--surface-2)] p-[3px]">
                    {(["friends", "groups"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setInviteTab(tab)}
                        className={`flex-1 rounded-[9px] py-[6px] text-caption font-[var(--fw-semibold)] transition-colors ${
                          inviteTab === tab
                            ? "bg-[var(--bg)] text-app shadow-elev-1"
                            : "text-muted hover:text-app"
                        }`}
                      >
                        {tab === "friends" ? "Amigos" : "Grupos"}
                        {tab === "friends" && invitedFriendIds.size > 0 && (
                          <span className="ml-[5px] inline-flex size-[16px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[14px] text-contrast-token">
                            {invitedFriendIds.size}
                          </span>
                        )}
                        {tab === "groups" && selectedGroupIds.size > 0 && (
                          <span className="ml-[5px] inline-flex size-[16px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[14px] text-contrast-token">
                            {selectedGroupIds.size}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* ── Friends list ── */}
                  {inviteTab === "friends" && (
                    loadingFriends ? (
                      <div className="flex justify-center py-4">
                        <div className="size-[18px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
                      </div>
                    ) : friends.length === 0 ? (
                      <p className="text-body-sm text-muted">No tienes amigos para invitar.</p>
                    ) : (
                      <div className="max-h-[calc(3*52px)] overflow-y-auto [scrollbar-gutter:stable]">
                        {friends.map((friend) => {
                          const selected = invitedFriendIds.has(friend.id);
                          const avatarLabel = (friend.nombre.trim()[0] || "?").toUpperCase();
                          return (
                            <button
                              key={friend.id}
                              type="button"
                              onClick={() => {
                                setInvitedFriendIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(friend.id)) next.delete(friend.id);
                                  else next.add(friend.id);
                                  return next;
                                });
                              }}
                              className={`flex h-[52px] w-full items-center gap-[var(--space-3)] rounded-[8px] px-2 transition-colors hover:bg-surface ${selected ? "bg-surface" : ""}`}
                            >
                              {friend.profile_image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={friend.profile_image} alt={friend.nombre} className="size-[32px] rounded-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="flex size-[32px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[14px] font-[var(--fw-semibold)] text-contrast-token">
                                  {avatarLabel}
                                </div>
                              )}
                              <span className="flex-1 text-left text-body-sm font-[var(--fw-medium)]">{friend.nombre}</span>
<div className={`flex size-[20px] items-center justify-center rounded-full border-2 transition-colors ${selected ? "border-[var(--text-primary)] bg-[var(--text-primary)]" : "border-app"}`}>
                                {selected && (
                                  <svg viewBox="0 0 24 24" fill="none" className="size-[12px]" aria-hidden="true">
                                    <path d="M5 13l4 4L19 7" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* ── Groups list ── */}
                  {inviteTab === "groups" && (
                    loadingGroups ? (
                      <div className="flex justify-center py-4">
                        <div className="size-[18px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
                      </div>
                    ) : groups.length === 0 ? (
                      <p className="text-body-sm text-muted">No perteneces a ningún grupo.</p>
                    ) : (
                      <div className="max-h-[calc(3*52px)] overflow-y-auto [scrollbar-gutter:stable]">
                        {groups.map((group) => {
                          const selected = selectedGroupIds.has(group.chat_id);
                          const avatarLabel = (group.nombre?.trim()[0] || "G").toUpperCase();
                          const memberCount = group.miembros.length;
                          return (
                            <button
                              key={group.chat_id}
                              type="button"
                              onClick={() => {
                                const groupMemberIds = group.miembros
                                  .map((m) => m.id)
                                  .filter((id) => id !== currentUserId);
                                const isSelecting = !selectedGroupIds.has(group.chat_id);
                                setSelectedGroupIds((prev) => {
                                  const next = new Set(prev);
                                  if (isSelecting) next.add(group.chat_id);
                                  else next.delete(group.chat_id);
                                  return next;
                                });
                                setInvitedFriendIds((prev) => {
                                  const next = new Set(prev);
                                  if (isSelecting) {
                                    groupMemberIds.forEach((id) => next.add(id));
                                  } else {
                                    // only remove members not in any other selected group
                                    const otherGroupIds = new Set(
                                      [...selectedGroupIds].filter((gid) => gid !== group.chat_id)
                                    );
                                    const keptByOtherGroup = new Set(
                                      [...otherGroupIds].flatMap((gid) => {
                                        const g = groups.find((gr) => gr.chat_id === gid);
                                        return (g?.miembros ?? []).map((m) => m.id);
                                      })
                                    );
                                    groupMemberIds.forEach((id) => {
                                      if (!keptByOtherGroup.has(id)) next.delete(id);
                                    });
                                  }
                                  return next;
                                });
                              }}
                              className={`flex h-[52px] w-full items-center gap-[var(--space-3)] rounded-[8px] px-2 transition-colors hover:bg-surface ${selected ? "bg-surface" : ""}`}
                            >
                              {group.foto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={group.foto} alt={group.nombre ?? "Grupo"} className="size-[32px] rounded-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="flex size-[32px] items-center justify-center rounded-full bg-[var(--surface-2)] text-[14px] font-[var(--fw-semibold)] text-app">
                                  {avatarLabel}
                                </div>
                              )}
                              <span className="flex-1 text-left text-body-sm font-[var(--fw-medium)]">{group.nombre ?? "Grupo"}</span>
                              <span className="text-caption text-muted">{memberCount} miembros</span>
                              <div className={`flex size-[20px] items-center justify-center rounded-full border-2 transition-colors ${selected ? "border-[var(--text-primary)] bg-[var(--text-primary)]" : "border-app"}`}>
                                {selected && (
                                  <svg viewBox="0 0 24 24" fill="none" className="size-[12px]" aria-hidden="true">
                                    <path d="M5 13l4 4L19 7" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>

              {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-app px-[var(--space-5)] py-[var(--space-4)]">
          {step === 2 ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const today = new Date();
                  setStartDate(toDateInputValue(today));
                  setEndDate(toDateInputValue(addDays(today, 1)));
                }}
                className="text-body-sm font-[var(--fw-semibold)] text-app underline underline-offset-2 transition-opacity hover:opacity-60"
              >
                Restablecer
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="rounded-[14px] bg-[var(--text-primary)] px-[var(--space-8)] py-[12px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-85"
              >
                Siguiente
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="min-w-[88px]" aria-hidden="true" />
              <button
                type="button"
                onClick={step === TOTAL_STEPS ? handleSubmit : handleNext}
                disabled={!canContinue || saving}
                className={primaryFooterButtonClass}
              >
                {step === TOTAL_STEPS ? (saving ? "Guardando..." : mode === "edit" ? "Guardar cambios" : "Crear plan") : "Continuar"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
