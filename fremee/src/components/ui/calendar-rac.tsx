"use client";

import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import {
  Button,
  Calendar as AriaCalendar,
  CalendarCell as CalendarCellRac,
  CalendarGrid as CalendarGridRac,
  CalendarGridBody as CalendarGridBodyRac,
  CalendarGridHeader as CalendarGridHeaderRac,
  CalendarHeaderCell as CalendarHeaderCellRac,
  Heading as HeadingRac,
  composeRenderProps,
  type DateValue,
} from "react-aria-components";

type CalendarProps = ComponentProps<typeof AriaCalendar> & { className?: string };

const NOW = today(getLocalTimeZone());
const CURRENT_YEAR = NOW.year;
const MIN_YEAR = 1920;

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function YearPicker({ selectedYear, onSelect }: { selectedYear: number; onSelect: (year: number) => void }) {
  const years = Array.from({ length: CURRENT_YEAR - MIN_YEAR + 1 }, (_, i) => CURRENT_YEAR - i);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
  }, []);

  return (
    <div className="h-[252px] overflow-y-auto scrollbar-hide">
      <div className="grid grid-cols-3 gap-1">
        {years.map((year) => (
          <button
            key={year}
            ref={year === selectedYear ? selectedRef : undefined}
            type="button"
            onClick={() => onSelect(year)}
            className={[
              "rounded-lg px-2 py-[7px] text-sm transition-colors",
              year === selectedYear
                ? "bg-[var(--primary)] text-white font-medium"
                : "text-app hover:bg-surface-2",
            ].join(" ")}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}

function CalendarDayGrid() {
  return (
    <CalendarGridRac>
      <CalendarGridHeaderRac>
        {(day) => (
          <CalendarHeaderCellRac className="size-9 rounded-lg p-0 text-xs font-medium text-muted">
            {day}
          </CalendarHeaderCellRac>
        )}
      </CalendarGridHeaderRac>
      <CalendarGridBodyRac className="[&_td]:px-0">
        {(date) => (
          <CalendarCellRac
            date={date}
            className={[
              "relative flex size-9 items-center justify-center whitespace-nowrap rounded-lg border border-transparent p-0 text-sm font-normal text-app duration-150 [transition-property:color,background-color,border-radius,box-shadow] focus:outline-none",
              "data-[disabled]:pointer-events-none data-[unavailable]:pointer-events-none",
              "data-[hovered]:bg-surface-2",
              "data-[selected]:bg-[var(--primary)] data-[selected]:text-white",
              "data-[unavailable]:line-through data-[disabled]:opacity-30 data-[unavailable]:opacity-30",
              date.compare(NOW) === 0
                ? "after:pointer-events-none after:absolute after:bottom-1 after:start-1/2 after:z-10 after:size-[3px] after:-translate-x-1/2 after:rounded-full after:bg-[var(--primary)] data-[selected]:after:bg-white"
                : "",
            ].join(" ")}
          />
        )}
      </CalendarGridBodyRac>
    </CalendarGridRac>
  );
}

export function CalendarRac({ className = "", ...props }: CalendarProps) {
  const [focused, setFocused] = useState<DateValue>(
    (props.value as CalendarDate | null) ?? NOW,
  );
  const [viewMode, setViewMode] = useState<"days" | "years">("days");

  function handleYearSelect(year: number) {
    setFocused(new CalendarDate(year, focused.month, 1));
    setViewMode("days");
  }

  return (
    <AriaCalendar
      {...props}
      focusedValue={focused}
      onFocusChange={setFocused}
      className={composeRenderProps(className, (cls) => `w-fit ${cls}`)}
    >
      {/* Hidden for a11y */}
      <HeadingRac className="sr-only" />

      {/* Header */}
      <header className="flex w-full items-center gap-1 pb-1">
        {viewMode === "days" ? (
          <>
            <Button
              slot="previous"
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-app focus:outline-none"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </Button>
            <button
              type="button"
              onClick={() => setViewMode("years")}
              className="grow text-center text-sm font-medium text-app transition-colors hover:text-[var(--primary)]"
            >
              {MONTHS_ES[(focused.month ?? 1) - 1]} {focused.year}
            </button>
            <Button
              slot="next"
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-app focus:outline-none"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </Button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setViewMode("days")}
              className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-app focus:outline-none"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <span className="grow text-center text-sm font-medium text-app">
              Selecciona año
            </span>
            <div className="size-9" />
          </>
        )}
      </header>

      {/* Content */}
      {viewMode === "days" ? (
        <CalendarDayGrid />
      ) : (
        <YearPicker selectedYear={focused.year} onSelect={handleYearSelect} />
      )}
    </AriaCalendar>
  );
}
