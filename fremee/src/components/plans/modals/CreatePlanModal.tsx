"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  Clock,
  Globe,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Minus,
  Search,
  Sun,
  X,
} from "lucide-react";
import LocationAutocomplete, { type PickedPlace } from "@/components/plans/LocationAutocomplete";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { listChats, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";
import { Avatar } from "@/components/ui/Avatar";
import { TimePicker } from "@/components/ui/TimePicker";
import { PhoneRangeSheet, RangeCalendar, dayLabel, rangeLabel } from "@/components/ui/DateRangePicker";
import { useIsPhone } from "@/components/chat/bitacora/Sheet";
import type { PlanWhen } from "@/lib/plan-dates";
import { parseAmount } from "@/lib/money-input";

const PAGE = 8;

/** «Ver más» al final de una lista larga: enseña otros 8. */
function MoreButton({ rest, onClick }: { rest: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-[4px] flex min-h-[44px] w-full items-center justify-center text-[14px] font-[var(--fw-semibold)] text-[var(--primary)]">
      Ver {Math.min(PAGE, rest)} más
    </button>
  );
}

/* ─── Contract with the callers (useCreatePlan, PlanPageClient) ─────────────── */

export type CreatePlanPayload = {
  title: string;
  description: string;
  /** "" = no place yet (stored as «Por decidir»). */
  location: string;
  when: PlanWhen;
  coverImageUrl: string | null;
  coverFile: File | null;
  visibility: "PÚBLICO" | "SOLO_GRUPO";
  /** People to invite (the creator is never in it). */
  invited: { id: string; name: string }[];
  /** Presupuesto del grupo para todo el viaje; null si no se pone. Solo al crear. */
  budget?: number | null;
};

export type EditPlanInitialValues = {
  title: string;
  description: string;
  location: string;
  when: PlanWhen;
  coverImageUrl: string | null;
  visibility: CreatePlanPayload["visibility"];
};

/** Dates to start from when creating («Nuevo plan en estas fechas» in the calendar), YYYY-MM-DD. */
export type CreatePlanDates = { startDate: string; endDate: string };

type CreatePlanModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePlanPayload) => void | Promise<unknown>;
  currentUserId?: string;
  initialValues?: EditPlanInitialValues;
  initialDates?: CreatePlanDates;
  mode?: "create" | "edit";
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

const STEPS = ["Qué y dónde", "Cuándo", "Detalles"] as const;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const plusDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const fromMin = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** «Sáb 21» (dayLabel without the month). */
const dayNoMonth = (s: string) => dayLabel(s).replace(/ \S+$/, "");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const firstName = (n: string) => n.trim().split(/\s+/)[0] || n;

function durationText(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

/** «Ciudad · Portugal» from Google's place types. */
function placeKind(types: string[]) {
  const has = (t: string) => types.includes(t);
  if (has("locality") || has("postal_town")) return "Ciudad";
  if (has("country")) return "País";
  if (types.some((t) => t.startsWith("administrative_area"))) return "Región";
  if (has("airport")) return "Aeropuerto";
  if (has("lodging")) return "Alojamiento";
  if (has("restaurant") || has("cafe") || has("bar")) return "Restaurante";
  return "";
}
const isDestination = (types: string[]) =>
  types.some((t) => t === "locality" || t === "postal_town" || t === "country" || t.startsWith("administrative_area") || t === "colloquial_area");

function defaultWhen(dates?: CreatePlanDates): PlanWhen {
  const today = iso(new Date());
  return {
    startDate: dates?.startDate ?? today,
    endDate: dates?.endDate ?? plusDays(today, 1),
    allDay: true,
    startTime: "",
    endTime: "",
    endNextDay: false,
  };
}

/** The first o'clock hour after now (max 22:00), for «Con horario». */
function nextHour() {
  return fromMin(Math.min(22 * 60, (new Date().getHours() + 1) * 60));
}

type Person = { id: string; name: string; image: string | null };

/* ─── Small pieces ───────────────────────────────────────────────────────────── */

const FIELD =
  "flex h-[46px] items-center gap-[10px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface-2)] pl-[12px] pr-[4px] focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_1px_var(--primary)]";
const FILL =
  "inline-flex h-[46px] shrink-0 items-center justify-center gap-[8px] whitespace-nowrap rounded-[8px] bg-[var(--chat-accent-text)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-90 disabled:cursor-progress disabled:opacity-75";
const TEXT_BTN =
  "inline-flex min-h-[44px] shrink-0 items-center gap-[6px] whitespace-nowrap text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] disabled:opacity-60";
const ICON_BTN = "flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface-2)] disabled:opacity-40";

function Section({ title, extra, children, htmlFor }: { title: string; extra?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <div className="mb-[8px] mt-[20px] flex items-baseline gap-[8px]">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[14px] font-[var(--fw-semibold)] text-app">{title}</label>
        ) : (
          <b className="text-[14px] font-[var(--fw-semibold)] text-app">{title}</b>
        )}
        {extra && <span className="text-[12px] text-muted">{extra}</span>}
      </div>
      {children}
    </div>
  );
}

