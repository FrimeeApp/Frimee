"use client";

import { useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { startOfDay } from "../home/homeSections";
import { FOCUS, GHOST_BTN, SERIF, TEXT_BTN } from "../home/pieces";
import type { OpenPlan } from "../home/blocks";
import { periodLabel, shiftPeriod, type CalMode } from "./calendarModel";
import { resetPlanActivities, useIsDesktop } from "./hooks";
import { ModeSwitch } from "./parts";
import { DayView, MonthView, WeekView, YearView, type ViewProps } from "./views";

const STEP_LABEL: Record<CalMode, [string, string]> = {
  ano: ["Año anterior", "Año siguiente"],
  mes: ["Mes anterior", "Mes siguiente"],
  semana: ["Semana anterior", "Semana siguiente"],
  dia: ["Día anterior", "Día siguiente"],
};

const ICON_BTN = `flex size-11 shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-surface-2 ${FOCUS}`;

/**
 * Calendar of «Mis planes» (boards m-cal-* / d-cal-*): Año, Mes, Semana and Día.
 * Mode and date live in the URL, so going back and reloading keep the view.
 */
export function CalendarView({
  plans,
  mode,
  date,
  onChange,
  onBack,
  onOpen,
  onCreate,
}: {
  plans: FeedPlanItemDto[];
  mode: CalMode;
  date: Date;
  onChange: (mode: CalMode, date: Date) => void;
  onBack: () => void;
  onOpen: OpenPlan;
  onCreate: (from: Date, to: Date) => void;
}) {
  // Activities may have changed in a plan since the calendar was last open.
  useState(() => {
    resetPlanActivities();
    return null;
  });
  const desktop = useIsDesktop();
  const label = periodLabel(mode, date, desktop);
  const [prevLabel, nextLabel] = STEP_LABEL[mode];
  const goToday = () => onChange(mode, startOfDay(new Date()));
  const step = (dir: 1 | -1) => onChange(mode, shiftPeriod(mode, date, dir));

  const props: ViewProps = { plans, date, desktop, onOpen, go: onChange, onCreate };
  const view =
    mode === "ano" ? <YearView {...props} /> : mode === "mes" ? <MonthView {...props} /> : mode === "semana" ? <WeekView {...props} /> : <DayView {...props} />;

  const prev = (
    <button type="button" aria-label={prevLabel} title={prevLabel} onClick={() => step(-1)} className={ICON_BTN}>
      <ChevronLeft size={22} aria-hidden />
    </button>
  );
  const next = (
    <button type="button" aria-label={nextLabel} title={nextLabel} onClick={() => step(1)} className={ICON_BTN}>
      <ChevronRight size={22} aria-hidden />
    </button>
  );
  const back = (
    <button type="button" aria-label="Volver a Mis planes" title="Volver a Mis planes" onClick={onBack} className={ICON_BTN}>
      <ArrowLeft size={22} aria-hidden />
    </button>
  );

  if (desktop) {
    return (
      <div className="pb-10">
        <header className="flex h-12 items-center gap-4">
          {back}
          <h1 className={`${SERIF} text-[40px] leading-[44px] text-app`}>Calendario</h1>
          <span className="flex-1" />
          <ModeSwitch mode={mode} onChange={(m) => onChange(m, date)} desktop />
        </header>
        <div className="mt-2 flex h-11 items-center gap-1">
          {prev}
          {next}
          <h2 aria-live="polite" className={`${SERIF} ml-2 flex-1 text-[26px] leading-8 text-app`}>
            {label}
          </h2>
          <button type="button" onClick={goToday} className={`${GHOST_BTN} ${FOCUS}`}>
            Hoy
          </button>
        </div>
        <div className="mt-3">{view}</div>
      </div>
    );
  }

  return (
    <div>
      <header className="flex h-14 items-center gap-1 px-2">
        {back}
        <h1 className={`${SERIF} flex-1 text-[32px] leading-10 text-app`}>Calendario</h1>
        <button type="button" onClick={goToday} className={`${TEXT_BTN} px-3 ${FOCUS}`}>
          Hoy
        </button>
      </header>
      <div className="px-4">
        <ModeSwitch mode={mode} onChange={(m) => onChange(m, date)} desktop={false} />
      </div>
      <div className="flex h-[52px] items-center gap-1 px-2 pt-2">
        {prev}
        <h2 aria-live="polite" className={`${SERIF} flex-1 text-center text-[24px] leading-7 text-app`}>
          {label}
        </h2>
        {next}
      </div>
      {view}
    </div>
  );
}
