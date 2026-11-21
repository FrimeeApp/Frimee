"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Archive, Bed, ChevronRight, Route, Search, Undo2, X } from "lucide-react";
import { Sheet } from "@/components/chat/bitacora/Sheet";
import { dayLabel, type MoverDay, type MoverOption } from "@/lib/album-grouping";

export type MoverChoice =
  | { kind: "auto" }
  | { kind: "sin_clasificar" }
  | { kind: "destino"; option: MoverOption };

type Item = { key: string; choice: MoverChoice };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Marker({ option }: { option: MoverOption }) {
  if (option.kind === "viaje") {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-app text-muted" aria-hidden>
        <Route className="size-3.5" />
      </span>
    );
  }
  if (option.kind === "sigue" || option.ordinal === null) {
    return (
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-[#00c9a7] text-[#111]" aria-hidden>
        <Bed className="size-[15px]" />
      </span>
    );
  }
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#00c9a7] text-[13px] font-[700] tabular-nums text-[#111]" aria-hidden>
      {option.ordinal}
    </span>
  );
}

/**
 * Where to send the selected photos: «Colocar por su hora» first, then every day with its activities,
 * legs and stays (empty ones too), and «Sin clasificar» fixed at the bottom. On desktop it is a popover
 * you drive with ↑ ↓, Intro and Esc.
 */
export default function AlbumMover({
  count,
  days,
  desktop,
  onPick,
  onClose,
}: {
  count: number;
  days: MoverDay[];
  desktop: boolean;
  onPick: (choice: MoverChoice) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = norm(query.trim());

  const shownDays = useMemo(
    () =>
      days
        .map((d) => ({
          ...d,
          options: d.options.filter((o) => !q || norm(o.busqueda).includes(q) || norm(dayLabel(d.key)).includes(q) || norm(`dia ${d.numero}`).includes(q)),
        }))
        .filter((d) => d.options.length > 0),
    [days, q],
  );

  // Everything the keyboard can reach, in order.
  const items: Item[] = useMemo(() => {
    const out: Item[] = [];
    if (!q) out.push({ key: "auto", choice: { kind: "auto" } });
    for (const d of shownDays) for (const o of d.options) out.push({ key: o.id, choice: { kind: "destino", option: o } });
    out.push({ key: "sin", choice: { kind: "sin_clasificar" } });
    return out;
  }, [shownDays, q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(items[active]?.key ?? "")}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, items]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) onPick(it.choice);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  const row = (it: Item, children: React.ReactNode) => (
    <button
      key={it.key}
      type="button"
      data-item={it.key}
      onClick={() => onPick(it.choice)}
      onMouseMove={() => setActive(items.findIndex((x) => x.key === it.key))}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-lg px-2 py-1 text-left ${items[active]?.key === it.key ? "bg-[var(--primary)]/15" : ""}`}
    >
      {children}
    </button>
  );

  const body = (
    <div onKeyDown={onKeyDown} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-[46px] items-center gap-2.5 rounded-lg border border-app bg-[var(--surface-2)] pr-1 pl-3 text-muted focus-within:border-[var(--primary)]">
        <Search className="size-[18px] shrink-0" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          placeholder="Buscar actividad o día"
          aria-label="Buscar actividad o día"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-app outline-none placeholder:text-muted"
        />
        {query && (
          <button type="button" aria-label="Borrar la búsqueda" onClick={() => setQuery("")} className="flex size-11 items-center justify-center">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {!desktop && !q && days.length > 1 && (
        <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {days.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => listRef.current?.querySelector(`[data-day="${d.key}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" })}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-app px-3.5 text-[13px] font-[600] text-muted"
            >
              Día {d.numero}
            </button>
          ))}
        </div>
      )}

      <div ref={listRef} role="listbox" aria-label="Destinos" className="mt-2 min-h-0 flex-1 overflow-y-auto">
        {!q &&
          row(
            items[0],
            <>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-app text-app" aria-hidden>
                <Undo2 className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-[600] text-app">Colocar por su hora</span>
                <span className="block text-[12px] text-muted">cada una a su sitio</span>
              </span>
            </>,
          )}

        {shownDays.map((d) => (
          <div key={d.key} data-day={d.key}>
            <p className="mt-3 mb-1 px-2 text-[13px] font-[600] tracking-[.02em] text-muted">
              Día {d.numero} · {dayLabel(d.key).toLowerCase()}
            </p>
            {d.options.map((o) =>
              row(
                { key: o.id, choice: { kind: "destino", option: o } },
                <>
                  <Marker option={o} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-app ${o.kind === "viaje" ? "text-[14px]" : "text-[15px] font-[600]"}`}>
                      {o.kind === "viaje" ? (
                        <>
                          <span className="font-[600]">Viaje</span> <span className="text-muted">· {o.titulo}</span>
                        </>
                      ) : (
                        o.titulo
                      )}
                    </span>
                    {o.detalle && <span className="block text-[12px] text-muted tabular-nums">{o.detalle}</span>}
                  </span>
                  {o.count > 0 && <span className="shrink-0 text-[12px] text-muted tabular-nums">Hay {o.count}</span>}
                </>,
              ),
            )}
          </div>
        ))}

        {q && shownDays.length === 0 && <p className="px-2 py-6 text-center text-[14px] text-muted">Nada con «{query.trim()}»</p>}
      </div>

      <div className="mt-1 border-t border-app pt-1">
        {row(
          items[items.length - 1],
          <>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-app text-app" aria-hidden>
              <Archive className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-[600] text-app">Sin clasificar</span>
              <span className="block text-[12px] text-muted">al final del álbum</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
          </>,
        )}
        {desktop && <p className="px-2 pt-1 pb-1 text-[12px] text-muted">↑ ↓ para elegir · Intro para mover · Esc para cerrar</p>}
      </div>
    </div>
  );

  const title = count === 1 ? "Mover 1 foto a…" : `Mover ${count} fotos a…`;

  if (!desktop) {
    return (
      <Sheet title={title} onClose={onClose} zIndex={1400}>
        <div className="flex h-[min(70dvh,560px)] flex-col">{body}</div>
      </Sheet>
    );
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1390]" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={title}
        className="fixed bottom-24 left-1/2 z-[1400] flex h-[min(70dvh,560px)] w-[380px] -translate-x-1/2 flex-col rounded-xl border border-app bg-[var(--bg)] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      >
        <p className="mb-2 px-1 text-[15px] font-[600] text-app">{title}</p>
        {body}
      </div>
    </>,
    document.body,
  );
}