function Summary({ items }: { items: { icon: React.ReactNode; text: string }[] }) {
  if (!items.length) return null;
  return (
    <div aria-label="Resumen" className="mt-[10px] flex flex-wrap gap-[6px]">
      {items.map((it) => (
        <span key={it.text} className="inline-flex h-[26px] max-w-full items-center gap-[5px] rounded-full bg-[var(--surface-2)] px-[10px] text-[12px] font-[var(--fw-semibold)] text-app">
          <span aria-hidden className="flex shrink-0 text-muted">{it.icon}</span>
          <span className="truncate">{it.text}</span>
        </span>
      ))}
    </div>
  );
}

function CheckBox({ state }: { state: "on" | "off" | "mixed" | "lock" }) {
  return (
    <span
      aria-hidden
      className={`ml-auto flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border-2 ${
        state === "on" || state === "mixed" ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]"
        : state === "lock" ? "border-[var(--surface-2)] bg-[var(--surface-2)] text-muted"
        : "border-[var(--border-strong)]"}`}
    >
      {state === "mixed" ? <Minus className="size-[14px]" strokeWidth={3} /> : state !== "off" && <Check className="size-[14px]" strokeWidth={3} />}
    </span>
  );
}

/* ─── The modal ──────────────────────────────────────────────────────────────── */

/**
 * «Nuevo plan» (canvas «Frimee · Chat · Bitácora», boards cpn-*): three named steps — Qué y dónde,
 * Cuándo, Detalles — in a sheet on phones and a 560 px window on desktop. Also edits a plan
 * (mode="edit": no «Quién va», «Guardar cambios»).
 */
