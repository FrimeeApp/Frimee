"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { FOCUS, GHOST_BTN } from "@/components/plans/home/pieces";
import { buildIndex, countryName, dateLabel, planRangeLabel, type PassportPage, type Sello } from "@/lib/passport";
import { CountryStamp, HITO_NAME, HitoStamp, PlanStamp } from "./stamps";

/** Índice del pasaporte (tablero «Índice»): países, planes e hitos en texto, cada uno con su página. Pulsar uno salta a ella. */

type Tab = "paises" | "planes" | "hitos" | "ocultos";
const pad2 = (n: number) => String(n).padStart(2, "0");

export default function PassportIndex({
  sellos,
  pages,
  onPick,
  onClose,
  onRestore,
}: {
  sellos: Sello[];
  pages: PassportPage[];
  onPick: (pageNumber: number) => void;
  onClose: () => void;
  /** Vuelve a mostrar un sello oculto (solo en tu pasaporte). */
  onRestore?: (s: Sello) => Promise<void>;
}) {
  const data = useMemo(() => buildIndex(sellos, pages), [sellos, pages]);
  const [tab, setTab] = useState<Tab>("paises");
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    panelRef.current?.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" });
  }, []);
  useEffect(() => closeRef.current?.focus(), []);

  const tabs: { id: Tab; label: string; n: number }[] = [
    { id: "paises", label: "Países", n: data.paises.length },
    { id: "planes", label: "Planes", n: data.planes.length },
    ...(data.hitos.length > 0 ? [{ id: "hitos" as const, label: "Hitos", n: data.hitos.length }] : []),
    ...(onRestore && data.ocultos.length > 0 ? [{ id: "ocultos" as const, label: "Ocultos", n: data.ocultos.length }] : []),
  ];

  return (
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center bg-black/40 md:items-start md:p-8" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Índice del pasaporte"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-[460px] flex-col overflow-hidden bg-surface text-app md:max-h-[min(720px,calc(100dvh-64px))] md:rounded-[8px] md:border md:border-app"
      >
        <div className="flex h-14 shrink-0 items-center gap-1 pl-4 pr-1">
          <h2 className="m-0 flex-1 font-sans text-[18px] font-[var(--fw-semibold)] leading-[1.3]">Índice del pasaporte</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Cerrar el índice" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <X className="size-[22px]" aria-hidden />
          </button>
        </div>

        <div role="tablist" aria-label="Índice" className="flex shrink-0 border-b border-app px-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px flex h-12 flex-1 items-center justify-center gap-1.5 border-b-2 text-[14px] font-[var(--fw-semibold)] leading-[1.2] ${FOCUS} ${tab === t.id ? "border-[var(--text-primary)] text-app" : "border-transparent text-muted"}`}
            >
              {t.label}
              <span className="font-normal tabular-nums text-muted">{t.n}</span>
            </button>
          ))}
        </div>

        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-4 pb-4 pt-1">
          {tab === "paises" &&
            data.paises.map((p, i) => (
              <Row key={p.code} first={i === 0} onClick={() => p.page !== null && onPick(p.page)} page={p.page} title={p.name} sub={`${p.count === 1 ? "1 sello" : `${p.count} sellos`} · ${p.count > 1 ? "último " : ""}${dateLabel(p.last)}`}>
                <CountryStamp sello={p.sello} size={52} tilt={0} />
              </Row>
            ))}
          {tab === "planes" &&
            data.planes.map((p, i) => (
              <Row key={p.sello.id} first={i === 0} onClick={() => p.page !== null && onPick(p.page)} page={p.page} title={p.titulo} sub={p.sello.plan ? planRangeLabel(p.sello.plan) : dateLabel(p.sello.stamped_at)}>
                <PlanStamp sello={p.sello} size={72} tilt={0} />
              </Row>
            ))}
          {tab === "hitos" &&
            data.hitos.map((h, i) => (
              <Row key={h.sello.id} first={i === 0} onClick={() => h.page !== null && onPick(h.page)} page={h.page} title={HITO_NAME[h.sello.hito!]} sub={dateLabel(h.sello.stamped_at)}>
                <HitoStamp hito={h.sello.hito!} id={h.sello.id} size={52} />
              </Row>
            ))}
          {tab === "ocultos" && (
            <>
              <li className="py-3 text-[14px] leading-[1.5] text-muted">Viajes ocultos: solo los ves tú. No salen en las páginas ni los ve nadie más.</li>
              {data.ocultos.map((o, i) => (
                <HiddenRow key={o.id} first={i === 0} sello={o} onRestore={onRestore} />
              ))}
            </>
          )}
          {((tab === "paises" && data.paises.length === 0) || (tab === "planes" && data.planes.length === 0)) && (
            <li className="py-6 text-[14px] leading-[1.5] text-muted">Aún no hay sellos. Llegan el día siguiente a que termine cada viaje.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function Row({ first, page, title, sub, onClick, children }: { first: boolean; page: number | null; title: string; sub: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <li className={first ? "" : "border-t border-app"}>
      <button type="button" onClick={onClick} disabled={page === null} className={`flex min-h-[72px] w-full items-center gap-3 bg-transparent py-1 text-left text-app disabled:cursor-default ${FOCUS}`}>
        <span aria-hidden="true" className="flex w-[72px] shrink-0 items-center justify-center">
          {children}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-[var(--fw-semibold)] leading-[1.35]">{title}</span>
          <span className="truncate text-[14px] leading-[1.5] tabular-nums text-muted">{sub}</span>
        </span>
        {page !== null && (
          <>
            <span className="text-[14px] tabular-nums text-muted">pág. {pad2(page)}</span>
            <ChevronRight className="size-[18px] shrink-0 text-muted" aria-hidden />
          </>
        )}
      </button>
    </li>
  );
}

function HiddenRow({ first, sello, onRestore }: { first: boolean; sello: Sello; onRestore?: (s: Sello) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = sello.kind === "pais" ? countryName(sello.country_code ?? "") : sello.kind === "hito" ? HITO_NAME[sello.hito!] : sello.plan?.titulo ?? "Viaje";
  const restore = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onRestore?.(sello);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <li className={`flex min-h-[72px] items-center gap-3 py-1 ${first ? "" : "border-t border-app"}`}>
      <span aria-hidden="true" className="flex w-[72px] shrink-0 items-center justify-center">
        {sello.kind === "pais" ? <CountryStamp sello={sello} size={52} tilt={0} /> : sello.kind === "hito" ? <HitoStamp hito={sello.hito!} id={sello.id} size={52} /> : <PlanStamp sello={sello} size={72} tilt={0} />}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[16px] font-[var(--fw-semibold)] leading-[1.35]">{title}</span>
        <span className="truncate text-[14px] leading-[1.5] tabular-nums text-muted">{failed ? "No se pudo. Reintenta." : dateLabel(sello.stamped_at)}</span>
      </span>
      <button type="button" disabled={busy} onClick={() => void restore()} className={`${GHOST_BTN} !h-11 shrink-0 !px-3 !text-[14px]`}>
        Mostrar
      </button>
    </li>
  );
}
