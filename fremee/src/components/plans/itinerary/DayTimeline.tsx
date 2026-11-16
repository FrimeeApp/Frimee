"use client";

import { Fragment } from "react";
import Image from "next/image";
import { Check, MapPin, Pencil, Plus } from "lucide-react";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import { buildGoogleMapsDirectionsUrl, buildWazeDirectionsUrl } from "@/config/external";
import { formatCompactRouteDistance, formatCompactRouteDuration } from "@/lib/route-formatters";
import { ACTIVITY_TYPE_OPTIONS, TRANSPORT_LLEGADA, TRANSPORT_MAP } from "@/app/(app)/plans/[id]/_components/AddSubplanSheet";
import { activityDone, hhmm, spanPill, spanRangeText, startsInMinutes, type Span } from "./itineraryModel";
import { NowLine } from "./parts";

type Props = {
  items: SubplanRow[];
  spans: Map<number, Span>;
  /** Plan finished: read only. */
  readOnly: boolean;
  canEdit: boolean;
  /** Today, during the trip: «Hecho» on finished activities and «Empieza en…». */
  live: boolean;
  /** A day already lived during the trip: ticked nodes, without the «Hecho» pill. */
  pastDay: boolean;
  showNowLine: boolean;
  now: Date;
  addLabel: string;
  editingTransporteId: number | null;
  onEditTransporte: (subplanId: number | null) => void;
  onTransporteChange: (subplanId: number, transporte: string | null) => void;
  onEdit: (row: SubplanRow) => void;
  onAdd: () => void;
};

const TIME_COL = "w-[54px] sm:w-[82px] shrink-0 pr-[var(--space-2)]";

function TypeIcon({ tipo, className }: { tipo: string; className?: string }) {
  const opt = ACTIVITY_TYPE_OPTIONS.find((o) => o.value === tipo) ?? ACTIVITY_TYPE_OPTIONS[0];
  return <opt.Icon className={className} aria-hidden />;
}

