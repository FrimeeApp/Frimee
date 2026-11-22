"use client";

import { useState, type CSSProperties } from "react";
import { ChevronRight } from "lucide-react";
import { CloseButton } from "@/components/ui/IconButton";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { formatMoney } from "@/lib/formatters";
import { parseAmount, toInputText } from "@/lib/money-input";
import { setPresupuestoEndpoint, setTopeEndpoint, type Topes } from "@/services/api/endpoints/gastos.endpoint";

/* Presupuesto del grupo y tope personal de la pestaña Gastos. Son una referencia: se pueden pasar. Sin color
 * de alarma: lo dicen el texto y el rayado. */

const SERIF: CSSProperties = {
  fontFamily: 'var(--font-display-face), "Instrument Serif", Georgia, serif',
  fontWeight: 400,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
};
const HATCH = "repeating-linear-gradient(135deg, var(--border-strong) 0 2px, transparent 2px 6px)";
const pctOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

type Segment = { label: string; amount: number; shade: number };

/** Barra con un tope: su largo es el tope; al pasarse se reescala, una línea marca el tope y lo que sobra va rayado. */
function Bar({ segments, spent, limit, tone, label }: { segments: Segment[]; spent: number; limit: number; tone: string; label: string }) {
  const over = spent > limit;
  const scale = over ? spent : limit;
  const markAt = over ? (limit / scale) * 100 : 100;
  return (
    <div role="img" aria-label={label} className="relative mt-1">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded bg-surface-2 max-md:h-2.5">
        {segments.map((s) => (
          <i key={s.label} className="block h-full" style={{ width: `${Math.min(100, (s.amount / scale) * 100)}%`, background: tone, opacity: s.shade }} />
        ))}
      </div>
      {over && (
        <>
          <div aria-hidden className="absolute inset-y-0 right-0 rounded-r" style={{ left: `${markAt}%`, background: HATCH }} />
          <div aria-hidden className="absolute -inset-y-1 w-0.5 bg-[var(--text-primary)]" style={{ left: `calc(${markAt}% - 1px)` }} />
        </>
      )}
    </div>
  );
}

/** Presupuesto del grupo, en «Entre los N». */
export function GroupBudget({
  spent, limit, currency, people, segments, onEdit,
}: {
  spent: number; limit: number; currency: string; people: number; segments: Segment[]; onEdit?: () => void;
}) {
  const over = spent > limit;
  const header = (
    <>
      <span className="text-[13px] tabular-nums text-app">
        <b className="font-[var(--fw-semibold)]">{formatMoney(spent, currency)}</b> <span className="text-muted">de {formatMoney(limit, currency)}</span>
      </span>
      <span className="ml-auto text-[13px] font-[var(--fw-semibold)] tabular-nums text-app">{pctOf(spent, limit)} %</span>
      {onEdit && <ChevronRight className="size-4 shrink-0 self-center text-muted" aria-hidden />}
    </>
  );
  return (
    <div className="mt-3">
      {onEdit ? (
        <button type="button" onClick={onEdit} aria-label="Editar el presupuesto" className="flex min-h-8 w-full items-baseline gap-2 text-left">
          {header}
        </button>
      ) : (
        <div className="flex min-h-8 w-full items-baseline gap-2">{header}</div>
      )}
      <Bar
        segments={segments}
        spent={spent}
        limit={limit}
        tone="var(--text-primary)"
        label={`Gastado ${formatMoney(spent, currency)} de un presupuesto de ${formatMoney(limit, currency)}`}
      />
      <p className="mt-2 text-[13px] tabular-nums text-muted">
        {over ? (
          <>
            Os habéis pasado <b className="font-[var(--fw-semibold)] text-app">{formatMoney(spent - limit, currency)}</b> · {pctOf(spent - limit, limit)} % más de lo previsto
          </>
        ) : (
          <>
            Quedan <b className="font-[var(--fw-semibold)] text-app">{formatMoney(limit - spent, currency)}</b>
            {people > 0 && ` · ${formatMoney((limit - spent) / people, currency)} por persona`}
          </>
        )}
      </p>
    </div>
  );
}

