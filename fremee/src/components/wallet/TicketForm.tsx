"use client";
/**
 * Cartera · formulario de billete (añadir y editar).
 *
 *   <TicketForm mode="add" …/>    vacío; «Añadir billete»
 *   <TicketForm mode="edit" initial={…} …/>   relleno; «Guardar» y «Eliminar»
 *
 * Móvil: pantalla completa con barra de botones fija abajo. Escritorio: diálogo con vista previa a la izquierda
 * y hoja de papel a la derecha. La vista previa se actualiza mientras se escribe.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  AlertCircle, BedDouble, Calendar, Camera, Check, FileText, Music, Plane, QrCode, Ship, Tag, Train, Trash2, Trophy, Upload, X,
} from "lucide-react";
import { BOOK, PAPER_VARS } from "@/components/profile/passport/Libreta";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { TimePicker } from "@/components/ui/TimePicker";
import { FOCUS, INKS, SERIF } from "@/components/wallet/WalletUI";
import type { TicketType } from "@/services/api/endpoints/wallet.endpoint";
import {
  EMPTY_DRAFT, type DraftKey, type PlanOption, type TicketDraft, type TicketFile, type UploadResult,
} from "@/components/wallet/ticket-form-data";

const LINE = "#9FB0A8";
const ERR = INKS.rojo;
const MAX_MB = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const PAPER_SHADOW = "0 1px 0 #d6dbd2, 0 2px 0 #e9ece4, 0 3px 0 #d2d7ce";

const KINDS: { id: TicketType; label: string; Icon: typeof Plane; ink: string }[] = [
  { id: "flight", label: "Vuelo", Icon: Plane, ink: INKS.azul },
  { id: "train", label: "Tren", Icon: Train, ink: INKS.verde },
  { id: "ferry", label: "Ferry", Icon: Ship, ink: INKS.azul },
  { id: "concert", label: "Concierto", Icon: Music, ink: INKS.violeta },
  { id: "match", label: "Partido", Icon: Trophy, ink: INKS.rojo },
  { id: "hotel", label: "Hotel", Icon: BedDouble, ink: INKS.verde },
  { id: "other", label: "Otro", Icon: Tag, ink: INKS.negro },
];

type Props = {
  mode: "add" | "edit";
  initial?: Partial<TicketDraft>;
  plans: PlanOption[];
  defaultPlanId?: number | null;
  uploadFile: (file: File, onProgress: (pct: number) => void, signal: AbortSignal) => Promise<UploadResult>;
  onSubmit: (draft: TicketDraft) => Promise<void>;
  /** Solo en edición: borra el billete (y su archivo). */
  onDelete?: () => Promise<void>;
  onClose: () => void;
  /** Borra de Storage los archivos subidos en esta sesión que al final no se usan. */
  releaseFiles: (paths: string[]) => void;
};

/* ---------------- utilidades ---------------- */

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

function fmtWhen(date: string, time: string) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  const day = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d).replace(".", "");
  return time ? `${day} · ${time}` : day;
}

/* ---------------- piezas de papel ---------------- */

/** Guilloche fino en el borde de la hoja: tres líneas onduladas. */
function Band({ bottom }: { bottom?: boolean }) {
  const lines = useMemo(
    () => [0, 1, 2].map((i) => {
      let d = "";
      for (let x = 0; x <= 1200; x += 6) d += `${x ? "L" : "M"}${x},${(4 + i * 4 + 2.2 * Math.sin(x / 9 + i * 1.3)).toFixed(1)}`;
      return d;
    }),
    [],
  );
  return (
    <svg aria-hidden className={`pointer-events-none absolute inset-x-0 h-4 w-full ${bottom ? "bottom-0" : "top-0"}`} preserveAspectRatio="none" viewBox="0 0 1200 16">
      {lines.map((d, i) => <path key={i} d={d} fill="none" stroke={i === 1 ? BOOK.guil2 : BOOK.guil1} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />)}
    </svg>
  );
}

function Label({ htmlFor, children, error, fromFile }: { htmlFor?: string; children: React.ReactNode; error?: boolean; fromFile?: boolean }) {
  const Comp = htmlFor ? "label" : "span";
  return (
    <Comp htmlFor={htmlFor} className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em]" style={{ color: error ? ERR : BOOK.label }}>
      {children}
      {fromFile && <span className="h-5 rounded-full px-[7px] text-[11px] font-semibold leading-5 tracking-normal" style={{ background: "#E3EEE9", color: BOOK.ribbon }}>Del archivo</span>}
    </Comp>
  );
}

