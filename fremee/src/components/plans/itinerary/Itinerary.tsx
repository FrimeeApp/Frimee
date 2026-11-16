"use client";

import { useState, type ReactNode } from "react";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { formatMoney } from "@/lib/formatters";
import { DayTimeline } from "./DayTimeline";
import {
  dayCountText, dayLabel, dayRangeLabel, foldText, pastText,
  type Entry, type ItineraryDay, type ItineraryModel,
} from "./itineraryModel";
import {
  BandRow, DayAddButton, DayHeader, DonePill, FinishedDayRow, FoldRow, LongEmptyState, TodayPill, TripSummary, useNow,
} from "./parts";

type Props = {
  model: ItineraryModel;
  finished: boolean;
  canEdit: boolean;
  openDays: Set<string>;
  onToggleDay: (key: string) => void;
  onOpenDays: (keys: string[]) => void;
  dayExpenses: Map<string, { total: number; currency: string }>;
  expenseTotal: { total: number; currency: string; count: number };
  editingTransporteId: number | null;
  onEditTransporte: (subplanId: number | null) => void;
  onTransporteChange: (subplanId: number, transporte: string | null) => void;
  onEdit: (row: SubplanRow) => void;
  onAdd: (dateKey?: string) => void;
  onOpenAlbum: () => void;
};

export const itineraryDayId = (key: string) => `itinerario-dia-${key}`;

