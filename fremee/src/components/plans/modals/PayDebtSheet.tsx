"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ImagePlus, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { CloseButton } from "@/components/ui/IconButton";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { formatMoney } from "@/lib/formatters";
import { parseAmount, toInputText } from "@/lib/money-input";
import {
  pagarLiquidacionEndpoint,
  uploadComprobanteEndpoint,
  type MetodoPago,
} from "@/services/api/endpoints/gastos.endpoint";

const SERIF: CSSProperties = {
  fontFamily: 'var(--font-display-face), "Instrument Serif", Georgia, serif',
  fontWeight: 400,
  letterSpacing: "-0.01em",
  fontVariantNumeric: "tabular-nums",
};

const METODOS: { value: MetodoPago; label: string }[] = [
  { value: "BIZUM", label: "Bizum" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "OTRO", label: "Otro" },
];

export type PayDebt = {
  /** Fila PENDIENTE de la deuda: lo que se debe todavía. */
  liquidacionId: number;
  amount: number;
  toName: string;
  toImage: string | null;
  planTitle: string | null;
  currency?: string;
};

export type PaidResult = { pagoId: number; amount: number; toName: string };

type Props = {
  debt: PayDebt;
  me: { id: string; name: string; image: string | null };
  onClose: () => void;
  onPaid: (result: PaidResult) => void;
};