/** One day's activities on the hour line, with the travel legs between them. */
export function DayTimeline({
  items, spans, readOnly, canEdit, live, pastDay, showNowLine, now, addLabel,
  editingTransporteId, onEditTransporte, onTransporteChange, onEdit, onAdd,
}: Props) {
  // Days already lived keep the pencil but not «Añadir actividad».
  const showAdd = !readOnly && canEdit && !pastDay;
  // The «Ahora» line goes before the first activity still to start.
  const nowIndex = showNowLine
    ? (() => {
        const i = items.findIndex((s) => new Date(s.inicio_at).getTime() > now.getTime());
        return i === -1 ? items.length : i;
      })()
    : -1;
  // Only the next activity says how long until it starts.
  const soonId = live ? items.find((s) => startsInMinutes(s, now) !== null)?.id : undefined;

  return (
    <div className="relative pl-0">
      {items.map((s, idx) => {
        const isLast = idx === items.length - 1;
        const nextItem = !isLast ? items[idx + 1] : null;
        const nextTransporte = nextItem ? TRANSPORT_MAP[nextItem.transporte_llegada ?? ""] : null;
        const routeOrigin = s.ubicacion_fin_nombre ?? s.ubicacion_nombre ?? "";
        const routeDestination = nextItem?.ubicacion_nombre ?? "";
        const connectorMapsUrl = nextTransporte && routeDestination
          ? buildGoogleMapsDirectionsUrl({ origin: routeOrigin, destination: routeDestination, travelMode: nextTransporte.googleMode ?? "driving" })
          : "";
        const connectorWazeUrl = routeDestination ? buildWazeDirectionsUrl(routeDestination) : "";
        const hasTravelMeta = !!(nextItem?.duracion_viaje || nextItem?.distancia_viaje);
        const span = spans.get(s.id);
        const done = (live || pastDay) && activityDone(s, now);
        const soon = s.id === soonId ? startsInMinutes(s, now) : null;

        return (
          <Fragment key={s.id}>
            {idx === nowIndex && <NowLine now={now} />}
            <div>
              <div className="relative flex gap-0 pb-[var(--space-2)]">
                <div className={`${TIME_COL} pt-[2px] text-right`}>
                  {s.all_day ? (
                    <span className="block text-[14px] font-[var(--fw-medium)] leading-[1.1] tracking-[0.01em] text-muted">Todo el día</span>
                  ) : span ? (
                    <span className="block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em] text-muted">{hhmm(s.inicio_at)}</span>
                  ) : (
                    <div className="ml-auto flex w-fit flex-col items-start text-left leading-[1.05] text-muted">
                      <span className="block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em]">{hhmm(s.inicio_at)} -</span>
                      <span className="mt-[2px] block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em]">{hhmm(s.fin_at)}</span>
                    </div>
                  )}
                </div>

                <div className="relative flex w-[28px] shrink-0 justify-center">
                  {(idx > 0 || idx === nowIndex) && (
                    <div className="absolute left-1/2 top-0 h-[14px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                  )}
                  {(!isLast || showAdd || nowIndex === items.length) && (
                    <div className="absolute left-1/2 top-[14px] bottom-[-8px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                  )}
                  {done ? (
                    <div className={`relative z-10 mt-[2px] flex h-[24px] w-[24px] items-center justify-center border-[2px] border-primary-token bg-primary-token text-[var(--contrast)] ${span ? "rounded-[6px]" : "rounded-full"}`}>
                      <Check className="size-[13px]" strokeWidth={3} aria-hidden />
                    </div>
                  ) : span ? (
                    <div className="relative z-10 mt-[2px] flex h-[24px] w-[24px] items-center justify-center rounded-[6px] border border-[var(--chat-me-border)] bg-[var(--chat-me)] text-primary-token">
                      <TypeIcon tipo={s.tipo} className="size-[14px]" />
                    </div>
                  ) : (
                    <div className="relative z-10 mt-[2px] flex h-[24px] w-[24px] items-center justify-center rounded-full border-[2px] border-primary-token bg-app">
                      <div className="h-[8px] w-[8px] rounded-full bg-primary-token" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 pl-[var(--space-3)]">
                  <div className="flex flex-wrap items-start gap-[6px]">
                    <h4
                      className={`min-w-0 shrink text-body ${done ? "font-[var(--fw-medium)] text-[var(--text-secondary)]" : "font-[var(--fw-semibold)]"}`}
                      style={{ fontFamily: "var(--font-inter), sans-serif" }}
                    >
                      {s.titulo}
                    </h4>
                    {span && (
                      <span className="inline-flex h-[22px] shrink-0 items-center rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] px-[8px] text-[12px] font-[var(--fw-semibold)] text-app">
                        {spanPill(span)}
                      </span>
                    )}
                    {done && live && (
                      <span className="inline-flex h-[22px] shrink-0 items-center gap-[4px] rounded-full bg-surface-2 px-[8px] text-[12px] font-[var(--fw-semibold)] text-[var(--text-secondary)]">
                        <Check className="size-[12px]" strokeWidth={2.6} aria-hidden />
                        Hecho
                      </span>
                    )}
                    {!readOnly && canEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(s)}
                        className="mt-[1px] inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center text-muted transition-colors hover:text-primary-token"
                        aria-label={`Editar ${s.titulo}`}
                      >
                        <Pencil className="size-[14px]" aria-hidden />
                      </button>
                    )}
                  </div>
                  {span && (
                    <p className="mt-[2px] text-body-sm text-muted">
                      {spanRangeText(span)}
                    </p>
                  )}
                  {soon !== null && (
                    <p className="mt-[2px] text-body-sm font-[var(--fw-semibold)] text-primary-token">Empieza en {soon} min</p>
                  )}
                  {s.descripcion && <p className="mt-[2px] line-clamp-2 text-body-sm text-muted">{s.descripcion}</p>}
                  {s.ubicacion_nombre && !s.ubicacion_fin_nombre && (
                    <p className="mt-[4px] flex items-center gap-[4px] text-body-sm text-muted">
                      <MapPin className="size-[13px] shrink-0" aria-hidden />
                      {s.ubicacion_nombre}
                    </p>
                  )}
                  {s.ubicacion_nombre && s.ubicacion_fin_nombre && (
                    <div className="mt-[4px] flex flex-col gap-[2px] text-body-sm text-muted">
                      <p className="flex items-center gap-[4px]">
                        <MapPin className="size-[13px] shrink-0" aria-hidden />
                        {s.ubicacion_nombre}
                      </p>
                      <div className="pl-[18px] text-[14px] leading-none text-primary-token">↓</div>
                      <p className="flex items-center gap-[4px]">
                        <MapPin className="size-[13px] shrink-0" aria-hidden />
                        {s.ubicacion_fin_nombre}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Transport connector between activities */}
              {nextItem && (
                <div className="relative flex gap-0 pb-[var(--space-4)]">
                  <div className={TIME_COL} />
                  <div className="relative flex w-[28px] shrink-0 items-center justify-center">
                    <div className="absolute left-1/2 top-0 bottom-[-16px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                    {nextTransporte ? (
                      <div className="relative z-10 flex h-[24px] w-[24px] items-center justify-center rounded-full border border-app bg-app text-muted">
                        <nextTransporte.Icon className="size-[14px]" />
                      </div>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 self-center pl-[var(--space-3)]">
                    {!readOnly && editingTransporteId === nextItem.id ? (
                      <div className="flex flex-wrap gap-[var(--space-2)]">
                        {TRANSPORT_LLEGADA.map((t) => (
                          <button
                            key={t.value}
                            onClick={() => onTransporteChange(nextItem.id, t.value)}
                            className={`flex items-center gap-[6px] rounded-chip border px-[var(--space-2)] py-[4px] text-caption transition-colors ${
                              nextItem.transporte_llegada === t.value
                                ? "border-primary-token bg-primary-token/10 text-primary-token"
                                : "border-app bg-surface-inset text-muted"
                            }`}
                          >
                            <t.Icon className="size-[14px] shrink-0" />
                            <span>{t.label}</span>
                          </button>
                        ))}
                        <button onClick={() => onEditTransporte(null)} className="px-[var(--space-2)] text-caption text-muted">✕</button>
                      </div>
                    ) : nextTransporte ? (
                      <div className="flex max-w-full items-center gap-[var(--space-2)]">
                        {(() => {
                          const meta = (
                            <>
                              <span className="hidden md:inline">{nextTransporte.label}</span>
                              {hasTravelMeta && (
                                <>
                                  <span className="hidden text-muted opacity-40 md:inline">·</span>
                                  {nextItem.duracion_viaje && <span>{formatCompactRouteDuration(nextItem.duracion_viaje)}</span>}
                                  {nextItem.distancia_viaje && <span className="text-caption text-muted">{formatCompactRouteDistance(nextItem.distancia_viaje)}</span>}
                                </>
                              )}
                            </>
                          );
                          const cls = `${hasTravelMeta ? "flex" : "hidden md:flex"} min-w-0 items-center gap-[6px] rounded-full border border-app bg-surface px-[var(--space-3)] py-[7px] text-caption text-muted md:border-0 md:bg-transparent md:px-0 md:py-0`;
                          return readOnly ? (
                            <span className={cls}>{meta}</span>
                          ) : (
                            <button onClick={() => onEditTransporte(nextItem.id)} className={`${cls} transition-colors hover:text-primary-token`}>{meta}</button>
                          );
                        })()}
                        {connectorMapsUrl && (
                          <a
                            href={connectorMapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-app bg-surface text-muted transition-colors active:bg-surface-inset md:size-auto md:border-0 md:bg-transparent md:active:bg-transparent"
                            title="Abrir en Google Maps"
                          >
                            <Image src="/brands/google-maps.svg" alt="Google Maps" width={18} height={18} className="size-[18px] md:size-[14px]" />
                          </a>
                        )}
                        {connectorWazeUrl && (
                          <a
                            href={connectorWazeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-app bg-surface text-muted transition-colors active:bg-surface-inset md:size-auto md:border-0 md:bg-transparent md:active:bg-transparent"
                            title="Abrir en Waze"
                          >
                            <Image src="/brands/waze-icon.svg" alt="Waze" width={18} height={18} className="size-[18px] md:size-[14px]" />
                          </a>
                        )}
                      </div>
                    ) : !readOnly ? (
                      <button onClick={() => onEditTransporte(nextItem.id)} className="text-caption text-muted transition-colors hover:text-primary-token">
                        + ¿Cómo llegas?
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </Fragment>
        );
      })}
      {nowIndex === items.length && items.length > 0 && <NowLine now={now} />}

      {showAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="group relative flex w-full gap-0 bg-app pb-[var(--space-2)] pt-[var(--space-2)] text-left"
          aria-label={addLabel}
        >
          <div className={TIME_COL} />
          <div className="relative flex w-[28px] shrink-0 justify-center">
            <div className="absolute left-1/2 top-[-8px] h-[10px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
            <div className="relative z-10 mt-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-primary-token/35 bg-primary-token/10 text-primary-token transition-colors group-hover:border-primary-token/55 group-hover:bg-primary-token/16">
              <Plus className="size-[12px]" aria-hidden />
            </div>
          </div>
          <div className="min-w-0 flex-1 self-center pl-[var(--space-3)]">
            <span className="text-body-sm font-[var(--fw-regular)] text-primary-token">Añadir actividad</span>
          </div>
        </button>
      )}
    </div>
  );
}
