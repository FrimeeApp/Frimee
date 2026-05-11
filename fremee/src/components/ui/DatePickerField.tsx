"use client";

import { useState } from "react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import { CalendarRac } from "@/components/ui/calendar-rac";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateValue } from "react-aria-components";

function formatDate(iso: string): string {
  if (!iso) return "Seleccionar fecha";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(y, m - 1, d),
    );
  } catch {
    return "Seleccionar fecha";
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

export function DatePickerField({
  value,
  onChange,
  disabled = false,
  maxValue,
}: {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  maxValue?: CalendarDate;
}) {
  const [open, setOpen] = useState(false);

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
          className="w-full bg-transparent text-left text-body text-app outline-none disabled:opacity-[var(--disabled-opacity)]"
        >
          {formatDate(value)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-2">
        <CalendarRac
          value={isoToCalendarDate(value)}
          onChange={handleChange}
          maxValue={maxValue}
        />
      </PopoverContent>
    </Popover>
  );
}
