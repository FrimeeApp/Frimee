"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Drawer } from "vaul";
import { ChevronDown, ChevronLeft, CircleAlert, Clock, Keyboard } from "lucide-react";
import { useIsPhone } from "@/components/chat/bitacora/Sheet";

// ── time helpers ──────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const toMin = (t: string) => { const [a, b] = t.split(":").map(Number); return (a ?? 0) * 60 + (b ?? 0); };
const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const isTime = (v: string) => /^\d{2}:\d{2}$/.test(v);
const SLOTS = Array.from({ length: 96 }, (_, i) => i * 15);

/**
 * Reads what the person is typing: «21» → 21:00, «21:1» → 21:10, «21.30» or
 * «2130» → 21:30, «930» → 09:30, «9» → 09:00. Null while it can't be a time.
 */
export function parseTyped(raw: string): string | null {
  const s = raw.trim().replace(/[.,h ]/g, ":");
  let hs: string, ms: string;
  const withColon = /^(\d{1,2}):(\d{0,2})$/.exec(s);
  if (withColon) [, hs, ms] = withColon;
  else if (/^\d{1,4}$/.test(s)) {
    const cut = s.length <= 2 ? s.length : s.length - 2;
    hs = s.slice(0, cut); ms = s.slice(cut);
  } else return null;
  const h = Number(hs);
  const mm = ms === "" ? 0 : ms.length === 1 ? Number(ms) * 10 : Number(ms);
  if (h > 23 || mm > 59) return null;
  return `${pad(h)}:${pad(mm)}`;
}

/** Where the list opens: the chosen time, else the suggested one, else the next o'clock. */
function anchorFor(value: string, suggested?: string | null) {
  if (isTime(value)) return toMin(value);
  if (suggested && isTime(suggested)) return toMin(suggested);
  const now = new Date();
  return Math.min(23 * 60, (now.getHours() + 1) * 60);
}

/** «Sugerido»: what @frimee filled in. One style for every field of the panel and this picker. */
export const Sugerido = () => (
  <span className="ml-[8px] shrink-0 text-[11px] font-[var(--fw-semibold)] text-primary-token">Sugerido</span>
);

export type TimePickerProps = {
  /** "HH:MM", or "" when nothing is chosen yet. */
  value: string;
  /** `nextDay`: the person picked an hour marked «+1» (it ends the day after). */
  onChange: (v: string, opts?: { nextDay?: boolean }) => void;
  /** Accessible name and sheet title («Hora», «Hora de fin»). */
  label: string;
  /** Sheet subtitle on phones, e.g. «Sáb 13 dic · Taberna da Rua». */
  subtitle?: string;
  /** "row": inside a form row (Añadir al plan). "box": a filled field (Crear actividad). */
  variant?: "row" | "box";
  /** The time @frimee suggested: shows «Sugerido» while the value is still that. */
  suggested?: string | null;
  invalid?: boolean;
  /** Times before this one are marked «+1» (they end the next day). */
  nextDayBefore?: string;
  minTime?: string;
  maxTime?: string;
  placeholder?: string;
};

/**
 * Frimee's time picker (Design board «Selector de hora»): 24 h, typed or picked
 * in 15-minute steps. Phones: a sheet with an hour grid and :00/:15/:30/:45.
 * Desktop: a combobox with a listbox below, centred on the chosen, suggested
 * or next o'clock time; typing «21:1» offers 21:10 on top.
 */
export function TimePicker(props: TimePickerProps) {
  const phone = useIsPhone();
  return phone ? <PhonePicker {...props} /> : <DesktopPicker {...props} />;
}

// ── trigger look, shared ──────────────────────────────────────────────────────

function triggerCls(variant: "row" | "box", open: boolean, invalid?: boolean) {
  if (variant === "row") {
    return `relative -mx-[8px] flex h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-[8px] rounded-[8px] pl-[8px] pr-[4px] text-[15px] ${
      open ? "bg-[var(--surface-2)] outline outline-2 -outline-offset-2 outline-[var(--primary)]" : ""}`;
  }
  return `flex h-[46px] w-full cursor-pointer items-center gap-[8px] rounded-[8px] border bg-[var(--surface-2)] pl-[12px] pr-[4px] text-[17px] ${
    invalid ? "border-[var(--error)] shadow-[0_0_0_1px_var(--error)]"
    : open ? "border-[var(--primary)] shadow-[0_0_0_1px_var(--primary)]"
    : "border-[var(--border-strong)]"}`;
}

function LeadIcon({ empty, invalid, variant }: { empty: boolean; invalid?: boolean; variant: "row" | "box" }) {
  if (invalid && variant === "box") return <CircleAlert aria-hidden className="size-[18px] shrink-0 text-[var(--error)]" />;
  if (empty) return <Clock aria-hidden className="size-[18px] shrink-0 text-[var(--text-secondary)]" />;
  return null;
}