/** Hoja para pagar una deuda: total o a medias, con método y comprobante opcionales. Sirve desde el plan y desde «Mis gastos». */
export function PayDebtSheet({ debt, me, onClose, onPaid }: Props) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose, true);
  const currency = debt.currency ?? "EUR";
  const [custom, setCustom] = useState(false);
  const [amountText, setAmountText] = useState(toInputText(debt.amount));
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [attached, setAttached] = useState<{ file: File; url: string } | null>(null);
  const attachedRef = useRef(attached);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La miniatura es una URL de objeto: se libera al cambiar de archivo y al cerrar la hoja.
  const attach = (file: File | null) => {
    if (attachedRef.current) URL.revokeObjectURL(attachedRef.current.url);
    const next = file ? { file, url: URL.createObjectURL(file) } : null;
    attachedRef.current = next;
    setAttached(next);
  };
  useEffect(() => () => {
    if (attachedRef.current) URL.revokeObjectURL(attachedRef.current.url);
  }, []);
  const file = attached?.file ?? null;
  const preview = attached?.url ?? null;

  const parsed = custom ? parseAmount(amountText) : debt.amount;
  const tooMuch = parsed !== null && parsed > debt.amount;
  const invalid = parsed === null || parsed <= 0 || tooMuch;
  const remaining = parsed !== null && !tooMuch ? Math.round((debt.amount - parsed) * 100) / 100 : null;

  const amountError = !custom
    ? null
    : tooMuch
      ? `No puedes pagar más de lo que debes (${formatMoney(debt.amount, currency)}).`
      : parsed === null && amountText.trim() !== ""
        ? "Escribe un importe válido, por ejemplo 12,50."
        : null;

  const submit = async () => {
    if (invalid || saving || parsed === null) return;
    setSaving(true);
    setError(null);
    try {
      const comprobanteUrl = file ? await uploadComprobanteEndpoint(file, me.id) : null;
      const pagoId = await pagarLiquidacionEndpoint(debt.liquidacionId, {
        importe: parsed,
        metodo,
        comprobanteUrl,
      });
      onPaid({ pagoId, amount: parsed, toName: debt.toName });
      requestClose();
    } catch (err) {
      console.error(err);
      setError("No se ha podido marcar el pago. Inténtalo de nuevo.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-title"
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
        className="app-modal-panel relative z-10 w-full max-w-md rounded-t-2xl border border-app bg-app px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3 sm:rounded-2xl"
      >
        <div className="flex items-center gap-2">
          <Avatar name={me.name} src={me.image} px={32} topMargin="" />
          <ArrowRight className="size-4 text-muted" aria-hidden />
          <Avatar name={debt.toName} src={debt.toImage} px={32} topMargin="" />
          <CloseButton onClick={requestClose} className="ml-auto" />
        </div>

        <h2 id="pay-title" className="mt-2.5 text-[30px] leading-[1.1] text-app" style={SERIF}>
          Pagar a {debt.toName}
        </h2>
        {debt.planTitle && <p className="mt-0.5 text-[13px] text-muted">{debt.planTitle} · lo que le debes</p>}

        {custom ? (
          <label className="mt-4 block">
            <span className="text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">Cuánto le pagas</span>
            <span
              className={`mt-1.5 flex h-14 items-center gap-2 rounded-lg border bg-surface-2 px-3 ${amountError ? "border-[var(--error)]" : "border-[var(--border-strong)] focus-within:border-[var(--primary)]"}`}
            >
              <input
                autoFocus
                inputMode="decimal"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                aria-label={`Importe en ${currency === "EUR" ? "euros" : currency}`}
                aria-invalid={Boolean(amountError)}
                className="min-w-0 flex-1 bg-transparent text-[32px] text-app outline-none"
                style={SERIF}
              />
              <span className="text-[32px] text-muted" style={SERIF}>
                {currency === "EUR" ? "€" : currency}
              </span>
            </span>
          </label>
        ) : (
          <div className="mt-4 flex items-baseline gap-2.5">
            <p className="text-[52px] leading-none text-app" style={SERIF}>
              {formatMoney(debt.amount, currency)}
            </p>
            <button
              type="button"
              onClick={() => setCustom(true)}
              className="ml-auto inline-flex min-h-11 items-center text-[14px] font-[var(--fw-semibold)] text-primary-token"
            >
              Otra cantidad
            </button>
          </div>
        )}

        {amountError ? (
          <p className="mt-2 text-[13px] text-[var(--error)]" role="alert">
            {amountError}
          </p>
        ) : custom && remaining !== null && remaining > 0 ? (
          <p className="mt-2 text-[13px] tabular-nums text-muted">
            Le debías {formatMoney(debt.amount, currency)}. Quedarán{" "}
            <b className="font-[var(--fw-semibold)] text-app">{formatMoney(remaining, currency)}</b> pendientes.
          </p>
        ) : null}

        <p className="mt-5 text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">
          Cómo <span className="font-normal">· opcional</span>
        </p>
        <div role="radiogroup" aria-label="Cómo le pagas" className="mt-2 flex flex-wrap gap-1.5">
          {METODOS.map((m) => {
            const on = metodo === m.value;
            return (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMetodo(on ? null : m.value)}
                className={`inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-[var(--fw-semibold)] ${on ? "border-2 border-[var(--primary)] px-[13px] text-app" : "border border-[var(--border-strong)] text-muted"}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {file && preview ? (
          <div className="mt-4 flex min-h-14 items-center gap-3 rounded-lg border border-[var(--border-strong)] p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="size-11 shrink-0 rounded-md object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-[var(--fw-semibold)] text-app">{file.name}</span>
              <span className="text-[12px] text-muted">Comprobante</span>
            </span>
            <button
              type="button"
              aria-label="Quitar el comprobante"
              onClick={() => attach(null)}
              className="flex size-11 shrink-0 items-center justify-center text-muted"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <label className="mt-4 flex h-[46px] cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-4 text-[15px] font-[var(--fw-semibold)] text-app">
            <ImagePlus className="size-[18px]" aria-hidden />
            Añadir captura del pago
            <span className="ml-auto text-[13px] font-[var(--fw-medium)] text-muted">opcional</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) attach(f);
                e.target.value = "";
              }}
            />
          </label>
        )}

        {error && (
          <p className="mt-3 text-[13px] text-[var(--error)]" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={invalid || saving}
          onClick={() => void submit()}
          className="mt-5 flex h-[46px] w-full items-center justify-center rounded-lg bg-[var(--primary,#298e7d)] text-[15px] font-[var(--fw-semibold)] text-white transition-colors disabled:bg-surface-2 disabled:text-muted"
        >
          {saving ? "Marcando…" : "Ya le he pagado"}
        </button>
        <p className="mt-2.5 text-center text-[12px] text-muted">{debt.toName} tendrá que confirmar que le ha llegado.</p>
      </div>
    </div>
  );
}
