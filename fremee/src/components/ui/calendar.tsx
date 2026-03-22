"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { es } from "react-day-picker/locale";

function Calendar({ className = "", classNames, ...props }: DayPickerProps) {
  return (
    <DayPicker
      locale={es}
      className={`rdp-calendar ${className}`}
      classNames={{
        months: "rdp-months",
        month: "rdp-month",
        month_caption: "rdp-month-caption",
        caption_label: "rdp-month-caption-label",
        nav: "rdp-nav",
        button_previous: "rdp-nav-btn rdp-nav-prev",
        button_next: "rdp-nav-btn rdp-nav-next",
        weekdays: "rdp-weekdays",
        weekday: "rdp-weekday",
        week: "rdp-week",
        day: "rdp-day",
        day_button: "rdp-day-btn",
        selected: "rdp-selected",
        today: "rdp-today",
        outside: "rdp-outside",
        disabled: "rdp-disabled",
        range_start: "rdp-range-start",
        range_end: "rdp-range-end",
        range_middle: "rdp-range-middle",
        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