const valueCls = (variant: "row" | "box", empty: boolean, invalid?: boolean) =>
  `${variant === "row" ? `${empty ? "min-w-0 flex-1" : "w-[58px] shrink-0"} text-[15px]` : `min-w-0 flex-1 text-[17px] ${empty ? "" : "font-[var(--fw-semibold)]"}`} h-[44px] bg-transparent tabular-nums outline-none placeholder:text-[var(--text-secondary)] ${
    invalid ? "text-[var(--error)]" : "text-app"}`;

// ── desktop: combobox + listbox ───────────────────────────────────────────────

function DesktopPicker({ value, onChange, label, variant = "row", suggested, invalid, nextDayBefore, minTime, maxTime, placeholder = "Elige hora" }: TimePickerProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const reveal = useRef<"center" | "nearest" | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // text being typed, null = showing value
  const [active, setActive] = useState(0); // minutes of the highlighted option
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean } | null>(null);

  const lo = minTime ? toMin(minTime) : 0;
  const hi = maxTime ? toMin(maxTime) : 24 * 60 - 1;
  const slots = useMemo(() => SLOTS.filter((m) => m >= lo && m <= hi), [lo, hi]);
  const typed = draft !== null && draft.trim() !== "" ? parseTyped(draft) : null;
  const typedOk = typed !== null && toMin(typed) >= lo && toMin(typed) <= hi;
  const extra = typedOk && !slots.includes(toMin(typed)) ? toMin(typed) : null;
  const options = extra !== null ? [extra, ...slots] : slots;
  const nd = nextDayBefore ? toMin(nextDayBefore) : null;

  const openList = () => {
    if (open) return;
    const a = anchorFor(value, suggested);
    const near = slots.reduce((b, m) => (Math.abs(m - a) < Math.abs(b - a) ? m : b), slots[0] ?? 0);
    setActive(isTime(value) && slots.includes(toMin(value)) ? toMin(value) : near);
    reveal.current = "center";
    setOpen(true);
  };
  const close = () => { setOpen(false); setDraft(null); };
  const commit = (m: number) => {
    onChange(fmt(m), { nextDay: nd !== null && m < nd });
    close();
  };

  // Fixed position under the field, flipped up when there's no room; follows scroll.
  useLayoutEffect(() => {
    if (!open) return;
    const place = (e?: Event) => {
      if (e && listRef.current?.contains(e.target as Node)) return; // the list scrolling itself
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      const h = 296;
      const up = r.bottom + 4 + h > window.innerHeight && r.top - 4 - h > 0;
      setPos({ left: r.left, width: Math.max(r.width, 200), top: up ? r.top - 4 - h : r.bottom + 4, up });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);

  // Bring the highlighted option into view only when it moved by keyboard,
  // typing or opening; never while the person scrolls or hovers the list.
  useEffect(() => {
    const list = listRef.current;
    const how = reveal.current;
    if (!open || !list || !how) return;
    const el = list.querySelector<HTMLElement>(`[data-m="${active}"]`);
    if (!el) return;
    reveal.current = null;
    const top = el.offsetTop, bottom = top + el.offsetHeight;
    if (how === "center") list.scrollTop = top - (list.clientHeight - el.offsetHeight) / 2;
    else if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4;
  }, [open, active, pos]);

  // Click outside closes (keeping a valid typed time).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || listRef.current?.contains(t)) return;
      if (typedOk) commit(toMin(typed)); else close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  });

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { openList(); return; }
      const i = options.indexOf(active);
      const j = Math.max(0, Math.min(options.length - 1, (i < 0 ? 0 : i) + (e.key === "ArrowDown" ? 1 : -1)));
      reveal.current = "nearest";
      setActive(options[j]);
      setDraft(null);
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      e.stopPropagation(); // the wizard listens to Enter on window
      commit(typedOk ? toMin(typed) : active);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation(); // don't close the dialog behind
      close();
    } else if (e.key === "Tab" && open) {
      if (typedOk) commit(toMin(typed)); else close();
    }
  };

  const empty = !isTime(value);
  const shown = draft ?? value;
  const showSug = !open && !!suggested && value === suggested;

  return (
    <div ref={wrapRef} className={triggerCls(variant, open, invalid)} onClick={() => wrapRef.current?.querySelector("input")?.focus()}>
      <LeadIcon empty={empty && draft === null} invalid={invalid} variant={variant} />
      <input
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={shown}
        onFocus={openList}
        onMouseDown={openList}
        onChange={(e) => {
          const text = e.target.value.slice(0, 5);
          if (!open) openList();
          setDraft(text);
          // Typing moves the highlight to what was typed.
          const t = parseTyped(text);
          if (t && toMin(t) >= lo && toMin(t) <= hi) { reveal.current = "center"; setActive(toMin(t)); }
        }}
        onKeyDown={onKeyDown}
        className={`${valueCls(variant, empty && draft === null, invalid)} cursor-pointer`}
      />
      <ChevronDown aria-hidden className={`ml-auto ${showSug ? "" : "mr-[7px]"} size-[18px] shrink-0 text-[var(--text-secondary)]`} />
      {showSug && <Sugerido />}
      {open && pos && createPortal(
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Horas"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          className="fixed z-[1360] max-h-[296px] overflow-y-auto overscroll-contain rounded-[8px] border border-app bg-[var(--bg)] p-[4px] shadow-[var(--shadow-md)] [animation:tp-caer_160ms_cubic-bezier(.2,0,0,1)_both] motion-reduce:animate-none"
        >
          {draft !== null && draft.trim() !== "" && (
            <div className="-mx-[4px] -mt-[4px] mb-[4px] flex h-[32px] items-center border-b border-app px-[14px] text-[12px] text-[var(--text-secondary)]">
              {typedOk ? `Escribiendo «${draft}»` : `«${draft}» no es una hora`}
            </div>
          )}
          {options.map((m) => {
            const sel = !empty && toMin(value) === m;
            const act = m === active;
            return (
              <div
                key={m === extra ? `x${m}` : m}
                id={`${listId}-${m}`}
                data-m={m}
                role="option"
                aria-selected={sel}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(m)}
                onMouseMove={() => { if (!act) setActive(m); }}
                className={`flex h-[40px] cursor-pointer items-center gap-[8px] rounded-[6px] px-[10px] text-[15px] tabular-nums text-app ${act ? "bg-[var(--surface-2)]" : ""} ${sel ? "font-[var(--fw-semibold)]" : ""}`}
              >
                <span className="flex w-[16px] shrink-0 text-[var(--chat-accent-text)]">
                  {sel && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>}
                </span>
                <span>{fmt(m)}</span>
                <span className="ml-auto text-[12px] text-[var(--text-secondary)]">
                  {m === extra ? "Usar esta hora" : suggested && toMin(suggested) === m ? "Sugerido" : nd !== null && m < nd ? "día siguiente" : ""}
                </span>
              </div>
            );
          })}
          {options.length === 0 && <div className="px-[10px] py-[10px] text-[13px] text-[var(--text-secondary)]">No hay horas disponibles</div>}
        </div>,
        document.body,
      )}
    </div>
  );
}

