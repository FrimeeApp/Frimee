"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import AddTicketModal from "@/components/wallet/AddTicketModal";
import {
  AddTicketSheet, ConfirmDelete, FOCUS, ON_PRIMARY, Plus, SERIF, T2, ChevronLeft, ChevronRight,
  TicketBig, TicketDetail, TicketRow, WalletError, WalletSkeleton,
  type Ticket, type TicketKind,
} from "@/components/wallet/WalletUI";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { fetchPlansByIds } from "@/services/api/endpoints/plans.endpoint";
import {
  deleteTicketEndpoint, getTicketSourceSignedUrl, listTicketsEndpoint, updateTicketEndpoint, uploadTicketSourceEndpoint,
  type PlanTicket, type TicketType,
} from "@/services/api/endpoints/wallet.endpoint";

const KIND_OF: Record<TicketType, TicketKind> = {
  flight: "vuelo", train: "tren", ferry: "barco", concert: "entrada", match: "entrada", hotel: "reserva", other: "otro",
};

function toTicket(p: PlanTicket, dates: Map<string, string>): Ticket {
  const kind = KIND_OF[p.type];
  const realQr = p.barcode_value && p.barcode_value !== "detected" ? p.barcode_value : undefined;
  return {
    id: p.id,
    kind,
    startsAt: p.starts_at,
    status: p.status === "upcoming" ? "listo" : "usado",
    plan: p.plan_id != null && p.plan_titulo ? { id: String(p.plan_id), title: p.plan_titulo, dates: dates.get(String(p.plan_id)) } : undefined,
    code: p.booking_code ?? undefined,
    qr: realQr,
    hasSourceCode: !realQr && !!(p.qr_image_url || p.barcode_value),
    hasSource: !!(p.source_image_url || p.source_pdf_url),
    from: p.from_label ?? undefined,
    to: p.to_label ?? undefined,
    gate: p.gate_label ?? undefined,
    seat: p.seat_label ?? undefined,
    title: p.title,
    venue: p.place_label ?? undefined,
  };
}

const dm = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "Europe/Madrid" });
/** «21–25 nov», «28 nov – 2 dic» o «21 nov». */
function planDates(a: string, b: string) {
  const [da, db] = [new Date(a), new Date(b)];
  const [pa, pb] = [dm.formatToParts(da), dm.formatToParts(db)];
  const get = (p: Intl.DateTimeFormatPart[], t: string) => p.find((x) => x.type === t)?.value ?? "";
  const [A, B] = [`${get(pa, "day")} ${get(pa, "month").replace(".", "")}`, `${get(pb, "day")} ${get(pb, "month").replace(".", "")}`];
  if (A === B) return A;
  return get(pa, "month") === get(pb, "month") ? `${get(pa, "day")}–${B}` : `${A} – ${B}`;
}

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