/** Tope personal, en «Tu cuenta»: solo lo ve su dueño y se compara con «tu parte». */
export function MyTope({ share, limit, currency, onEdit }: { share: number; limit: number; currency: string; onEdit?: () => void }) {
  const over = share > limit;
  const body = (
    <>
      <span className="text-[13px] tabular-nums text-app">
        Tu parte <b className="font-[var(--fw-semibold)]">{formatMoney(share, currency)}</b> <span className="text-muted">de tu tope de {formatMoney(limit, currency)}</span>
      </span>
      <span className="ml-auto inline-flex h-5 shrink-0 items-center rounded-full border border-app px-[7px] text-[11px] font-[var(--fw-semibold)] text-app">Solo tú</span>
      {onEdit && <ChevronRight className="size-4 shrink-0 self-center text-muted" aria-hidden />}
    </>
  );
  return (
    <div className="mt-3.5 border-t border-app pt-3">
      {onEdit ? (
        <button type="button" onClick={onEdit} aria-label="Editar tu tope" className="flex min-h-8 w-full items-center gap-2 text-left">
          {body}
        </button>
      ) : (
        <div className="flex min-h-8 w-full items-center gap-2">{body}</div>
      )}
      <Bar segments={[{ label: "tu parte", amount: share, shade: 1 }]} spent={share} limit={limit} tone="var(--primary)" label={`Tu parte ${formatMoney(share, currency)} de tu tope de ${formatMoney(limit, currency)}`} />
      <p className="mt-2 text-[13px] tabular-nums text-muted">
        {over ? (
          <>Te has pasado <b className="font-[var(--fw-semibold)] text-app">{formatMoney(share - limit, currency)}</b></>
        ) : (
          <>Te quedan <b className="font-[var(--fw-semibold)] text-app">{formatMoney(limit - share, currency)}</b></>
        )}
      </p>
    </div>
  );
}

/** Botón discreto para poner el primer tope o presupuesto. */
export function AddBudgetButton({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-3 text-left text-[14px] font-[var(--fw-semibold)] text-[var(--primary)]">
      {label}
      {hint && <span className="ml-auto text-[12px] font-[var(--fw-medium)] text-muted">{hint}</span>}
    </button>
  );
}

// ── Hoja «Presupuesto» ────────────────────────────────────────────────────────

type Mode = "grupo" | "mio";

type SheetProps = {
  planId: number;
  initialMode: Mode;
  isAdmin: boolean;
  topes: Topes;
  currency: string;
  /** Gastado en total entre todos y lo que te toca a ti. */
  spent: number;
  yourShare: number;
  people: number;
  onClose: () => void;
  onSaved: () => void;
};

