"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, MapPin, MoreHorizontal, Pencil, Tag, Trash2 } from "lucide-react";
import { deleteGastoEndpoint, type GastoRow } from "@/services/api/endpoints/gastos.endpoint";
import { formatMoney } from "@/lib/formatters";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { Avatar } from "@/components/ui/Avatar";
import { CloseButton } from "@/components/ui/IconButton";
import { DiscardChangesDialog } from "@/components/ui/DiscardChangesDialog";
import { owedToPayer, shareOf } from "@/lib/gastos-shares";

/* Resumen de un gasto. Hoja en móvil y diálogo de 520 px en escritorio.
 * Orden fijo: qué es, cuánto, qué es para ti, los datos y entre quién. */

const SERIF: CSSProperties = {
  fontFamily: 'var(--font-display-face), "Instrument Serif", Georgia, serif',
  fontWeight: 400,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
};
const ME_TINT = "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]";
const ME_CHIP = "border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)]";
const CHIPS_SHOWN = 7;
const BIG_GROUP = 10;
const ROWS_SHOWN = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const first = (name: string | null | undefined) => (name ?? "Usuario").trim().split(" ")[0] || "Usuario";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const wd = new Intl.DateTimeFormat("es-ES", { weekday: "short" }).format(d).replace(".", "");
  const mo = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(d).replace(".", "");
  return { wd, label: `${d.getDate()} ${mo}` };
}
/** «Dom 22 nov, 14:35» */
function whenLabel(iso: string) {
  const { wd, label } = dayLabel(iso);
  const d = new Date(iso);
  return `${cap(wd)} ${label}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
/** «dom 22 nov» */
function addedLabel(iso: string) {
  const { wd, label } = dayLabel(iso);
  return `${wd} ${label}`;
}
function joinNames(names: string[]) {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

type Person = { id: string; name: string; image: string | null; amount: number; me: boolean };
type Member = { id: string; nombre: string | null; foto: string | null };

function PersonChip({ p }: { p: Person }) {
  return (
    <span className={`inline-flex h-8 items-center gap-1.5 rounded-full border py-0 pl-[3px] pr-2.5 text-[13px] font-[var(--fw-medium)] text-app ${p.me ? ME_CHIP : "border-app"}`}>
      <Avatar name={p.name} src={p.image} px={26} topMargin="" className={p.me ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)]" : ""} />
      {p.name}
    </span>
  );
}

function Stack({ people, total }: { people: Person[]; total: number }) {
  const shown = people.slice(0, 5);
  const rest = total - shown.length;
  return (
    <span className="inline-flex items-center" aria-hidden>
      {shown.map((p, i) => (
        <Avatar key={p.id} name={p.name} src={p.image} px={28} topMargin="" className={`ring-2 ring-[var(--bg)] ${i > 0 ? "-ml-2" : ""}`} />
      ))}
      {rest > 0 && (
        <span className="-ml-2 inline-flex h-7 min-w-9 items-center justify-center rounded-full border border-app bg-surface-2 px-1.5 text-[11px] font-[var(--fw-semibold)] text-app ring-2 ring-[var(--bg)]">
          +{rest}
        </span>
      )}
    </span>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

type PlanGastoDetailModalProps = {
  gasto: GastoRow | null;
  currentUserId: string | null;
  /** Miembros del plan: sirven para decir «Todo el grupo» o «Todos menos Ana». */
  members: Member[];
  /** Quien añadió el gasto y quien administra el plan pueden anularlo. */
  isAdmin: boolean;
  onClose: () => void;
  /** Abre la edición del gasto; si falta, el menú no ofrece «Editar». */
  onEdit?: (gasto: GastoRow) => void;
  /** Lleva al itinerario cuando el gasto es de una actividad. */
  onOpenActivity?: (subplanId: number) => void;
  /** Called after the expense is voided; omit to hide the delete button. */
  onDeleted?: () => void;
};

export function PlanGastoDetailModal({ gasto, currentUserId, members, isAdmin, onClose, onEdit, onOpenActivity, onDeleted }: PlanGastoDetailModalProps) {
  // The page keeps this mounted with gasto = null while closed: only lock the page scroll
  // while an expense is shown, or the closed instance restores a stale scroll position.
  const { isClosing, requestClose } = useModalCloseAnimation(onClose, gasto !== null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [allRows, setAllRows] = useState(false);

  const model = useMemo(() => {
    if (!gasto) return null;
    const meId = currentUserId;
    const payerShare = shareOf(gasto, gasto.pagado_por_user_id);
    const people: Person[] = (gasto.partes ?? []).map((p) => ({
      id: p.user_id,
      name: p.user_id === meId ? "Tú" : first(p.nombre),
      image: p.foto ?? null,
      amount: Number(p.importe),
      me: p.user_id === meId,
    }));
    // La parte de quien paga no se guarda: sale de lo que sobra del total.
    if (payerShare > 0.005) {
      people.push({
        id: gasto.pagado_por_user_id,
        name: gasto.pagado_por_user_id === meId ? "Tú" : first(gasto.pagado_por_nombre),
        image: gasto.pagado_por_foto ?? null,
        amount: payerShare,
        me: gasto.pagado_por_user_id === meId,
      });
    }
    // Yo primero; el resto en el orden en que vienen.
    people.sort((a, b) => Number(b.me) - Number(a.me));

    const ids = new Set(people.map((p) => p.id));
    const missing = members.filter((m) => !ids.has(m.id));
    const n = people.length;
    const m = members.length || n;
    const equal = gasto.metodo_reparto === "IGUAL";
    const each = (gasto.partes ?? [])[0] ? Number((gasto.partes ?? [])[0].importe) : n > 0 ? gasto.total / n : 0;

    let heading: string;
    if (n === 1) heading = people[0].me ? "Solo tú" : `Solo ${people[0].name}`;
    else if (missing.length === 0) heading = m > BIG_GROUP ? "Todo el grupo" : `Entre los ${n}`;
    else if (missing.length <= 3 && n > BIG_GROUP) heading = `Todos menos ${joinNames(missing.map((x) => first(x.nombre)))}`;
    else heading = `Entre ${n} de ${m}`;
    const stacked = equal && n > BIG_GROUP && (missing.length === 0 || missing.length <= 3);

    // En el reparto igual, el céntimo del redondeo lo pone quien paga.
    let roundingNote: string | null = null;
    if (equal && payerShare > 0.005) {
      const cents = Math.round((payerShare - each) * 100);
      if (cents !== 0 && Math.abs(cents) <= 5) {
        const who = gasto.pagado_por_user_id === meId ? "Tú pones" : `${first(gasto.pagado_por_nombre)} pone`;
        const qty = Math.abs(cents) === 1 ? "un céntimo" : `${Math.abs(cents)} céntimos`;
        roundingNote = `${who} ${qty} ${cents > 0 ? "más" : "menos"} por el redondeo`;
      }
    }

    const byAmount = [...people].sort((a, b) => Number(b.me) - Number(a.me) || b.amount - a.amount);
    return { people, byAmount, n, equal, each, heading, stacked, roundingNote, payerShare };
  }, [gasto, members, currentUserId]);

  if (!gasto || !model) return null;

  const meId = currentUserId;
  const paidByMe = gasto.pagado_por_user_id === meId;
  const myShare = shareOf(gasto, meId);
  const owed = paidByMe ? owedToPayer(gasto) : 0;
  const canManage = (Boolean(onDeleted) || Boolean(onEdit)) && (isAdmin || (meId !== null && gasto.created_by_user_id === meId));
  const payerName = paidByMe ? "Tú" : first(gasto.pagado_por_nombre);
  const category = gasto.categoria_nombre ?? "Gasto";
  const description = gasto.descripcion?.trim();

  const handleDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteGastoEndpoint(gasto.id);
      onDeleted?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "No se ha podido anular el gasto.");
    } finally {
      setDeleting(false);
    }
  };

  const chipsAll = model.people;
  const chipsShown = expanded || model.n <= BIG_GROUP ? chipsAll : chipsAll.slice(0, CHIPS_SHOWN);
  const rows = allRows ? model.byAmount : model.byAmount.slice(0, ROWS_SHOWN);

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gasto-title"
    >
      <button
        type="button"
        aria-label="Cerrar"
        data-closing={isClosing ? "true" : "false"}
        className="app-modal-overlay absolute inset-0"
        onClick={requestClose}
      />
      <div
        data-closing={isClosing ? "true" : "false"}
        className="app-modal-panel relative z-10 max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-2xl border border-app bg-app px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 sm:rounded-2xl sm:px-6 sm:pt-5"
      >
        <div className="relative flex items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-2.5 text-[12px] font-[var(--fw-semibold)] text-app">
            <Tag className="size-3.5" aria-hidden />
            {category}
          </span>
          {canManage && (
            <button
              type="button"
              aria-label="Más opciones"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="ml-auto flex size-11 items-center justify-center rounded-lg text-app"
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          )}
          <CloseButton onClick={requestClose} label="Cerrar" className={canManage ? "" : "ml-auto"} />
          {menuOpen && (
            <div role="menu" className="absolute right-12 top-11 z-10 w-52 rounded-lg border border-app bg-[var(--bg)] p-1 shadow-elev-3">
              {onEdit && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(gasto);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-[15px] text-app"
                >
                  <Pencil className="size-[18px]" aria-hidden />
                  Editar
                </button>
              )}
              {onDeleted && (
              <button
                type="button"
                role="menuitem"
                disabled={deleting}
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteError(null);
                  setConfirmOpen(true);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-[15px] text-app disabled:opacity-[var(--disabled-opacity)]"
              >
                <Trash2 className="size-[18px]" aria-hidden />
                Anular el gasto
              </button>
              )}
            </div>
          )}
        </div>

        <h2 id="gasto-title" className="mt-2 text-[30px] leading-[1.1] text-app" style={SERIF}>
          {gasto.titulo}
        </h2>
        <p className="mt-2.5 text-[52px] leading-none text-app" style={SERIF}>
          {formatMoney(gasto.total, gasto.moneda)}
        </p>

        <p className={`mt-3.5 flex min-h-11 items-center gap-2 rounded-lg px-3 text-[15px] text-app ${ME_TINT}`}>
          {paidByMe ? (
            <>
              <span>{myShare > 0.005 ? `Pagaste tú · tu parte ${formatMoney(myShare, gasto.moneda)}` : "Pagaste tú · no participas"}</span>
              {owed > 0.005 && <b className="ml-auto font-[var(--fw-semibold)] tabular-nums text-[var(--success)]">te deben {formatMoney(owed, gasto.moneda)}</b>}
            </>
          ) : myShare > 0.005 ? (
            <>
              Tu parte
              <b className="ml-auto font-[var(--fw-semibold)] tabular-nums">{formatMoney(myShare, gasto.moneda)}</b>
            </>
          ) : (
            "No participas"
          )}
        </p>

        <dl className="mt-[18px] grid grid-cols-2 gap-x-4 gap-y-3.5">
          <div>
            <dt className="text-[12px] text-muted">Pagó</dt>
            <dd className="mt-0.5 flex min-w-0 items-center gap-2 text-[15px] font-[var(--fw-semibold)] text-app">
              <Avatar name={payerName} src={gasto.pagado_por_foto} px={26} topMargin="" />
              <span className="truncate">{payerName}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Cuándo</dt>
            <dd className="mt-0.5 text-[15px] font-[var(--fw-semibold)] tabular-nums text-app">{whenLabel(gasto.fecha_gasto)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-muted">Actividad</dt>
            <dd className="mt-0.5 min-w-0 text-[15px] font-[var(--fw-semibold)]">
              {gasto.subplan_id && gasto.subplan_titulo ? (
                <button
                  type="button"
                  onClick={() => {
                    onOpenActivity?.(gasto.subplan_id!);
                    requestClose();
                  }}
                  className="flex max-w-full items-center gap-1 text-primary-token"
                >
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{gasto.subplan_titulo}</span>
                </button>
              ) : (
                <span className="font-[var(--fw-medium)] text-muted">Ninguna</span>
              )}
            </dd>
          </div>
          {gasto.receipt_url && (
            <div>
              <dt className="text-[12px] text-muted">Ticket</dt>
              <dd className="mt-0.5">
                <a href={gasto.receipt_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[14px] text-primary-token">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={gasto.receipt_url} alt="" className="size-8 rounded-md border border-app object-cover" />
                  Ver foto
                </a>
              </dd>
            </div>
          )}
        </dl>

        {description && <p className="mt-3.5 text-[14px] leading-[1.45] text-muted">{description}</p>}

        <div className="mt-5 border-t border-app pt-3.5">
          <p className="flex items-baseline gap-2 text-[15px] font-[var(--fw-semibold)] text-app">
            {model.heading}
            <span className="ml-auto text-[13px] font-[var(--fw-medium)] tabular-nums text-muted">
              {model.equal ? `A partes iguales · ${formatMoney(model.each, gasto.moneda)} cada uno` : "Por importes"}
            </span>
          </p>
          {model.roundingNote && <p className="mt-0.5 text-[12px] text-muted">{model.roundingNote}</p>}

          {!model.equal ? (
            <div className="mt-1">
              {rows.map((p) => (
                <div key={p.id} className="flex min-h-11 items-center gap-2.5 border-b border-app">
                  <Avatar name={p.name} src={p.image} px={28} topMargin="" />
                  <span className={`min-w-0 flex-1 truncate text-[14px] ${p.me ? "font-[var(--fw-semibold)]" : ""} text-app`}>{p.name}</span>
                  <span className="text-[14px] font-[var(--fw-semibold)] tabular-nums text-app">{formatMoney(p.amount, gasto.moneda)}</span>
                </div>
              ))}
              {!allRows && model.byAmount.length > ROWS_SHOWN && (
                <button type="button" onClick={() => setAllRows(true)} className="flex min-h-11 w-full items-center justify-center gap-1 text-[14px] font-[var(--fw-semibold)] text-app">
                  Ver los {model.byAmount.length - ROWS_SHOWN} restantes
                  <ChevronDown className="size-4" aria-hidden />
                </button>
              )}
            </div>
          ) : model.stacked && !expanded ? (
            <button type="button" aria-expanded={false} onClick={() => setExpanded(true)} className="mt-2 flex min-h-12 w-full items-center gap-2.5 text-left">
              <Stack people={chipsAll} total={model.n} />
              <span className="text-[14px] text-app">
                {model.heading === "Todo el grupo" ? `${model.n} personas` : `${model.n} de ${members.length}`}
              </span>
              <span className="ml-auto flex items-center gap-1 text-[13px] text-muted">
                Ver quién
                <ChevronRight className="size-4" aria-hidden />
              </span>
            </button>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {chipsShown.map((p) => (
                <PersonChip key={p.id} p={p} />
              ))}
              {model.n > BIG_GROUP && !expanded && (
                <button type="button" aria-expanded={false} onClick={() => setExpanded(true)} className="inline-flex h-8 items-center rounded-full border border-app px-3 text-[13px] font-[var(--fw-semibold)] text-app">
                  +{model.n - CHIPS_SHOWN} más
                </button>
              )}
              {model.n > BIG_GROUP && expanded && (
                <button type="button" aria-expanded onClick={() => setExpanded(false)} className="inline-flex h-8 items-center rounded-full border border-app px-3 text-[13px] font-[var(--fw-semibold)] text-app">
                  Ver menos
                </button>
              )}
            </div>
          )}
        </div>

        <p className="mt-3.5 text-[12px] text-muted">
          Añadido por {gasto.created_by_user_id === meId ? "ti" : first(gasto.created_by_nombre)} · {addedLabel(gasto.created_at)}
        </p>
        {deleteError && (
          <p className="mt-2 text-[13px] text-[var(--error)]" role="alert">
            {deleteError}
          </p>
        )}
      </div>

      <DiscardChangesDialog
        open={confirmOpen}
        title="Anular gasto"
        message={`Se anulará "${gasto.titulo}" y se recalcularán las deudas del plan. Si alguien ya ha pagado algo, se mantiene: si ha pagado de más, se le devolverá como una deuda.`}
        confirmLabel="Anular"
        onCancel={() => setConfirmOpen(false)}
        onDiscard={() => void handleDelete()}
      />
    </div>
  );
}