export default function CreatePlanModal({ open, onClose, onCreate, currentUserId, initialValues, initialDates, mode = "create" }: CreatePlanModalProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose, open);
  const phone = useIsPhone();
  const editing = mode === "edit";

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [titleError, setTitleError] = useState(false);
  const [location, setLocation] = useState("");
  const [place, setPlace] = useState<{ main: string; secondary: string } | null>(null);
  const [when, setWhen] = useState<PlanWhen>(() => defaultWhen(initialDates));
  const [whenError, setWhenError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [budgetText, setBudgetText] = useState("");
  /** Cuántos amigos y grupos se enseñan: 8 y «Ver más» suma otros 8. */
  const [shown, setShown] = useState({ friends: PAGE, groups: PAGE });
  const [visibility, setVisibility] = useState<CreatePlanPayload["visibility"]>("SOLO_GRUPO");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [calFirst, setCalFirst] = useState<string | null>(null);

  const [tab, setTab] = useState<"friends" | "groups">("friends");
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<PublicUserProfileRow[] | null>(null);
  const [groups, setGroups] = useState<ChatListItem[] | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());
  /** The form as it opened, to ask before throwing changes away. */
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const wasOpenRef = useRef(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const snapshot = JSON.stringify({ title, location, when, description, visibility, coverImageUrl, invited: [...invited].sort(), budget: budgetText.trim() });

  /* Reset every time it opens. */
  const reset = useCallback(() => {
    const v = initialValues;
    const loc = v?.location ?? "";
    setStep(1);
    setTitle(v?.title ?? "");
    setSuggestedTitle(null);
    setTitleError(false);
    setLocation(loc);
    setPlace(loc ? { main: loc.split(",")[0].trim(), secondary: loc.split(",").slice(1).join(",").trim() } : null);
    setWhen(v?.when ?? defaultWhen(initialDates));
    setWhenError(null);
    setDescription(v?.description ?? "");
    setBudgetText("");
    setShown({ friends: PAGE, groups: PAGE });
    setVisibility(v?.visibility ?? "SOLO_GRUPO");
    setCoverImageUrl(v?.coverImageUrl ?? null);
    setCoverFile(null);
    setSaving(false);
    setFailed(false);
    setDiscardOpen(false);
    setDatesOpen(false);
    setCalFirst(null);
    setTab("friends");
    setQuery("");
    setInvited(new Set());
    setInitialSnapshot(JSON.stringify({
      title: v?.title ?? "", location: loc, when: v?.when ?? defaultWhen(initialDates), description: v?.description ?? "",
      visibility: v?.visibility ?? "SOLO_GRUPO", coverImageUrl: v?.coverImageUrl ?? null, invited: [], budget: "",
    }));
  }, [initialValues, initialDates]);

  useEffect(() => {
    if (!open) { wasOpenRef.current = false; return; }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    const t = window.setTimeout(reset, 0);
    return () => window.clearTimeout(t);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    document.body.setAttribute("data-create-plan-open", "true");
    return () => document.body.removeAttribute("data-create-plan-open");
  }, [open]);

  useEffect(() => () => { if (coverImageUrl?.startsWith("blob:")) URL.revokeObjectURL(coverImageUrl); }, [coverImageUrl]);

  /* People to invite: loaded when «Detalles» is first shown. */
  useEffect(() => {
    if (!open || editing || step !== 3) return;
    let cancelled = false;
    if (friends === null) {
      fetchActiveFriends()
        .then((r) => { if (!cancelled) setFriends(r); })
        .catch((e: unknown) => { console.error("[nuevo-plan] friends", e); if (!cancelled) setFriends([]); });
    }
    if (groups === null) {
      listChats()
        .then((r) => { if (!cancelled) setGroups(r.filter((c) => c.tipo === "GRUPO")); })
        .catch((e: unknown) => { console.error("[nuevo-plan] groups", e); if (!cancelled) setGroups([]); });
    }
    return () => { cancelled = true; };
  }, [open, editing, step, friends, groups]);

  /* Everyone who can be invited, by id (friends + members of my groups). */
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const g of groups ?? []) for (const m of g.miembros) map.set(m.id, { id: m.id, name: m.nombre, image: m.profile_image });
    for (const f of friends ?? []) map.set(f.id, { id: f.id, name: f.nombre, image: f.profile_image });
    if (currentUserId) map.delete(currentUserId);
    return map;
  }, [friends, groups, currentUserId]);

  // Focus the step title when the step changes (screen readers hear where they are).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    if (step > 1) headingRef.current?.focus();
  }, [step]);

  const hasChanges = Boolean(coverFile) || (initialSnapshot !== "" && snapshot !== initialSnapshot);

  const requestDismiss = useCallback(() => {
    if (saving) return;
    if (hasChanges) { setDiscardOpen(true); return; }
    requestClose();
  }, [hasChanges, requestClose, saving]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented && !discardOpen && !datesOpen) requestDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestDismiss, discardOpen, datesOpen]);

  if (!open) return null;

  /* ── validation ── */

  const oneDay = when.startDate === when.endDate;
  const endBeforeStart =
    !when.allDay && oneDay && !when.endNextDay && Boolean(when.startTime && when.endTime) && toMin(when.endTime) <= toMin(when.startTime);

  function checkStep1() {
    if (title.trim()) return true;
    setTitleError(true);
    setStep(1);
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
    return false;
  }
  function checkStep2() {
    if (!when.startDate || !when.endDate) { setWhenError("Elige las fechas del plan."); setStep(2); return false; }
    if (!when.allDay && (!when.startTime || !when.endTime)) { setWhenError("Elige la hora de inicio y la de fin."); setStep(2); return false; }
    if (endBeforeStart) { setStep(2); return false; }
    setWhenError(null);
    return true;
  }

  function next() {
    if (step === 1 && !checkStep1()) return;
    if (step === 2 && !checkStep2()) return;
    setStep((s) => Math.min(3, s + 1));
  }

  async function submit() {
    if (saving) return;
    if (!checkStep1() || !checkStep2()) return;
    if (!editing && budgetInvalid) {
      document.getElementById("np-presupuesto")?.focus();
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        when: when.allDay ? { ...when, startTime: "", endTime: "", endNextDay: false } : when,
        coverImageUrl,
        coverFile,
        visibility,
        invited: [...invited].map((id) => ({ id, name: people.get(id)?.name ?? "" })).filter((p) => p.name),
        budget: editing ? null : parseAmount(budgetText),
      });
      setSaving(false);
      requestClose();
    } catch (error) {
      console.error("[nuevo-plan] save failed:", (error as { message?: string })?.message ?? error);
      setSaving(false);
      setFailed(true);
    }
  }

  /* ── field handlers ── */

  const onTitle = (v: string) => {
    setTitle(v);
    if (v.trim()) setTitleError(false);
    if (suggestedTitle && v !== suggestedTitle) setSuggestedTitle(null);
  };

  const onPick = (p: PickedPlace) => {
    setPlace({ main: p.main, secondary: [placeKind(p.types), p.secondary].filter(Boolean).join(" · ") });
    if (!editing && isDestination(p.types) && (!title.trim() || title === suggestedTitle)) {
      const s = `Viaje a ${p.main}`;
      setTitle(s);
      setSuggestedTitle(s);
      setTitleError(false);
    }
  };

  const removePlace = () => {
    setPlace(null);
    setLocation("");
    if (suggestedTitle && title === suggestedTitle) { setTitle(""); setSuggestedTitle(null); }
  };

  const setDates = (a: string, b: string) => {
    setWhen((w) => ({ ...w, startDate: a, endDate: b, endNextDay: a === b ? w.endNextDay : false }));
    if (a && b) setWhenError(null);
  };

  const setAllDay = (allDay: boolean) => {
    setWhen((w) => {
      if (allDay || (w.startTime && w.endTime)) return { ...w, allDay };
      const start = nextHour();
      const endM = toMin(start) + 120;
      return { ...w, allDay, startTime: start, endTime: fromMin(endM), endNextDay: w.startDate === w.endDate && endM >= 24 * 60 };
    });
    setWhenError(null);
  };

  const setStart = (v: string) => {
    setWhen((w) => {
      if (!w.startTime || !w.endTime || w.startDate !== w.endDate) return { ...w, startTime: v };
      // Moving the start keeps the duration (as in «Añadir al plan»).
      const dur = toMin(w.endTime) + (w.endNextDay ? 1440 : 0) - toMin(w.startTime);
      const endM = toMin(v) + (dur > 0 ? dur : 60);
      return { ...w, startTime: v, endTime: fromMin(endM % 1440), endNextDay: endM >= 1440 };
    });
  };

  const setEnd = (v: string, o?: { nextDay?: boolean }) => {
    setWhen((w) => ({ ...w, endTime: v, endNextDay: w.startDate === w.endDate ? Boolean(o?.nextDay) : false }));
  };

  const onCoverChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCoverImageUrl(URL.createObjectURL(file));
    setCoverFile(file);
  };

  const toggle = (ids: string[], on: boolean) =>
    setInvited((prev) => {
      const n = new Set(prev);
      for (const id of ids) { if (on) n.add(id); else n.delete(id); }
      return n;
    });

  /* ── texts ── */

  const datesText = when.startDate && when.endDate ? rangeLabel(when.startDate, when.endDate) : "";
  const dayCount = when.startDate && when.endDate ? Math.round((parse(when.endDate).getTime() - parse(when.startDate).getTime()) / 86_400_000) + 1 : 0;
  const hoursText = when.allDay ? "Todo el día" : when.startTime && when.endTime ? `${when.startTime} – ${when.endTime}${when.endNextDay ? " +1" : ""}` : "";
  const durationMin = !when.allDay && oneDay && when.startTime && when.endTime && !endBeforeStart
    ? toMin(when.endTime) + (when.endNextDay ? 1440 : 0) - toMin(when.startTime) : 0;
  const placeText = place?.main || location.trim();
  const peopleCount = invited.size;

  const summary2 = placeText ? [{ icon: <MapPin className="size-[13px]" />, text: placeText }] : [];
  const summary3 = [
    ...summary2,
    ...(datesText ? [{ icon: <CalendarDays className="size-[13px]" />, text: datesText }] : []),
    ...(hoursText ? [{ icon: when.allDay ? <Sun className="size-[13px]" /> : <Clock className="size-[13px]" />, text: hoursText }] : []),
  ];

  /* ── step bodies ── */

  const step1 = (
    <div>
      <label htmlFor="np-nombre" className="block text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Nombre del plan</label>
      <div className={`flex min-h-[60px] items-center gap-[8px] ${titleError ? "border-b-2 border-[var(--error)]" : "border-b border-[var(--border-strong)] focus-within:border-b-2 focus-within:border-[var(--primary)]"}`}>
        <input
          id="np-nombre"
          ref={titleInputRef}
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); next(); } }}
          placeholder="Escapada a Lisboa"
          autoFocus={!phone}
          maxLength={120}
          aria-invalid={titleError || undefined}
          aria-describedby={titleError ? "np-nombre-error" : undefined}
          className="h-[58px] min-w-0 flex-1 bg-transparent [font-family:var(--font-display-face)] text-[32px] tracking-[-0.01em] text-app outline-none placeholder:text-muted"
        />
        {suggestedTitle && title === suggestedTitle && (
          <span className="inline-flex h-[24px] shrink-0 items-center gap-[5px] rounded-full border border-dashed border-[var(--chat-me-border)] px-[8px] text-[12px] font-[var(--fw-semibold)] text-muted">
            <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden><path d="M12 2.5 L21.5 12 L12 21.5 L2.5 12 Z" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" /></svg>
            Sugerido
          </span>
        )}
      </div>
      {titleError && (
        <p id="np-nombre-error" role="alert" className="mt-[8px] flex items-start gap-[8px] text-[13px] leading-[1.4] text-[var(--error)]">
          <CircleAlert aria-hidden className="mt-[1px] size-[16px] shrink-0" />Ponle un nombre al plan.
        </p>
      )}

      <Section title="Dónde" extra="opcional" htmlFor={place ? undefined : "np-donde"}>
        {place ? (
          <div className="flex min-h-[60px] items-center gap-[12px] rounded-[8px] border border-[var(--border-strong)] py-[8px] pl-[12px] pr-[4px]">
            <span aria-hidden className="flex size-[36px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--chat-me)] text-[var(--chat-accent-text)]">
              <MapPin className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{place.main}</span>
              {place.secondary && <span className="block truncate text-[12px] text-muted">{place.secondary}</span>}
            </span>
            <button type="button" onClick={removePlace} aria-label={`Quitar ${place.main}`} title="Quitar" className={`${ICON_BTN} text-muted`}>
              <X className="size-[18px]" aria-hidden />
            </button>
          </div>
        ) : (
          <div className={FIELD}>
            <Search aria-hidden className="size-[18px] shrink-0 text-muted" />
            <LocationAutocomplete
              inputId="np-donde"
              value={location}
              onChange={(v) => setLocation(v)}
              onPick={onPick}
              placeholder="Ciudad, sitio o dirección"
              dropdownVariant="surface"
              inputClassName="h-[44px] w-full min-w-0 bg-transparent text-[15px] text-app outline-none placeholder:text-muted"
            />
          </div>
        )}
      </Section>
    </div>
  );

  const pickInline = (d: string) => {
    if (!calFirst || d < calFirst) { setCalFirst(d); return; }
    setDates(calFirst, d);
    setCalFirst(null);
  };

  const step2 = (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="[font-family:var(--font-display-face)] text-[32px] leading-[1.15] text-app outline-none">¿Cuándo?</h2>
      <Summary items={summary2} />

      {phone ? (
        <Section title="Fechas">
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Fechas: ${datesText || "sin elegir"}. Cambiar`}
            onClick={() => setDatesOpen(true)}
            className="flex min-h-[52px] w-full items-center gap-[10px] rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface-2)] pl-[12px] pr-[4px] text-left"
          >
            <CalendarDays aria-hidden className="size-[18px] shrink-0 text-muted" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-[var(--fw-semibold)] tabular-nums text-app">{datesText || "Elige las fechas"}</span>
              {dayCount > 0 && <span className="block text-[12px] text-muted">{dayCount} {dayCount === 1 ? "día" : "días"}</span>}
            </span>
            <span aria-hidden className="flex w-[32px] justify-center text-muted"><ChevronDown className="size-[18px]" /></span>
          </button>
        </Section>
      ) : (
        <div>
          <div className="mb-[8px] mt-[20px]">
            <b className="text-[14px] font-[var(--fw-semibold)] text-app">Fechas</b>
          </div>
          <div className="flex justify-center">
            <div className="w-[332px]">
              <RangeCalendar a={when.startDate} b={when.endDate} first={calFirst} hover onPick={pickInline} onEscape={() => setCalFirst(null)} />
            </div>
          </div>
        </div>
      )}

      <Section title="Horario">
        <div role="radiogroup" aria-label="Horario" className="grid grid-cols-2 gap-[4px] rounded-[8px] bg-[var(--surface-2)] p-[4px]">
          {([
            { allDay: true, label: "Todo el día", Icon: Sun },
            { allDay: false, label: "Con horario", Icon: Clock },
          ] as const).map(({ allDay, label, Icon }) => {
            const on = when.allDay === allDay;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setAllDay(allDay)}
                className={`flex h-[44px] items-center justify-center gap-[8px] rounded-[6px] border text-[14px] ${
                  on ? "border-[var(--border-strong)] bg-[var(--bg)] font-[var(--fw-semibold)] text-app" : "border-transparent font-[var(--fw-medium)] text-muted"}`}
              >
                <Icon aria-hidden className="size-[16px]" />{label}
              </button>
            );
          })}
        </div>

        {when.allDay ? (
          when.startDate && when.endDate && (
            <p className="mt-[8px] text-[13px] text-muted">
              {oneDay
                ? `El ${lower(dayLabel(when.startDate))}, el día entero.`
                : `Del ${lower(parse(when.startDate).getMonth() === parse(when.endDate).getMonth() ? dayNoMonth(when.startDate) : dayLabel(when.startDate))} al ${lower(dayLabel(when.endDate))}, días enteros.`}
            </p>
          )
        ) : (
          <>
            <div className="mt-[12px] flex gap-[12px]">
              <div className="min-w-0 flex-1">
                <p className="mb-[6px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Inicio</p>
                <TimePicker
                  variant="box"
                  label={oneDay ? "Hora de inicio" : `Hora de inicio · ${dayLabel(when.startDate)}`}
                  subtitle={[when.startDate ? dayLabel(when.startDate) : "", title.trim()].filter(Boolean).join(" · ")}
                  value={when.startTime}
                  onChange={setStart}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-[6px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-muted">Fin</p>
                <TimePicker
                  variant="box"
                  label={oneDay ? "Hora de fin" : `Hora de fin · ${dayLabel(when.endDate)}`}
                  subtitle={[when.endDate ? dayLabel(when.endDate) : "", title.trim()].filter(Boolean).join(" · ")}
                  value={when.endTime}
                  invalid={endBeforeStart}
                  onChange={setEnd}
                  nextDayBefore={oneDay && when.startTime ? when.startTime : undefined}
                />
                {durationMin > 0 && (
                  <p className="mt-[6px] text-[12px] text-muted">
                    {when.endNextDay ? `${dayNoMonth(plusDays(when.startDate, 1))} · dura ${durationText(durationMin)}` : `Dura ${durationText(durationMin)}`}
                  </p>
                )}
              </div>
            </div>
            {!oneDay && when.startTime && when.endTime && (
              <p className="mt-[8px] text-[13px] text-muted">
                Empieza el {lower(dayLabel(when.startDate))} a las {when.startTime} y acaba el {lower(dayLabel(when.endDate))} a las {when.endTime}.
              </p>
            )}
            {endBeforeStart && (
              <div role="alert" className="mt-[8px] flex items-start gap-[8px] text-[13px] leading-[1.4] text-[var(--error)]">
                <CircleAlert aria-hidden className="mt-[1px] size-[16px] shrink-0" />
                <div>
                  La hora de fin es anterior a la de inicio.
                  <div className="mt-[2px]">
                    <button type="button" onClick={() => setWhen((w) => ({ ...w, endNextDay: true }))} className="min-h-[36px] text-[13px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">
                      Que acabe el {lower(dayNoMonth(plusDays(when.startDate, 1)))} (+1)
                    </button>
                    <span className="text-[12px] text-muted"> o cambia la hora de fin</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {whenError && (
          <p role="alert" className="mt-[8px] flex items-start gap-[8px] text-[13px] leading-[1.4] text-[var(--error)]">
            <CircleAlert aria-hidden className="mt-[1px] size-[16px] shrink-0" />{whenError}
          </p>
        )}
      </Section>
    </div>
  );

  const q = norm(query);
  const budgetInvalid = budgetText.trim() !== "" && (parseAmount(budgetText) ?? 0) <= 0;
  const friendRows = (friends ?? []).filter((f) => f.id !== currentUserId && (!q || norm(f.nombre).includes(q) || norm(f.username ?? "").includes(q)));
  const groupRows = (groups ?? []).filter((g) => !q || norm(g.nombre ?? "").includes(q));

  const step3 = (
    <div>
      <h2 ref={headingRef} tabIndex={-1} className="[font-family:var(--font-display-face)] text-[32px] leading-[1.15] text-app outline-none">Detalles</h2>
      <Summary items={summary3} />

      {!editing && (
        <Section title="Quién va" extra={peopleCount ? `Tú y ${peopleCount} más` : "Solo tú de momento"}>
          <div role="tablist" aria-label="Invitar desde" className="flex gap-[20px] border-b border-app">
            {([["friends", "Amigos"], ["groups", "Grupos"]] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={tab === v}
                onClick={() => { setTab(v); setShown({ friends: PAGE, groups: PAGE }); }}
                className={`min-h-[44px] border-b-2 text-[14px] font-[var(--fw-semibold)] ${tab === v ? "border-[var(--text-primary)] text-app" : "border-transparent text-muted"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className={`${FIELD} mt-[10px] h-[44px]`}>
            <Search aria-hidden className="size-[18px] shrink-0 text-muted" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShown({ friends: PAGE, groups: PAGE }); }}
              aria-label={tab === "friends" ? "Buscar amigos" : "Buscar grupos"}
              placeholder={tab === "friends" ? "Buscar amigos" : "Buscar grupos"}
              className="h-[42px] min-w-0 flex-1 bg-transparent text-[15px] text-app outline-none placeholder:text-muted"
            />
          </div>

          <div role="group" aria-label="Quién va" className="mt-[4px]">
            <div className="flex min-h-[52px] w-full items-center gap-[12px] px-[4px]">
              <Avatar name="Tú" size="md" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-[var(--fw-semibold)] text-app">Tú</span>
                <span className="block text-[12px] text-muted">{editing ? "En el plan" : "Creas el plan"}</span>
              </span>
              <CheckBox state="lock" />
            </div>

            {tab === "friends" ? (
              friends === null ? (
                <div role="status" className="space-y-[8px] py-[6px]" aria-label="Cargando tus amigos">
                  {[0, 1, 2].map((i) => <div key={i} className="h-[40px] animate-pulse rounded-[6px] bg-[var(--surface-2)] motion-reduce:animate-none" />)}
                </div>
              ) : friendRows.length === 0 ? (
                <p className="py-[12px] text-[14px] text-muted">
                  {q ? `Nadie con «${query.trim()}» entre tus amigos.` : "Aún no tienes amigos en Frimee. Podrás invitar con el enlace del plan."}
                </p>
              ) : (
                friendRows.slice(0, shown.friends).map((f) => {
                  const on = invited.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle([f.id], !on)}
                      className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] px-[4px] text-left hover:bg-[var(--surface-2)]"
                    >
                      <Avatar name={f.nombre} src={f.profile_image} size="md" />
                      <span className={`min-w-0 flex-1 truncate text-[15px] text-app ${on ? "font-[var(--fw-semibold)]" : ""}`}>{f.nombre}</span>
                      <CheckBox state={on ? "on" : "off"} />
                    </button>
                  );
                })
              )
            ) : groups === null ? (
              <div role="status" className="space-y-[8px] py-[6px]" aria-label="Cargando tus grupos">
                {[0, 1, 2].map((i) => <div key={i} className="h-[40px] animate-pulse rounded-[6px] bg-[var(--surface-2)] motion-reduce:animate-none" />)}
              </div>
            ) : groupRows.length === 0 ? (
              <p className="py-[12px] text-[14px] text-muted">{q ? `Ningún grupo con «${query.trim()}».` : "No estás en ningún grupo."}</p>
            ) : (
              groupRows.slice(0, shown.groups).map((g) => {
                const ids = g.miembros.map((m) => m.id).filter((id) => id !== currentUserId);
                const n = ids.filter((id) => invited.has(id)).length;
                const state = ids.length && n === ids.length ? "on" : n ? "mixed" : "off";
                return (
                  <button
                    key={g.chat_id}
                    type="button"
                    role="checkbox"
                    aria-checked={state === "on" ? true : state === "mixed" ? "mixed" : false}
                    onClick={() => toggle(ids, state !== "on")}
                    className="flex min-h-[52px] w-full items-center gap-[12px] rounded-[8px] px-[4px] text-left hover:bg-[var(--surface-2)]"
                  >
                    <Avatar name={g.nombre ?? "Grupo"} src={g.foto} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[15px] text-app ${state !== "off" ? "font-[var(--fw-semibold)]" : ""}`}>{g.nombre ?? "Grupo"}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {state === "mixed" ? `${n} de ${ids.length} invitados` : `${ids.length + 1} personas`}
                      </span>
                    </span>
                    <CheckBox state={state} />
                  </button>
                );
              })
            )}
            {tab === "friends" && friends !== null && friendRows.length > shown.friends && (
              <MoreButton rest={friendRows.length - shown.friends} onClick={() => setShown((s) => ({ ...s, friends: s.friends + PAGE }))} />
            )}
            {tab === "groups" && groups !== null && groupRows.length > shown.groups && (
              <MoreButton rest={groupRows.length - shown.groups} onClick={() => setShown((s) => ({ ...s, groups: s.groups + PAGE }))} />
            )}
          </div>
          {peopleCount > 0 && (
            <p className="mt-[6px] text-[12px] text-muted">
              Invitas a {[...invited].slice(0, 3).map((id) => firstName(people.get(id)?.name ?? "")).filter(Boolean).join(", ")}
              {peopleCount > 3 ? ` y ${peopleCount - 3} más` : ""}.
            </p>
          )}
        </Section>
      )}

      <Section title="Visibilidad">
        <div role="radiogroup" aria-label="Visibilidad" className="grid grid-cols-2 gap-[8px]">
          {([
            { value: "SOLO_GRUPO", label: "Privado", hint: "Solo los invitados pueden verlo", Icon: Lock },
            { value: "PÚBLICO", label: "Público", hint: "Visible para todos", Icon: Globe },
          ] as const).map(({ value, label, hint, Icon }) => {
            const on = visibility === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setVisibility(value)}
                className={`flex min-h-[56px] w-full items-start gap-[12px] rounded-[8px] text-left ${
                  on ? "border-2 border-[var(--primary)] bg-[var(--chat-me)] px-[11px] py-[9px]" : "border border-[var(--border-strong)] px-[12px] py-[10px]"}`}
              >
                <span aria-hidden className={`relative mt-[1px] size-[20px] shrink-0 rounded-full border-2 ${on ? "border-[var(--primary)]" : "border-[var(--border-strong)]"}`}>
                  {on && <span className="absolute inset-[3px] rounded-full bg-[var(--primary)]" />}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-[6px] text-[15px] font-[var(--fw-semibold)] text-app"><Icon aria-hidden className="size-[15px]" />{label}</span>
                  <span className="mt-[2px] block text-[13px] leading-[1.35] text-muted">{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Portada" extra="opcional">
        {coverImageUrl ? (
          <div className="relative h-[120px] w-full overflow-hidden rounded-[8px] border border-app">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImageUrl} alt="Portada del plan" className="size-full object-cover" />
            <div className="absolute bottom-[8px] right-[8px] flex gap-[6px]">
              <button type="button" onClick={() => coverInputRef.current?.click()} className="min-h-[36px] rounded-[8px] bg-black/60 px-[12px] text-[13px] font-[var(--fw-semibold)] text-white">Cambiar</button>
              <button type="button" onClick={() => { setCoverImageUrl(null); setCoverFile(null); }} className="min-h-[36px] rounded-[8px] bg-black/60 px-[12px] text-[13px] font-[var(--fw-semibold)] text-white">Quitar</button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="flex h-[72px] w-full items-center justify-center gap-[8px] rounded-[8px] border border-dashed border-[var(--border-strong)] text-[14px] font-[var(--fw-semibold)] text-app hover:bg-[var(--surface-2)]"
          >
            <ImagePlus aria-hidden className="size-[18px]" />Añadir foto de portada
          </button>
        )}
        <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverChange} className="hidden" />
      </Section>

      <Section title="Descripción" extra="opcional" htmlFor="np-descripcion">
        <textarea
          id="np-descripcion"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="De qué va, qué llevar…"
          rows={3}
          maxLength={1000}
          className="block min-h-[76px] w-full resize-none rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface-2)] p-[12px] text-[15px] leading-[1.45] text-app outline-none placeholder:text-muted focus:border-[var(--primary)] focus:shadow-[0_0_0_1px_var(--primary)]"
        />
      </Section>

      {!editing && (
        <Section title="Presupuesto" extra="opcional" htmlFor="np-presupuesto">
          <div className={`${FIELD} h-[48px] gap-[8px]`}>
            <input
              id="np-presupuesto"
              inputMode="decimal"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
              placeholder="Para todo el viaje"
              aria-invalid={budgetInvalid}
              className="h-[46px] min-w-0 flex-1 bg-transparent text-[15px] text-app outline-none placeholder:text-muted"
            />
            <span aria-hidden className="text-[15px] text-muted">€</span>
          </div>
          {budgetInvalid && <p role="alert" className="mt-[6px] text-[13px] text-[var(--error)]">Escribe un importe válido, por ejemplo 2.000,00.</p>}
        </Section>
      )}
    </div>
  );

  /* ── frame ── */

  const label = `${editing ? "Editar plan" : "Nuevo plan"}, paso ${step} de 3`;
  const busyText = editing ? "Guardando…" : "Creando el plan…";

  return (
    <>
      <div
        data-closing={isClosing ? "true" : "false"}
        className="app-modal-overlay fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center"
        onClick={saving ? undefined : requestDismiss}
        role="presentation"
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={label}
          aria-busy={saving || undefined}
          onClick={(e) => e.stopPropagation()}
          className="app-modal-panel relative flex w-full flex-col overflow-hidden bg-[var(--bg)] max-md:h-[calc(100dvh-env(safe-area-inset-top)-12px)] max-md:rounded-t-[16px] max-md:border-t max-md:border-app md:h-[min(820px,92dvh)] md:max-w-[560px] md:rounded-[8px] md:border md:border-app md:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        >
          <span aria-hidden className="mx-auto mt-[8px] block h-[4px] w-[36px] shrink-0 rounded-full bg-[var(--border)] md:hidden" />

          <div className="flex shrink-0 items-center gap-[4px] px-[8px] pt-[8px] max-md:pt-0">
            {step > 1 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} disabled={saving} aria-label="Volver al paso anterior" title="Volver" className={ICON_BTN}>
                <ChevronLeft className="size-[22px]" aria-hidden />
              </button>
            ) : (
              <span aria-hidden className="w-[44px] shrink-0" />
            )}
            <div className="flex-1 text-center text-[12px] text-muted">{editing ? "Editar plan" : "Nuevo plan"}</div>
            <button type="button" onClick={requestDismiss} disabled={saving} aria-label="Cerrar" title="Cerrar" className={ICON_BTN}>
              <X className="size-[22px]" aria-hidden />
            </button>
          </div>

          <nav aria-label={`Pasos: ${step} de 3`} className="grid shrink-0 grid-cols-3 gap-[8px] px-[20px] pt-[4px]">
            {STEPS.map((name, i) => {
              const n = i + 1;
              const done = n < step;
              const cur = n === step;
              const inner = (
                <>
                  <i aria-hidden className={`block h-[3px] rounded-[2px] ${done || cur ? "bg-[var(--primary)]" : "bg-[var(--border)]"}`} />
                  <span className="flex items-center gap-[4px]">
                    {done && <Check aria-hidden className="size-[12px] text-[var(--chat-accent-text)]" strokeWidth={3} />}
                    {name}
                  </span>
                </>
              );
              const cls = `flex min-h-[44px] flex-col justify-center gap-[6px] text-left text-[12px] font-[var(--fw-semibold)] ${cur ? "text-app" : "text-muted"}`;
              return done ? (
                <button key={name} type="button" disabled={saving} onClick={() => setStep(n)} className={cls}>{inner}</button>
              ) : (
                <div key={name} aria-current={cur ? "step" : undefined} className={cls}>{inner}</div>
              );
            })}
          </nav>

          <div inert={saving} className="min-h-0 flex-1 overflow-y-auto px-[20px] pb-[20px] pt-[12px]">
            {failed && (
              <div role="alert" className="mb-[16px] flex items-start gap-[10px] rounded-[8px] border border-[var(--error)] bg-[color-mix(in_srgb,var(--error)_10%,var(--bg))] p-[12px] text-[14px] leading-[1.4] text-app">
                <CircleAlert aria-hidden className="mt-[1px] size-[18px] shrink-0 text-[var(--error)]" />
                {editing
                  ? "No se pudieron guardar los cambios. Comprueba la conexión y vuelve a intentarlo."
                  : "No se pudo crear el plan. Comprueba la conexión y vuelve a intentarlo. No se ha guardado nada a medias."}
              </div>
            )}
            {step === 1 ? step1 : step === 2 ? step2 : step3}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-[12px] border-t border-app px-[20px] pt-[12px] pb-[calc(12px+env(safe-area-inset-bottom))] max-md:pb-[calc(24px+env(safe-area-inset-bottom))]">
            {step === 3 ? (
              <button type="button" onClick={() => void submit()} disabled={saving} className={`${FILL} flex-1`}>
                {saving ? <><Loader2 aria-hidden className="size-[18px] animate-spin motion-reduce:animate-none" />{busyText}</>
                  : failed ? "Reintentar"
                  : editing ? "Guardar cambios" : "Crear plan"}
              </button>
            ) : (
              <>
                {step === 2 ? (
                  <button type="button" onClick={() => void submit()} disabled={saving} className={TEXT_BTN}>
                    {saving ? <><Loader2 aria-hidden className="size-[16px] animate-spin motion-reduce:animate-none" />{busyText}</>
                      : editing ? "Guardar ya" : "Crear ya, sin detalles"}
                  </button>
                ) : <span />}
                <button type="button" onClick={next} disabled={saving} className={`${FILL} min-w-[132px]`}>Siguiente</button>
              </>
            )}
          </div>
          <span className="sr-only" aria-live="polite">{saving ? busyText : ""}</span>
        </section>
      </div>

      {datesOpen && (
        <PhoneRangeSheet
          inicio={when.startDate}
          fin={when.endDate}
          onChange={setDates}
          onClose={() => setDatesOpen(false)}
          label="Fechas del plan"
        />
      )}

      <DiscardChangesDialog
        open={discardOpen}
        onCancel={() => setDiscardOpen(false)}
        onDiscard={() => { setDiscardOpen(false); requestClose(); }}
      />
    </>
  );
}