export function BudgetSheet({ planId, initialMode, isAdmin, topes, currency, spent, yourShare, people, onClose, onSaved }: SheetProps) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose, true);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [texts, setTexts] = useState<Record<Mode, string>>({
    grupo: topes.grupo ? toInputText(topes.grupo.limite) : "",
    mio: topes.mio ? toInputText(topes.mio.limite) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const text = texts[mode];
  const amount = parseAmount(text);
  const existing = mode === "grupo" ? topes.grupo : topes.mio;
  const locked = mode === "grupo" && !isAdmin;
  const invalid = text.trim() !== "" && (amount === null || amount <= 0);
  const canSave = !locked && !saving && amount !== null && amount > 0;
  const compared = mode === "grupo" ? spent : yourShare;

  const save = async (limite: number | null) => {
    setSaving(true);
    setError(null);
    try {
      if (mode === "grupo") await setPresupuestoEndpoint(planId, limite, currency);
      else await setTopeEndpoint(planId, limite, currency);
      onSaved();
      requestClose();
    } catch (err) {
      console.error(err);
      setError("No se ha podido guardar. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  const tabs: [Mode, string][] = [["grupo", "Del grupo"], ["mio", "Solo mío"]];

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="budget-title">
      <button type="button" aria-label="Cerrar" data-closing={isClosing ? "true" : "false"} className="app-modal-overlay absolute inset-0" onClick={requestClose} />
      <div
        data-closing={isClosing ? "true" : "false"}
        className="app-modal-panel relative z-10 w-full max-w-md rounded-t-2xl border border-app bg-app px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 sm:rounded-2xl"
      >
        <div className="flex items-center">
          <h2 id="budget-title" className="text-[30px] leading-[1.1] text-app" style={SERIF}>Presupuesto</h2>
          <CloseButton onClick={requestClose} className="ml-auto" />
        </div>

        <div role="tablist" aria-label="De quién es" className="mt-3 flex rounded-lg border border-app bg-surface-2 p-0.5">
          {tabs.map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(null); }}
              className={`h-10 flex-1 rounded-md text-[14px] font-[var(--fw-semibold)] ${mode === m ? "bg-[var(--bg)] text-app shadow-elev-1" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">{mode === "grupo" ? "Para todo el viaje" : "Para tu parte"}</span>
          <span className={`mt-1.5 flex h-14 items-center gap-2 rounded-lg border bg-surface-2 px-3 ${invalid ? "border-[var(--error)]" : "border-[var(--border-strong)] focus-within:border-[var(--primary)]"} ${locked ? "opacity-60" : ""}`}>
            <input
              inputMode="decimal"
              value={text}
              disabled={locked}
              onChange={(e) => setTexts((t) => ({ ...t, [mode]: e.target.value }))}
              placeholder="0,00"
              aria-label={`Importe en ${currency === "EUR" ? "euros" : currency}`}
              aria-invalid={invalid}
              className="min-w-0 flex-1 bg-transparent text-[32px] text-app outline-none placeholder:text-muted"
              style={SERIF}
            />
            <span className="text-[32px] text-muted" style={SERIF}>{currency === "EUR" ? "€" : currency}</span>
          </span>
        </label>

        {invalid ? (
          <p className="mt-2 text-[13px] text-[var(--error)]" role="alert">Escribe un importe válido, por ejemplo 2.000,00.</p>
        ) : mode === "grupo" ? (
          <p className="mt-2 text-[13px] tabular-nums text-muted">
            {amount && people > 0 ? `${formatMoney(amount / people, currency)} por persona · ` : ""}
            lleváis {formatMoney(compared, currency)}{amount ? ` (${pctOf(compared, amount)} %)` : ""}
          </p>
        ) : (
          <p className="mt-2 text-[13px] tabular-nums text-muted">
            Se compara con tu parte: ahora {formatMoney(compared, currency)}{amount ? ` (${pctOf(compared, amount)} %)` : ""}
          </p>
        )}
        {(locked || mode === "grupo") && (
          <p className="mt-1.5 text-[13px] text-muted">
            {locked ? "El del grupo lo pone quien administra el plan." : "Lo ve todo el grupo. Lo cambia quien administra el plan."}
          </p>
        )}

        {error && <p role="alert" className="mt-3 text-[13px] text-[var(--error)]">{error}</p>}

        <div className="mt-5 flex items-center gap-3">
          {existing && !locked && (
            <button type="button" disabled={saving} onClick={() => void save(null)} className="h-[46px] rounded-lg border border-[var(--border-strong)] px-4 text-[15px] font-[var(--fw-semibold)] text-app disabled:opacity-60">
              Quitar
            </button>
          )}
          <button
            type="button"
            disabled={!canSave}
            onClick={() => amount !== null && void save(amount)}
            className="h-[46px] flex-1 rounded-lg bg-[var(--primary,#298e7d)] text-[15px] font-[var(--fw-semibold)] text-white transition-colors disabled:bg-surface-2 disabled:text-muted"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