function LineInput({ id, value, onChange, placeholder, big, mono, error, icon: Icon, type = "text", describedBy, inputRef }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; big?: boolean; mono?: boolean; error?: boolean;
  icon?: typeof Plane; type?: string; describedBy?: string; inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2" style={{ borderBottom: `${error ? 2 : 1.5}px solid ${error ? ERR : LINE}` }}>
      <input ref={inputRef} id={id} type={type} value={value} placeholder={placeholder} aria-invalid={error || undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className={`min-w-0 flex-1 border-0 bg-transparent py-1.5 outline-none placeholder:text-[#6F7F79] focus-visible:outline-none ${big ? `${SERIF} text-2xl` : mono ? "font-mono text-base font-medium" : "text-base font-semibold"}`}
        style={{ color: BOOK.text }} />
      {Icon && <Icon size={18} aria-hidden style={{ color: BOOK.label }} />}
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: ERR }}>
      <AlertCircle size={16} aria-hidden />{children}
    </p>
  );
}

/* ---------------- archivo ---------------- */

type FileState =
  | { s: "empty" }
  | { s: "uploading"; name: string; pct: number }
  | { s: "error"; name: string; message: string }
  | { s: "done"; file: TicketFile };

function FileZone({ st, compact, onPick, onCamera, onCancel, onRemove }: {
  st: FileState; compact: boolean; onPick: () => void; onCamera: () => void; onCancel: () => void; onRemove: () => void;
}) {
  const outline = `h-11 rounded-lg border-[1.5px] bg-transparent px-3.5 text-sm font-semibold ${FOCUS}`;
  const thumb = (children: React.ReactNode, bg = "#E4E9E1") => (
    <span aria-hidden className="relative grid h-14 w-11 shrink-0 place-content-center rounded border" style={{ background: bg, borderColor: "#C9D3CC" }}>{children}</span>
  );
  if (st.s === "empty")
    return (
      <div className="flex items-center gap-3.5 rounded-lg border-[1.5px] border-dashed" style={{ borderColor: BOOK.slot, padding: compact ? 14 : 18 }}>
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-content-center rounded-full" style={{ background: "#E4E9E1", color: BOOK.text }}><Upload size={20} /></span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold" style={{ color: BOOK.text }}>Imagen o PDF</span>
          <span className="text-[13px]" style={{ color: BOOK.label }}>Si lleva QR o datos, los leemos</span>
        </div>
        <div className="flex gap-1.5">
          <button type="button" onClick={onPick} className={outline} style={{ borderColor: BOOK.text, color: BOOK.text }}>Elegir archivo</button>
          {compact && (
            <button type="button" onClick={onCamera} aria-label="Hacer foto" className={`grid h-11 w-11 place-content-center rounded-lg border-[1.5px] ${FOCUS}`} style={{ borderColor: BOOK.text, color: BOOK.text }}>
              <Camera size={20} aria-hidden />
            </button>
          )}
        </div>
      </div>
    );
  if (st.s === "uploading")
    return (
      <div role="status" className="flex items-center gap-3.5 rounded-lg border-[1.5px] p-3.5" style={{ borderColor: BOOK.slot }}>
        {thumb(<FileText size={20} style={{ color: BOOK.label }} />)}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-[15px] font-semibold" style={{ color: BOOK.text }}>{st.name}</span>
          <span aria-hidden className="h-1 overflow-hidden rounded-full" style={{ background: "#DCE3DE" }}>
            <span className="block h-full transition-[width] duration-[160ms] motion-reduce:transition-none" style={{ width: `${st.pct}%`, background: BOOK.ribbon }} />
          </span>
          <span className="text-[13px] tabular-nums" style={{ color: BOOK.label }}>Subiendo… {st.pct} %</span>
        </div>
        <button type="button" aria-label="Cancelar la subida" onClick={onCancel} className={`grid h-11 w-11 place-content-center rounded-lg ${FOCUS}`} style={{ color: BOOK.text }}><X size={20} aria-hidden /></button>
      </div>
    );
  if (st.s === "error")
    return (
      <div className="flex items-center gap-3.5 rounded-lg border-2 p-3.5" style={{ borderColor: ERR }}>
        {thumb(<AlertCircle size={22} style={{ color: ERR }} />, "#F6E4E5")}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold" style={{ color: BOOK.text }}>{st.name}</span>
          <span role="alert" className="text-[13px] font-semibold" style={{ color: ERR }}>{st.message}</span>
        </div>
        <button type="button" onClick={onPick} className={`${outline} shrink-0`} style={{ borderColor: BOOK.text, color: BOOK.text }}>Elegir otro</button>
      </div>
    );
  const f = st.file;
  return (
    <div className="flex items-center gap-3.5 rounded-lg border-[1.5px] p-3.5" style={{ borderColor: BOOK.slot, background: "rgba(255,255,255,.5)" }}>
      {f.isPdf || !f.url
        ? thumb(<><QrCode size={22} style={{ color: BOOK.text }} /><span className="absolute -inset-x-px -bottom-px h-3.5 rounded-b text-center text-[9px] font-bold leading-[14px] text-white" style={{ background: BOOK.text }}>{f.isPdf ? "PDF" : "IMG"}</span></>, "#fff")
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={f.url} alt="" aria-hidden className="h-14 w-11 shrink-0 rounded border object-cover" style={{ borderColor: "#C9D3CC" }} />}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold" style={{ color: BOOK.text }}>{f.name}</span>
        <span className="flex items-center gap-1.5 text-[13px] tabular-nums" style={{ color: BOOK.label }}>
          {f.qr && <><Check size={14} aria-hidden style={{ color: BOOK.ribbon }} /><span className="font-semibold" style={{ color: BOOK.ribbon }}>QR leído</span>{f.size > 0 && " · "}</>}
          {f.size > 0 && fmtSize(f.size)}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <button type="button" onClick={onPick} className={`min-h-8 rounded px-1 text-sm font-semibold underline underline-offset-[3px] ${FOCUS}`} style={{ color: BOOK.text }}>Cambiar archivo</button>
        <button type="button" onClick={onRemove} className={`min-h-8 rounded px-1 text-sm font-semibold ${FOCUS}`} style={{ color: ERR }}>Quitar</button>
      </div>
    </div>
  );
}

