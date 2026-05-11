"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { parseDate, today, getLocalTimeZone, type CalendarDate } from "@internationalized/date";
import { CalendarRac } from "@/components/ui/calendar-rac";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateValue } from "react-aria-components";

const MAX_DATE = today(getLocalTimeZone());

function formatDate(iso: string): string {
  if (!iso) return "Sin especificar";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(y, m - 1, d),
    );
  } catch {
    return "Sin especificar";
  }
}

function isoToCalendarDate(iso: string): CalendarDate | null {
  if (!iso) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

export function BirthDatePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const calendarValue = isoToCalendarDate(value);

  function handleChange(date: DateValue | null) {
    if (!date) return;
    onChange(date.toString());
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex items-center gap-2 rounded-input border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm transition-colors hover:bg-surface-2 disabled:opacity-[var(--disabled-opacity)]"
        >
          <CalendarIcon className="size-4 shrink-0 text-muted" />
          <span className={value ? "text-app" : "text-muted"}>
            {formatDate(value)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="p-2">
        <CalendarRac
          value={calendarValue}
          onChange={handleChange}
          maxValue={MAX_DATE}
        />
      </PopoverContent>
    </Popover>
  );
}