/** The plan's itinerary (it-* boards): days, folded runs, the trip in progress and the finished trip. */
export function Itinerary(props: Props) {
  const { model, finished, canEdit, openDays, onToggleDay, onOpenDays, dayExpenses, onEdit, onAdd } = props;
  const now = useNow(model.during);
  // Folded runs the user unfolded («3 días libres», «Hechos»).
  const [unfolded, setUnfolded] = useState<Set<string>>(() => new Set());
  const editable = !finished && canEdit;

  const timeline = (day: ItineraryDay, readOnly: boolean) => (
    <DayTimeline
      items={day.starts}
      spans={model.spans}
      readOnly={readOnly}
      canEdit={canEdit}
      // «Hecho» on each activity only today; a finished day says it once, on its header (ticks stay).
      live={day.today}
      pastDay={day.past}
      showNowLine={day.today}
      now={now}
      addLabel={`Añadir actividad en ${dayLabel(day.key)}`}
      editingTransporteId={props.editingTransporteId}
      onEditTransporte={props.onEditTransporte}
      onTransporteChange={props.onTransporteChange}
      onEdit={onEdit}
      onAdd={() => onAdd(day.key)}
    />
  );

  const bands = (day: ItineraryDay, readOnly: boolean) =>
    day.bands.length > 0 && (
      <div className="mb-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
        {day.bands.map((b) => (
          <BandRow key={b.span.row.id} band={b} onOpen={!readOnly && canEdit ? () => onEdit(b.span.row) : undefined} />
        ))}
      </div>
    );

  if (finished) {
    const shown = model.keys.map((k) => model.days.get(k)!).filter((d) => d.starts.length > 0 || d.bands.length > 0);
    const activities = model.keys.reduce((n, k) => n + model.days.get(k)!.starts.length, 0);
    const stats = [
      { value: String(model.keys.length), label: model.keys.length === 1 ? "día" : "días" },
      { value: String(activities), label: activities === 1 ? "actividad" : "actividades" },
      ...(props.expenseTotal.count > 0
        ? [{ value: formatMoney(props.expenseTotal.total, props.expenseTotal.currency), label: "en gastos" }]
        : []),
    ];
    return (
      <div>
        <TripSummary stats={stats} />
        {shown.length === 0 && <p className="py-[var(--space-8)] text-center text-body-sm text-muted">Este plan no tuvo actividades.</p>}
        <div className="flex flex-col">
          {shown.map((day) => {
            const open = openDays.has(day.key);
            return (
              <div key={day.key} id={itineraryDayId(day.key)} className="border-b border-app last:border-b-0">
                <FinishedDayRow
                  number={day.number}
                  title={dayLabel(day.key)}
                  detail={`Día ${day.number} · ${dayCountText(day)}`}
                  expanded={open}
                  onToggle={() => onToggleDay(day.key)}
                />
                {open && (
                  <div className="pb-[var(--space-4)] pt-[var(--space-2)]">
                    {bands(day, true)}
                    {timeline(day, true)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={props.onOpenAlbum}
          className="mt-[var(--space-6)] flex min-h-[44px] w-full items-center justify-center rounded-[var(--radius-button)] border border-app bg-surface px-[var(--space-4)] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface-2"
        >
          Volver a ver el viaje
        </button>
      </div>
    );
  }

  if (model.emptyLong) {
    const first = model.keys[0];
    const last = model.keys[model.keys.length - 1];
    return (
      <LongEmptyState
        days={model.keys.length}
        range={dayRangeLabel(first, last).toLocaleLowerCase("es-ES")}
        onAdd={editable ? () => onAdd() : undefined}
      />
    );
  }

  const renderDay = (day: ItineraryDay): ReactNode => {
    const empty = day.starts.length === 0 && day.bands.length === 0;
    const open = openDays.has(day.key);
    const expense = dayExpenses.get(day.key);
    const detail = [`Día ${day.number}`, dayCountText(day), ...(expense ? [formatMoney(expense.total, expense.currency)] : [])].join(" · ");
    const title = dayLabel(day.key);
    return (
      <div key={day.key} id={itineraryDayId(day.key)} className={`${open && !empty ? "mb-[var(--space-6)]" : "mb-[var(--space-4)]"} last:mb-0`}>
        <div className={`-mx-[var(--page-margin-x)] border-b border-app px-[var(--page-margin-x)] md:mx-0 md:px-0 ${open && !empty ? "mb-[var(--space-5)] pb-[var(--space-4)]" : "pb-[var(--space-4)]"}`}>
          <DayHeader
            title={title}
            detail={detail}
            expanded={empty ? null : open}
            onToggle={() => onToggleDay(day.key)}
            pill={day.today ? <TodayPill /> : day.past ? <DonePill label="Hecho" /> : undefined}
            action={empty && editable && !day.past ? <DayAddButton onClick={() => onAdd(day.key)} label={`Añadir actividad en ${title}`} /> : undefined}
          />
        </div>
        {!empty && (
          <div
            className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
              open ? "mt-[var(--space-1)] grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
            }`}
            inert={!open}
          >
            <div className="overflow-hidden">
              {bands(day, false)}
              {timeline(day, false)}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEntry = (entry: Entry): ReactNode => {
    if (entry.kind === "day") return renderDay(entry.day);
    if (unfolded.has(entry.id)) return entry.days.map(renderDay);
    const unfold = () => {
      setUnfolded((prev) => new Set(prev).add(entry.id));
      // Quiet days only hold their bands: open them right away.
      if (entry.kind === "fold") onOpenDays(entry.days.map((d) => d.key));
    };
    const wrap = (node: ReactNode) => (
      <div key={entry.id} className="-mx-[var(--page-margin-x)] mb-[var(--space-4)] border-b border-app px-[var(--page-margin-x)] pb-[var(--space-2)] last:mb-0 md:mx-0 md:px-0">
        {node}
      </div>
    );
    if (entry.kind === "past") {
      const { title, detail } = pastText(entry);
      return wrap(<FoldRow title={title} detail={detail} pill={<DonePill label="Hechos" />} onExpand={unfold} />);
    }
    const { title, detail } = foldText(entry);
    return wrap(
      <FoldRow
        title={title}
        detail={detail}
        onExpand={unfold}
        onAdd={editable ? () => onAdd(entry.days[0].key) : undefined}
        addLabel={`Añadir actividad en ${dayLabel(entry.days[0].key)}`}
      />,
    );
  };

  return <>{model.entries.map(renderEntry)}</>;
}