/* ---------------- tipo y plan ---------------- */

function KindPicker({ value, onChange, compact }: { value?: TicketType; onChange: (k: TicketType) => void; compact: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, KINDS.findIndex((k) => k.id === value));
  const onKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + KINDS.length) % KINDS.length;
    onChange(KINDS[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Tipo" className={`grid gap-1.5 ${compact ? "grid-cols-4" : "grid-cols-7 gap-2"}`}>
      {KINDS.map((k, i) => {
        const on = k.id === value;
        return (
          <button key={k.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} tabIndex={i === idx ? 0 : -1}
            onClick={() => onChange(k.id)} onKeyDown={(e) => onKey(e, i)}
            className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1.5 rounded-lg px-0.5 py-2 text-xs ${on ? "font-bold" : "font-semibold"} ${FOCUS}`}
            style={{ border: `${on ? 2 : 1.5}px solid ${on ? k.ink : "#C3CDC7"}`, background: on ? "rgba(255,255,255,.7)" : "transparent", color: on ? k.ink : BOOK.text }}>
            <k.Icon size={20} aria-hidden />{k.label}
            {on && <span aria-hidden className="absolute right-1 top-1 grid h-4 w-4 place-content-center rounded-full" style={{ background: k.ink }}><Check size={11} color="#fff" /></span>}
          </button>
        );
      })}
    </div>
  );
}

function PlanList({ plans, value, onChange, name }: { plans: PlanOption[]; value: number | null; onChange: (id: number | null) => void; name: string }) {
  const row = (id: number | null, title: string, dates: string, first: boolean) => {
    const on = value === id;
    return (
      <label key={id ?? "_none"} className={`relative flex min-h-12 cursor-pointer items-center gap-3 ${first ? "" : "border-t"}`} style={{ borderColor: "#DCE3DE" }}>
        <input type="radio" name={name} checked={on} onChange={() => onChange(id)} className="peer absolute h-px w-px opacity-0" />
        <span aria-hidden className="grid h-5 w-5 shrink-0 place-content-center rounded-full border-2 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--primary)]"
          style={{ borderColor: on ? BOOK.ribbon : LINE }}>
          {on && <span className="h-[9px] w-[9px] rounded-full" style={{ background: BOOK.ribbon }} />}
        </span>
        <span className={`min-w-0 flex-1 truncate text-[15px] ${on ? "font-bold" : "font-semibold"}`} style={{ color: BOOK.text }}>{title}</span>
        {dates && <span className="whitespace-nowrap text-[13px] tabular-nums" style={{ color: BOOK.label }}>{dates}</span>}
      </label>
    );
  };
  const up = plans.filter((p) => p.upcoming);
  const past = plans.filter((p) => !p.upcoming); // ya vienen del más reciente al más antiguo
  // Los pasados van plegados: se ven de 5 en 5 al pedirlos, y el plan elegido sale siempre (al editar un billete de un plan acabado).
  const [showPast, setShowPast] = useState(false);
  const [pastCount, setPastCount] = useState(5);
  const shownPast = past.filter((p, i) => (showPast && i < pastCount) || p.id === value);
  const head = (t: string) => <span className="pb-0.5 pt-2.5 text-[11px] font-semibold tracking-[0.06em]" style={{ color: BOOK.label }}>{t}</span>;
  const linkBtn = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className={`min-h-11 self-start rounded text-left text-[14px] font-semibold ${FOCUS}`} style={{ color: BOOK.ribbon }}>{label}</button>
  );
  return (
    <div role="radiogroup" aria-label="Plan" className="flex flex-col">
      {up.length > 0 && head("PRÓXIMOS")}
      {up.map((p, i) => row(p.id, p.title, p.dates, i === 0))}
      {shownPast.length > 0 && head("PASADOS")}
      {shownPast.map((p, i) => row(p.id, p.title, p.dates, i === 0))}
      {past.length > 0 && !showPast && linkBtn(`Ver planes pasados (${past.length})`, () => setShowPast(true))}
      {showPast && pastCount < past.length && linkBtn("Ver más", () => setPastCount((n) => n + 5))}
      {showPast && linkBtn("Ocultar planes pasados", () => { setShowPast(false); setPastCount(5); })}
      <div className={plans.length ? "mt-0.5 border-t" : ""} style={{ borderColor: "#DCE3DE" }}>{row(null, "Sin plan", "", true)}</div>
    </div>
  );
}

/* ---------------- vista previa ---------------- */

function Preview({ d, plans, width, compact }: { d: TicketDraft; plans: PlanOption[]; width: number; compact?: boolean }) {
  const k = KINDS.find((x) => x.id === d.type);
  const plan = plans.find((p) => p.id === d.planId)?.title;
  const when = fmtWhen(d.date, d.time);
  const stub = width < 420 ? 96 : 120;
  const h = compact ? 110 : 214;
  const ph = (w: number | string, hh: number) => <span className="block rounded border-[1.5px] border-dashed" style={{ width: w, height: hh, borderColor: BOOK.slot }} />;
  const desc = [d.title || "Billete sin título", k?.label, when, plan ?? "sin plan"].filter(Boolean).join(", ");
  return (
    <div role="img" aria-label={`Vista previa: ${desc}`} className="relative overflow-hidden rounded-[10px]" style={{ width, height: h, background: BOOK.paper, boxShadow: PAPER_SHADOW }}>
      <div className="absolute inset-y-0 left-0 box-border" style={{ right: stub, padding: compact ? "12px 16px" : "18px 20px" }}>
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold tracking-[0.1em]"
          style={{ border: `1.5px ${k ? "solid" : "dashed"} ${k?.ink ?? BOOK.slot}`, color: k?.ink ?? BOOK.label }}>
          {k ? <k.Icon size={13} aria-hidden /> : <Tag size={13} aria-hidden />}{(k?.label ?? "Tipo").toUpperCase()}
        </span>
        <div className={compact ? "mt-2" : "mt-3"}>
          {d.title ? <span className={`${SERIF} block truncate leading-[1.1] ${compact ? "text-[22px]" : "text-[30px]"}`} style={{ color: BOOK.text }}>{d.title}</span> : ph("70%", compact ? 20 : 26)}
        </div>
        {compact ? (
          <span className="mt-1 block truncate text-[13px] tabular-nums" style={{ color: BOOK.label }}>{when || "Sin fecha"} · {plan ?? "Sin plan"}</span>
        ) : (
          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            {([["FECHA · HORA", when], ["PLAN", plan]] as const).map(([l, v]) => (
              <div key={l} className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[10px] font-semibold tracking-[0.06em]" style={{ color: BOOK.label }}>{l}</span>
                {v ? <span className="truncate text-sm font-semibold tabular-nums" style={{ color: BOOK.text }}>{v}</span> : ph(72, 14)}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="absolute inset-y-0 right-0 grid place-content-center border-l-2 border-dashed px-2" style={{ width: stub, borderColor: "#B9C4BE" }}>
        {d.file?.qr
          ? <span className="grid place-content-center rounded-md border bg-white" style={{ width: compact ? 48 : 64, height: compact ? 48 : 64, borderColor: "#DDE3DA", color: BOOK.text }}><QrCode size={compact ? 26 : 32} /></span>
          : <span className="text-center text-xs font-semibold" style={{ color: BOOK.label }}>Sin QR</span>}
      </div>
    </div>
  );
}

/* ---------------- confirmación ---------------- */

function Confirm({ title, body, confirm, danger, onConfirm, onCancel }: {
  title: string; body: string; confirm: string; danger?: boolean; onConfirm: () => Promise<void> | void; onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const id = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-[1390] bg-black/60" onClick={onCancel} />
      <section role="alertdialog" aria-modal="true" aria-labelledby={id} onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="fixed left-1/2 top-1/2 z-[1391] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-[22px] text-[var(--text-primary)] shadow-[0_12px_24px_rgba(0,0,0,0.3),0_4px_8px_rgba(0,0,0,0.2)]">
        <h2 id={id} className="text-xl font-semibold leading-tight">{title}</h2>
        <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">{body}</p>
        {error && <p role="alert" className="text-sm text-[var(--error)]">No se pudo completar. Vuelve a intentarlo.</p>}
        <div className="mt-1.5 flex justify-end gap-2">
          <button ref={cancelRef} type="button" onClick={onCancel} className={`h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 text-sm font-semibold ${FOCUS}`}>Cancelar</button>
          <button type="button" disabled={busy}
            onClick={async () => { setBusy(true); setError(false); try { await onConfirm(); } catch { setError(true); setBusy(false); } }}
            className={`inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold disabled:opacity-60 ${FOCUS} ${danger ? "bg-[#b91c1c] text-white" : "bg-[var(--primary)] text-[var(--contrast)]"}`}>
            {danger && <Trash2 size={16} aria-hidden />}{busy ? "…" : confirm}
          </button>
        </div>
      </section>
    </>
  );
}

/* ---------------- formulario ---------------- */

const DETAIL_KEYS: [DraftKey, string, { mono?: boolean; wide?: boolean }?][] = [
  ["from", "ORIGEN"], ["to", "DESTINO"], ["place", "LUGAR", { wide: true }], ["code", "LOCALIZADOR", { mono: true }], ["endTime", "HORA DE FIN"],
  ["seat", "ASIENTO"], ["gate", "PUERTA"], ["terminal", "TERMINAL"], ["holder", "TITULAR", { wide: true }], ["notes", "NOTAS", { wide: true }],
];

export function TicketForm(p: Props) {
  const isDesktop = useIsDesktop();
  const compact = !isDesktop;
  const uid = useId();
  const id = (s: string) => `${uid}-${s}`;

  const [start] = useState<TicketDraft>(() => ({ ...EMPTY_DRAFT, planId: p.defaultPlanId ?? null, ...p.initial }));
  const [d, setD] = useState<TicketDraft>(start);
  const dRef = useRef(d);
  useEffect(() => { dRef.current = d; }, [d]);
  const [fromFile, setFromFile] = useState<Set<DraftKey>>(new Set());
  const touched = useRef(new Set<DraftKey>()); // campos que ha tocado la persona en esta sesión
  const fromFileRef = useRef(fromFile);
  useEffect(() => { fromFileRef.current = fromFile; }, [fromFile]);
  const [fileSt, setFileSt] = useState<FileState>(start.file ? { s: "done", file: start.file } : { s: "empty" });
  const [tried, setTried] = useState(false);
  const [moreOpen, setMoreOpen] = useState(() => p.mode === "edit" && DETAIL_KEYS.some(([k]) => !!start[k]));
  const [confirm, setConfirm] = useState<null | "delete" | "discard">(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionPaths = useRef(new Set<string>()); // archivos subidos en esta sesión
  const titleRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const set = <K extends DraftKey>(k: K, v: TicketDraft[K]) => {
    touched.current.add(k);
    setD((x) => ({ ...x, [k]: v }));
    setFromFile((s) => { if (!s.has(k)) return s; const n = new Set(s); n.delete(k); return n; }); // al tocarlo se quita «Del archivo»
  };

  const dirty = JSON.stringify(d) !== JSON.stringify(start);
  const errors = { title: tried && !d.title.trim(), date: tried && !d.date };
  const missing = [errors.title && "el título", errors.date && "la fecha"].filter(Boolean) as string[];

  /* ---- archivo ---- */
  const { uploadFile } = p;
  const handleFile = useCallback(async (f: File | undefined) => {
    if (!f) return;
    const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if ((!ACCEPT.split(",").includes(f.type) && !isPdf) || f.size > MAX_MB * 1024 * 1024) {
      setFileSt({ s: "error", name: f.name, message: `No se pudo subir: usa JPG, PNG o PDF de hasta ${MAX_MB} MB.` });
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setFileSt({ s: "uploading", name: f.name, pct: 0 });
    try {
      const res = await uploadFile(f, (pct) => setFileSt((st) => (st.s === "uploading" ? { ...st, pct: Math.round(pct) } : st)), ac.signal);
      // El archivo nuevo rellena todo lo que trae, también al editar un billete guardado, pero nunca pisa lo que has tocado tú.
      // Lo del archivo anterior que el nuevo no trae se vacía, para que no queden datos de otro billete.
      const cur = dRef.current;
      const before = fromFileRef.current;
      const next: TicketDraft = { ...cur, file: res.file };
      const filled = new Set<DraftKey>();
      const incoming = Object.entries(res.extracted ?? {}) as [DraftKey, string][];
      for (const k of before) {
        if (!incoming.some(([key, v]) => key === k && v)) (next as Record<string, unknown>)[k] = k === "title" || k === "date" || k === "time" ? "" : undefined;
      }
      for (const [k, v] of incoming) {
        if (v && !touched.current.has(k)) { (next as Record<string, unknown>)[k] = v; filled.add(k); }
      }
      const prevPath = cur.file?.path;
      if (prevPath && prevPath !== res.file.path && sessionPaths.current.delete(prevPath)) p.releaseFiles([prevPath]);
      sessionPaths.current.add(res.file.path);
      setD(next);
      setFromFile(filled);
      setFileSt({ s: "done", file: res.file });
      if (["from", "to", "place", "code", "seat", "gate", "terminal", "holder", "endTime"].some((k) => filled.has(k as DraftKey))) setMoreOpen(true);
    } catch {
      if (ac.signal.aborted) { const prev = dRef.current.file; setFileSt(prev ? { s: "done", file: prev } : { s: "empty" }); return; }
      setFileSt({ s: "error", name: f.name, message: "No se pudo subir. Comprueba la conexión y vuelve a intentarlo." });
    }
  }, [uploadFile, p.releaseFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- guardar ---- */
  const submit = async () => {
    setTried(true);
    if (!d.title.trim()) return titleRef.current?.focus();
    if (!d.date) return dateRef.current?.querySelector("button")?.focus();
    setSaving(true); setSaveError(false);
    try { await p.onSubmit({ ...d, title: d.title.trim() }); }
    catch { setSaveError(true); setSaving(false); }
  };

  const leave = () => { p.releaseFiles([...sessionPaths.current]); p.onClose(); };
  const close = () => (dirty ? setConfirm("discard") : leave());
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; });
  const confirmOpen = confirm !== null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" && !confirmOpen) closeRef.current(); };
    document.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [confirmOpen]);

  const uploading = fileSt.s === "uploading";
  const heading = p.mode === "edit" ? "Editar billete" : "Nuevo billete";
  const primaryLabel = saving ? "Guardando…" : p.mode === "edit" ? "Guardar" : "Añadir billete";

  /* ---- campos ---- */
  const banner = (missing.length > 0 || saveError) && (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm font-semibold" style={{ background: "#F6E4E5", color: ERR }}>
      <AlertCircle size={18} aria-hidden className="mt-px shrink-0" />
      <span>{saveError ? "No se pudo guardar. Comprueba la conexión y vuelve a intentarlo." : `Faltan ${missing.join(" y ")}.`}</span>
    </div>
  );

  const sec = (label: React.ReactNode, children: React.ReactNode) => <div className="flex flex-col gap-2">{label}{children}</div>;

  const fileField = sec(
    <Label error={fileSt.s === "error"}>ARCHIVO O QR</Label>,
    <FileZone st={fileSt} compact={compact}
      onPick={() => fileInput.current?.click()} onCamera={() => cameraInput.current?.click()}
      onCancel={() => abortRef.current?.abort()}
      onRemove={() => {
        const path = d.file?.path;
        if (path && sessionPaths.current.delete(path)) p.releaseFiles([path]);
        setD((x) => ({ ...x, file: undefined })); setFileSt({ s: "empty" });
      }} />,
  );
  const titleField = (
    <div>
      <Label htmlFor={id("title")} error={errors.title} fromFile={fromFile.has("title")}>TÍTULO</Label>
      <LineInput id={id("title")} inputRef={titleRef} value={d.title} onChange={(v) => set("title", v)} placeholder="Ej.: Vuelo de vuelta" big error={errors.title}
        describedBy={errors.title ? id("title-e") : undefined} />
      {errors.title && <FieldError id={id("title-e")}>Ponle un título</FieldError>}
    </div>
  );
  const kindField = sec(<Label fromFile={fromFile.has("type")}>TIPO</Label>, <KindPicker value={d.type} onChange={(k) => set("type", k)} compact={compact} />);
  const planField = sec(<Label>PLAN</Label>, <PlanList plans={p.plans} value={d.planId} onChange={(v) => set("planId", v)} name={id("plan")} />);
  const dateField = (
    <div>
      <div className="flex flex-col gap-4">
        <div>
          <Label error={errors.date} fromFile={fromFile.has("date")}>FECHA</Label>
          <div ref={dateRef} className="flex min-h-11 items-center gap-2" style={{ borderBottom: `${errors.date ? 2 : 1.5}px solid ${errors.date ? ERR : LINE}` }}>
            <div className="min-w-0 flex-1 [&_button]:h-11 [&_button]:w-full [&_button]:truncate [&_button]:text-[15px] [&_button]:font-semibold" aria-describedby={errors.date ? id("date-e") : undefined}>
              <DatePickerField value={d.date} onChange={(v) => set("date", v)} />
            </div>
            <Calendar size={18} aria-hidden style={{ color: BOOK.label }} />
          </div>
        </div>
        <div>
          <Label fromFile={fromFile.has("time")}>HORA</Label>
          <div style={{ borderBottom: `1.5px solid ${LINE}` }}>
            <TimePicker value={d.time} onChange={(v) => set("time", v)} label="Hora" variant="row" />
          </div>
        </div>
      </div>
      {errors.date && <FieldError id={id("date-e")}>Elige la fecha</FieldError>}
    </div>
  );
  const filledCount = DETAIL_KEYS.filter(([k]) => d[k]).length;
  const moreField = (
    <div>
      <button type="button" aria-expanded={moreOpen} aria-controls={id("more")} onClick={() => setMoreOpen((o) => !o)}
        className={`flex min-h-12 w-full items-center gap-2.5 border-t text-left ${FOCUS}`} style={{ borderColor: "#DCE3DE", color: BOOK.text }}>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">Más detalles</span>
          <span className="text-[13px]" style={{ color: BOOK.label }}>Ruta, lugar, localizador, asiento, puerta, titular, notas{filledCount ? ` · ${filledCount} rellenos` : ""}</span>
        </span>
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-[160ms] motion-reduce:transition-none ${moreOpen ? "rotate-180" : ""}`}><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {moreOpen && (
        <div id={id("more")} className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3.5 pt-2">
          {DETAIL_KEYS.map(([k, l, o]) => (
            <div key={k} className={o?.wide ? "col-span-2 md:col-span-3" : ""}>
              {k === "endTime" ? (
                <>
                  <Label fromFile={fromFile.has(k)}>{l}</Label>
                  <div style={{ borderBottom: `1.5px solid ${LINE}` }}>
                    <TimePicker value={d.endTime ?? ""} onChange={(v) => set("endTime", v)} label="Hora de fin" variant="row" />
                  </div>
                </>
              ) : (
                <>
                  <Label htmlFor={id(k)} fromFile={fromFile.has(k)}>{l}</Label>
                  <LineInput id={id(k)} mono={o?.mono} value={String(d[k] ?? "")} onChange={(v) => set(k, v as never)} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const hiddenInputs = (
    <>
      <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
    </>
  );

  const confirmEl = confirm === "delete" ? (
    <Confirm danger title="¿Eliminar este billete?" confirm="Eliminar"
      body={`Se borrarán «${start.title || "este billete"}» y su archivo. No se puede deshacer.`}
      onConfirm={async () => { await p.onDelete?.(); }} onCancel={() => setConfirm(null)} />
  ) : confirm === "discard" ? (
    <Confirm title="¿Descartar los cambios?" confirm="Descartar" body="Lo que has escrito no se guardará."
      onConfirm={leave} onCancel={() => setConfirm(null)} />
  ) : null;

  const deleteBtn = p.mode === "edit" && p.onDelete && (
    <button type="button" onClick={() => setConfirm("delete")}
      className={`inline-flex h-[46px] items-center gap-1.5 rounded-lg px-3 text-[15px] font-semibold ${FOCUS}`} style={{ color: isDesktop ? ERR : "var(--error)" }}>
      <Trash2 size={18} aria-hidden />Eliminar
    </button>
  );

  /* ---- móvil ---- */
  if (!isDesktop)
    return (
      <div role="dialog" aria-modal="true" aria-labelledby={id("h")} className="fixed inset-x-0 top-0 bottom-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom))] z-[1010] flex flex-col bg-[var(--bg)] pt-[env(safe-area-inset-top)] text-[var(--text-primary)]">
        {hiddenInputs}
        <div className="flex h-14 shrink-0 items-center gap-1 pl-1 pr-2">
          <button type="button" aria-label="Cerrar" onClick={close} className={`grid h-11 w-11 place-content-center rounded-lg ${FOCUS}`}><X size={22} aria-hidden /></button>
          <h1 id={id("h")} className={`${SERIF} text-2xl leading-tight`}>{heading}</h1>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6">
          {banner}
          <Preview d={d} plans={p.plans} width={Math.min(358, typeof window !== "undefined" ? window.innerWidth - 32 : 358)} compact />
          <div className="relative flex flex-col gap-5 rounded-[10px] px-4 pb-[22px] pt-[26px]" style={{ ...PAPER_VARS, background: BOOK.paper, color: BOOK.text, boxShadow: PAPER_SHADOW }}>
            <Band /><Band bottom />
            {fileField}{titleField}{kindField}{dateField}{planField}{moreField}
          </div>
          <div className="flex gap-2 pt-1">
            {deleteBtn}
            <button type="button" onClick={submit} disabled={uploading || saving}
              className={`h-[46px] flex-1 rounded-lg bg-[var(--primary)] text-base font-semibold text-[var(--contrast)] disabled:opacity-45 ${FOCUS}`}>{primaryLabel}</button>
          </div>
        </div>
        {confirmEl}
      </div>
    );

  /* ---- escritorio ---- */
  return (
    <>
      <div aria-hidden className="fixed inset-0 z-[1299] bg-black/60" onClick={close} />
      <section role="dialog" aria-modal="true" aria-labelledby={id("h")}
        className="fixed left-1/2 top-1/2 z-[1300] flex h-[min(780px,calc(100dvh-48px))] w-[min(1080px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl shadow-[0_18px_40px_rgba(0,0,0,0.45),0_4px_10px_rgba(0,0,0,0.3)]">
        {hiddenInputs}
        <div className="flex w-[400px] shrink-0 flex-col gap-3.5 border-r border-[var(--border)] bg-[var(--surface-2)] p-7 text-[var(--text-primary)]">
          <span className="text-xs font-semibold tracking-[0.02em] text-[var(--text-secondary)]">VISTA PREVIA</span>
          <Preview d={d} plans={p.plans} width={344} />
          {d.file && (
            <div className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <span aria-hidden className="grid h-[62px] w-12 place-content-center rounded border bg-white" style={{ borderColor: "#DDE3DA", color: BOOK.text }}>
                {d.file.qr ? <QrCode size={26} /> : <FileText size={24} />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold">{d.file.name}</span>
                <span className="text-[13px] text-[var(--text-secondary)]">{d.file.qr ? "El QR se enseña desde el billete" : d.file.size > 0 ? fmtSize(d.file.size) : ""}</span>
              </span>
            </div>
          )}
        </div>
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col" style={{ ...PAPER_VARS, background: BOOK.paper, color: BOOK.text }}>
          <Band />
          <div className="flex shrink-0 items-center gap-2 pb-1 pl-8 pr-5 pt-6">
            <h2 id={id("h")} className={`${SERIF} flex-1 text-[32px] leading-[1.1]`}>{heading}</h2>
            <button type="button" aria-label="Cerrar" onClick={close} className={`grid h-11 w-11 place-content-center rounded-lg ${FOCUS}`}><X size={22} aria-hidden /></button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pb-4 pt-3">
            {banner}{fileField}{titleField}{kindField}
            <div className="grid grid-cols-[1.15fr_1fr] items-start gap-6">
              {planField}
              {dateField}
            </div>
            {moreField}
          </div>
          <div className="relative flex shrink-0 items-center gap-2 border-t px-8 pb-[22px] pt-3.5" style={{ borderColor: "#DCE3DE" }}>
            {deleteBtn}
            <span className="flex-1" />
            <button type="button" onClick={close} className={`h-[46px] rounded-lg border-[1.5px] px-[18px] text-[15px] font-semibold ${FOCUS}`} style={{ borderColor: BOOK.text }}>Cancelar</button>
            <button type="button" onClick={submit} disabled={uploading || saving}
              className={`h-[46px] rounded-lg px-[22px] text-[15px] font-semibold text-white disabled:opacity-45 ${FOCUS}`} style={{ background: BOOK.ribbon }}>{primaryLabel}</button>
          </div>
          <Band bottom />
        </div>
      </section>
      {confirmEl}
    </>
  );
}