export default function WalletPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const now = useMemo(() => new Date(), []);
  const [raw, setRaw] = useState<PlanTicket[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ok">("loading");
  const [tab, setTab] = useState<"proximos" | "usados">("proximos");
  const [picked, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [modalPlan, setModalPlan] = useState<{ open: boolean; planId: number | null }>({ open: false, planId: null });
  const [deleting, setDeleting] = useState<string | null>(null);
  const [source, setSource] = useState<{ id: string; url: string; isPdf: boolean } | null>(null);

  const [dates, setDates] = useState<Map<string, string>>(new Map());
  const [reload, setReload] = useState(0);
  const load = useCallback(async () => setReload((n) => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    listTicketsEndpoint()
      .then(async (r) => {
        if (cancelled) return;
        setRaw(r);
        setState("ok");
        const ids = [...new Set(r.map((t) => t.plan_id).filter((x): x is number => x != null))];
        const rows = await fetchPlansByIds({ planIds: ids }).catch(() => []);
        if (!cancelled) setDates(new Map(rows.map((p) => [String(p.id), planDates(p.inicio_at, p.fin_at)])));
      })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [reload]);

  const tickets = useMemo(() => raw.map((p) => toTicket(p, dates)), [raw, dates]);
  const upcoming = useMemo(() => tickets.filter((t) => t.status === "listo").sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [tickets]);
  const used = useMemo(() => tickets.filter((t) => t.status === "usado").sort((a, b) => b.startsAt.localeCompare(a.startsAt)), [tickets]);
  const list = tab === "proximos" ? upcoming : used;

  const groups = useMemo(() => {
    const m = new Map<string, { plan?: Ticket["plan"]; items: Ticket[] }>();
    for (const t of list) {
      const key = t.plan?.id ?? "_sin";
      if (!m.has(key)) m.set(key, { plan: t.plan, items: [] });
      m.get(key)!.items.push(t);
    }
    return [...m.values()];
  }, [list]);

  const plans = useMemo(() => {
    const m = new Map<string, { id: string; title: string }>();
    for (const t of tickets) if (t.plan) m.set(t.plan.id, t.plan);
    return [...m.values()];
  }, [tickets]);

  // escritorio: el primero seleccionado por defecto
  const selected = isDesktop && !list.some((t) => t.id === picked) ? (list[0]?.id ?? null) : picked;

  const sel = tickets.find((t) => t.id === selected);

  // imagen/PDF original del billete abierto (URL firmada)
  const selRaw = raw.find((p) => p.id === selected);
  const sourcePath = selRaw?.source_image_url ?? selRaw?.source_pdf_url ?? null;
  const sourceIsPdf = !!selRaw?.source_pdf_url && !selRaw?.source_image_url;
  useEffect(() => {
    if (!selected || !sourcePath) return;
    let cancelled = false;
    getTicketSourceSignedUrl(sourcePath)
      .then((url) => { if (!cancelled) setSource({ id: selected, url, isPdf: sourceIsPdf }); })
      .catch(() => { /* sin original: no pasa nada */ });
    return () => { cancelled = true; };
  }, [selected, sourcePath, sourceIsPdf]);
  const sourceUrl = source && source.id === selected ? source : null;

  const next = tab === "proximos" ? upcoming[0] : undefined;
  const meta = tickets.length === 0 ? "vacía"
    : `${tickets.length} ${tickets.length === 1 ? "billete" : "billetes"} · ${upcoming.length ? `${upcoming.length} ${upcoming.length === 1 ? "próximo" : "próximos"}` : "ninguno próximo"}`;

  function openAdd(_how: "upload" | "photo" | "manual", planId?: string) {
    setSheet(false);
    setModalPlan({ open: true, planId: planId ? Number(planId) : null });
  }
  /** Añade un PDF o una captura a un billete que ya existe. */
  function addSource(ticketId: string) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,application/pdf";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { data: { user } } = await createBrowserSupabaseClient().auth.getUser();
        if (!user) return;
        const path = await uploadTicketSourceEndpoint(file, user.id);
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        await updateTicketEndpoint(ticketId, isPdf ? { source_pdf_url: path } : { source_image_url: path });
        await load();
      } catch {
        setState("error");
      }
    };
    input.click();
  }
  const openPlan = (id: string) => router.push(`/plans/${id}`);

  async function confirmDelete() {
    const id = deleting;
    setDeleting(null);
    if (!id) return;
    try {
      await deleteTicketEndpoint(id);
      setSelected(null);
      await load();
    } catch {
      setState("error");
    }
  }

  const tabBtn = (id: "proximos" | "usados", label: string, n: number) => (
    <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
      className={`-mb-px inline-flex h-12 max-w-[200px] flex-1 items-center justify-center gap-1.5 border-b-2 text-sm font-semibold ${FOCUS} ${
        tab === id ? "border-[var(--text-primary)] text-[var(--text-primary)]" : "border-transparent text-[var(--text-secondary)]"}`}>
      {label}<span className={`font-normal tabular-nums ${T2}`}>{n}</span>
    </button>
  );

  const empty = state === "ok" && tickets.length === 0;

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--text-primary)]">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />
        <main className="px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+var(--space-2))] md:py-[var(--space-8)] md:pr-[var(--space-14)]">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 md:gap-5">
            <button type="button" onClick={() => router.back()} className={`-ml-1.5 inline-flex h-11 items-center gap-1 self-start rounded-lg pr-2 text-[17px] font-semibold md:text-base ${FOCUS}`}>
              <ChevronLeft size={22} aria-hidden />Perfil
            </button>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h1 className={`${SERIF} text-[32px] leading-[1.1] tracking-[-0.01em] md:text-[48px]`}>Cartera</h1>
                {state === "ok" && <p className={`text-sm tabular-nums ${T2}`}>{meta}</p>}
              </div>
              {state === "ok" && !empty && (
                <button type="button" onClick={() => setSheet(true)}
                  className={`hidden h-[46px] items-center gap-2 rounded-lg bg-[var(--primary)] px-5 font-semibold hover:bg-[var(--primary-hover)] md:inline-flex ${ON_PRIMARY} ${FOCUS}`}>
                  <Plus size={18} aria-hidden />Añadir billete
                </button>
              )}
            </div>

            {state === "loading" && <WalletSkeleton />}
            {state === "error" && <WalletError onRetry={() => { setState("loading"); void load(); }} />}

            {empty && (
              <div className="mx-auto flex max-w-[420px] flex-col items-center gap-3 pt-10 text-center md:pt-16">
                <svg aria-hidden width="120" height="75" viewBox="0 0 64 40" fill="none" stroke="var(--text-secondary)">
                  <path d="M4 2h56a2 2 0 0 1 2 2v11a5 5 0 0 0 0 10v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V25a5 5 0 0 0 0-10V4a2 2 0 0 1 2-2z" strokeWidth={1.2} strokeDasharray="3 3" />
                  <path d="M46 6v28" strokeDasharray="2 2.5" />
                </svg>
                <h2 className={`${SERIF} mt-2 text-[28px] leading-[1.15]`}>Tu cartera está vacía</h2>
                <p className={`text-base ${T2}`}>Sube el PDF de un billete o una captura y lo rellenamos por ti. Aquí lo tendrás a mano en la puerta.</p>
                <button type="button" onClick={() => setSheet(true)} className={`mt-3 inline-flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 font-semibold md:w-auto ${ON_PRIMARY} ${FOCUS}`}>
                  <Plus size={18} aria-hidden />Añadir billete
                </button>
              </div>
            )}

            {state === "ok" && !empty && (
              <>
                <div role="tablist" aria-label="Billetes" className="flex border-b border-[var(--border)]">
                  {tabBtn("proximos", "Próximos", upcoming.length)}
                  {tabBtn("usados", "Usados", used.length)}
                </div>

                <div className="flex flex-wrap items-start gap-8">
                  <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
                    {next && !isDesktop && (
                      <>
                        <p className={`text-xs font-semibold tracking-[0.02em] ${T2}`}>LO SIGUIENTE</p>
                        <button type="button" onClick={() => setSelected(next.id)} className={`self-start rounded-[10px] text-left ${FOCUS}`}>
                          <TicketBig t={next} width={358} now={now} onShowQr={() => setSelected(next.id)} />
                        </button>
                      </>
                    )}
                    {list.length === 0 && (
                      <p className={`py-6 text-base ${T2}`}>{tab === "proximos" ? "No tienes billetes próximos." : "Aún no has usado ningún billete."}</p>
                    )}
                    {groups.map((g) => (
                      <div key={g.plan?.id ?? "_sin"} className="mt-1.5 flex flex-col gap-2.5">
                        <div className="flex min-h-11 items-center gap-2">
                          <span className={`text-xs font-semibold tracking-[0.02em] ${T2}`}>{g.plan ? (g.plan.dates ? `${g.plan.title} · ${g.plan.dates}` : g.plan.title).toUpperCase() : "SIN PLAN"}</span>
                          <span className="flex-1" />
                          {g.plan && (
                            <button type="button" onClick={() => openPlan(g.plan!.id)} className={`inline-flex min-h-11 items-center gap-0.5 rounded-lg text-sm font-semibold text-[var(--primary)] ${FOCUS}`}>
                              Ver el plan<ChevronRight size={16} aria-hidden />
                            </button>
                          )}
                        </div>
                        {g.items.map((t) => (
                          <TicketRow key={t.id} t={t} now={now} selected={isDesktop && t.id === selected} onSelect={() => setSelected(t.id)} />
                        ))}
                      </div>
                    ))}
                    {tab === "usados" && used.length > 0 && (
                      <p className={`mt-2 text-[13px] ${T2}`}>Los billetes usados se guardan como recuerdo.</p>
                    )}
                  </div>

                  {isDesktop && sel && (
                    <TicketDetail t={sel} now={now} isDesktop sourceUrl={sourceUrl} onOpenPlan={openPlan} onDelete={() => setDeleting(sel.id)} onAddQr={() => addSource(sel.id)} />
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {!isDesktop && state === "ok" && !empty && (
        <button type="button" aria-label="Añadir billete" onClick={() => setSheet(true)}
          className={`fixed bottom-[max(24px,env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-content-center rounded-full bg-[var(--primary)] shadow-[0_4px_12px_rgba(0,0,0,0.3),0_2px_4px_rgba(0,0,0,0.2)] ${ON_PRIMARY} ${FOCUS}`}>
          <Plus size={26} aria-hidden />
        </button>
      )}
      {!isDesktop && sel && (
        <TicketDetail t={sel} now={now} isDesktop={false} sourceUrl={sourceUrl} onBack={() => setSelected(null)} onOpenPlan={openPlan} onDelete={() => setDeleting(sel.id)} onAddQr={() => addSource(sel.id)} />
      )}
      {sheet && <AddTicketSheet plans={plans} defaultPlanId={upcoming[0]?.plan?.id} onPick={openAdd} onClose={() => setSheet(false)} />}
      {modalPlan.open && (
        <AddTicketModal
          planId={modalPlan.planId}
          onClose={() => setModalPlan({ open: false, planId: null })}
          onCreated={() => { setModalPlan({ open: false, planId: null }); void load(); }}
        />
      )}
      {deleting && <ConfirmDelete onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />}
    </div>
  );
}