// ── phone: field opens a sheet ────────────────────────────────────────────────

function PhonePicker({ value, onChange, label, subtitle, variant = "row", suggested, invalid, nextDayBefore, minTime, maxTime, placeholder = "Elige hora" }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(""); // what the sheet's field shows
  const [nextDay, setNextDay] = useState(false);
  const empty = !isTime(value);

  const lo = minTime ? toMin(minTime) : 0;
  const hi = maxTime ? toMin(maxTime) : 24 * 60 - 1;
  const nd = nextDayBefore ? toMin(nextDayBefore) : null;
  const picked = parseTyped(draft);
  const pickedOk = picked !== null && toMin(picked) >= lo && toMin(picked) <= hi;
  const ph = pickedOk ? Number(picked.slice(0, 2)) : null;
  const pm = pickedOk ? Number(picked.slice(3)) : null;

  const start = () => {
    setDraft(isTime(value) ? value : fmt(anchorFor(value, suggested)));
    setNextDay(false);
    setOpen(true);
  };
  const pickHour = (h: number) => {
    const m = pm ?? 0;
    const t = Math.max(lo, Math.min(hi, h * 60 + m));
    setDraft(fmt(t));
    setNextDay(nd !== null && (h + 1) * 60 <= nd);
  };
  const pickMin = (m: number) => {
    const t = Math.max(lo, Math.min(hi, (ph ?? 0) * 60 + m));
    setDraft(fmt(t));
  };
  const use = () => {
    if (!pickedOk) return;
    onChange(picked, { nextDay });
    setOpen(false);
  };

  const cell = (on: boolean, extra = "") =>
    `relative flex h-[44px] items-center justify-center rounded-[8px] border text-[15px] tabular-nums disabled:opacity-40 ${
      on ? "border-[var(--text-primary)] bg-[var(--text-primary)] font-[var(--fw-semibold)] text-[var(--bg)]" : `border-app text-app ${extra}`}`;

  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`${label}: ${empty ? "sin elegir" : value}${invalid ? ", no válida" : ""}`} onClick={start} className={`${triggerCls(variant, open, invalid)} text-left`}>
        <LeadIcon empty={empty} invalid={invalid} variant={variant} />
        <span className={`${valueCls(variant, empty, invalid)} flex items-center ${empty ? "text-[var(--text-secondary)]" : ""}`}>{empty ? placeholder : value}</span>
        <ChevronDown aria-hidden className="ml-auto size-[18px] shrink-0 text-[var(--text-secondary)]" />
        {!!suggested && value === suggested ? <Sugerido /> : <span className="w-[7px] shrink-0" />}
      </button>

      <Drawer.Root open={open} onOpenChange={setOpen} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[1350] bg-black/60" />
          <Drawer.Content
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-[1351] flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-[16px] border-t border-app bg-[var(--bg)] px-[16px] pb-[24px] pt-[8px] outline-none"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + var(--keyboard-height, 0px) + 24px)" }}
          >
            <div aria-hidden className="mx-auto mb-[4px] h-[4px] w-[36px] shrink-0 rounded-full bg-[var(--border)]" />
            <div className="-ml-[12px] flex items-center gap-[4px]">
              <button type="button" aria-label="Volver" onClick={() => setOpen(false)} className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app">
                <ChevronLeft aria-hidden className="size-[22px]" />
              </button>
              <div className="min-w-0 flex-1">
                <Drawer.Title className="text-[16px] font-[var(--fw-semibold)] text-app">{label}</Drawer.Title>
                {subtitle && <div className="truncate text-[12px] text-[var(--text-secondary)]">{subtitle}</div>}
              </div>
            </div>

            <label className="mt-[12px] flex h-[56px] items-center gap-[10px] rounded-[8px] border border-[var(--primary)] bg-[var(--surface-2)] pl-[14px] pr-[4px] shadow-[0_0_0_1px_var(--primary)]">
              <Keyboard aria-hidden className="size-[20px] shrink-0 text-[var(--text-secondary)]" />
              <input
                inputMode="numeric"
                aria-label="Escribe la hora"
                aria-invalid={draft !== "" && !pickedOk ? true : undefined}
                value={draft}
                onChange={(e) => { setDraft(e.target.value.slice(0, 5)); setNextDay(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); use(); } }}
                className="h-[54px] min-w-0 flex-1 bg-transparent text-[28px] font-[var(--fw-semibold)] tabular-nums text-app outline-none"
              />
              {!!suggested && picked === suggested && <span className="mr-[10px] flex"><Sugerido /></span>}
            </label>
            <p className="mt-[6px] text-[12px] text-[var(--text-secondary)]">
              {draft !== "" && !pickedOk ? "Esa hora no vale aquí. Prueba con otra." : "Escribe una hora exacta, como 21:10, o elige abajo."}
            </p>

            <div className="mb-[8px] mt-[14px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--text-secondary)]">Hora</div>
            <div role="radiogroup" aria-label="Hora" className="grid grid-cols-6 gap-[4px]">
              {Array.from({ length: 24 }, (_, h) => {
                const plus = nd !== null && (h + 1) * 60 <= nd;
                const off = h * 60 + 59 < lo || h * 60 > hi;
                return (
                  <button key={h} type="button" role="radio" aria-checked={ph === h} disabled={off}
                    aria-label={`${pad(h)} h${plus ? ", día siguiente" : ""}`}
                    onClick={() => pickHour(h)}
                    className={cell(ph === h)}>
                    {pad(h)}
                    {plus && ph !== h && <sup className="absolute right-[5px] top-[3px] text-[11px] leading-none text-[var(--text-secondary)]">+1</sup>}
                  </button>
                );
              })}
            </div>
            {nd !== null && <p className="mt-[6px] text-[12px] text-[var(--text-secondary)]">«+1»: termina al día siguiente.</p>}

            <div className="mb-[8px] mt-[14px] text-[12px] font-[var(--fw-semibold)] tracking-[.02em] text-[var(--text-secondary)]">Minutos</div>
            <div role="radiogroup" aria-label="Minutos" className="grid grid-cols-4 gap-[4px]">
              {[0, 15, 30, 45].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={pm === m} onClick={() => pickMin(m)} className={cell(pm === m)}>:{pad(m)}</button>
              ))}
            </div>

            <button type="button" disabled={!pickedOk} onClick={use}
              className="mt-[16px] flex h-[46px] w-full shrink-0 items-center justify-center rounded-[8px] bg-[var(--primary)] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-secondary)]">
              {pickedOk ? `Usar ${picked}${nextDay ? " (día siguiente)" : ""}` : "Elige una hora"}
            </button>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}
