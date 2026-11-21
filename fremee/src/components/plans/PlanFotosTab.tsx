"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Capacitor } from "@capacitor/core";
import { uploadPlanAlbumFile } from "@/services/firebase/upload";
import { leerHoraFoto } from "@/lib/foto-hora";
import { addPlanFoto, removePlanFoto } from "@/services/api/repositories/plan-fotos.repository";
import { fetchPlanAlbum, moverFotosAlbum, type FotoColocacion, type PlanAlbum } from "@/services/api/endpoints/album.endpoint";
import {
  agruparAlbum,
  dayLabel,
  opcionesMover,
  dayKeyOf,
  type ActivityBlock,
  type LegBlock,
  type PlacedPhoto,
  type UnclassifiedGroup,
} from "@/lib/album-grouping";
import { Plus, Trash2, Loader2, BookOpen, ChevronRight, Hand, CalendarDays, CircleAlert, Bed, Route, Archive, Check, SquareCheckBig, X } from "lucide-react";
import AlbumMover, { type MoverChoice } from "@/components/plans/AlbumMover";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { DEMO_PHOTO_CREDITS } from "@/config/demo-photos";

/** Author and licence of an example-trip photo (Wikimedia Commons); real uploads have none. */
function DemoPhotoCaption({ url }: { url: string }) {
  const credit = DEMO_PHOTO_CREDITS[url];
  if (!credit) return null;
  return (
    <>
      Foto:{" "}
      <a href={credit.fuente} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        {credit.autor}
      </a>{" "}
      ·{" "}
      {credit.licenciaUrl ? (
        <a href={credit.licenciaUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          {credit.licencia}
        </a>
      ) : (
        credit.licencia
      )}
    </>
  );
}

type Props = {
  planId: number;
  currentUserId: string;
  isMember: boolean;
  /** Admins of the plan can move anybody's photos; everyone else only their own. */
  isAdmin?: boolean;
  refreshKey?: number;
};

// ── Text helpers ────────────────────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const fotosText = (n: number) => (n === 0 ? "Sin fotos" : plural(n, "foto", "fotos"));

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });

function authorName(album: PlanAlbum, userId: string, currentUserId: string): string {
  if (userId === currentUserId) return "Tú";
  const m = album.miembros.find((x) => x.id === userId);
  return (m?.nombre ?? m?.username ?? "Alguien").split(" ")[0];
}

function activitySubtitle(b: ActivityBlock): string {
  const a = b.actividad;
  const parts: string[] = [];
  if (b.sigue) {
    parts.push(b.sigue.salida ? `Salida hasta las ${hhmm(a.fin_at)}` : `Noche ${b.sigue.noche} de ${b.sigue.total}`);
  } else if (a.all_day) {
    parts.push("Todo el día");
  } else if (a.tipo === "HOTEL" || a.tipo === "ALOJAMIENTO") {
    const nights = Math.round((new Date(dayKeyOf(Date.parse(a.fin_at))).getTime() - new Date(dayKeyOf(Date.parse(a.inicio_at))).getTime()) / 86_400_000);
    parts.push(nights >= 1 ? `Entrada ${hhmm(a.inicio_at)} · ${plural(nights, "noche", "noches")}` : `Entrada ${hhmm(a.inicio_at)}`);
  } else {
    parts.push(`${hhmm(a.inicio_at)} – ${hhmm(a.fin_at)}`);
    if (a.ubicacion_nombre) parts.push(a.ubicacion_nombre);
  }
  parts.push(fotosText(b.fotos.length));
  return parts.join(" · ");
}

function legSubtitle(b: LegBlock): string {
  const hasta = hhmm(b.hasta.inicio_at);
  return `${b.desde ? `${hhmm(b.desde.fin_at)} – ${hasta}` : `Hasta las ${hasta}`} · ${fotosText(b.fotos.length)}`;
}

const MOTIVO_TEXT = {
  antes: "Antes del viaje",
  despues: "Después de la última actividad",
  sin_hora: "Sin hora",
  otro: "Entre actividades, sin encaje",
} as const;

/** What a thumbnail in «Sin clasificar» says about when it was taken. */
function dateMark(tomadaAt: string | null, planYear: number): string {
  if (!tomadaAt) return "Sin hora";
  const d = new Date(tomadaAt);
  if (d.getFullYear() !== planYear) return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  return `${cap(d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" }).replace(/[.,]/g, ""))}, ${hhmm(tomadaAt)}`;
}

// ── Tab ─────────────────────────────────────────────────────────────────────────────────

export default function PlanFotosTab({ planId, currentUserId, isMember, isAdmin = false, refreshKey = 0 }: Props) {
  const [album, setAlbum] = useState<PlanAlbum | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [moverOpen, setMoverOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [notice, setNotice] = useState<{ id: number; title: string; detail?: string; undo?: () => void; error?: boolean } | null>(null);
  const lastSelected = useRef<number | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isDesktop, setIsDesktop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const [reloadTick, setReloadTick] = useState(0);
  const reload = useCallback(() => setReloadTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchPlanAlbum(planId)
      .then((a) => {
        if (cancelled) return;
        setAlbum(a);
        setStatus("ok");
      })
      .catch((e) => {
        console.error("[PlanFotosTab]", e);
        if (!cancelled) setStatus((s) => (s === "ok" ? s : "error"));
      });
    return () => {
      cancelled = true;
    };
  }, [planId, refreshKey, reloadTick]);

  const grouping = useMemo(() => {
    if (!album) return null;
    return agruparAlbum({
      planInicio: album.plan.inicio_at,
      planFin: album.plan.fin_at,
      actividades: album.actividades,
      fotos: album.fotos,
      incluirVacios: album.fotos.length === 0,
    });
  }, [album]);

  const planYear = album ? new Date(album.plan.inicio_at).getFullYear() : new Date().getFullYear();

  /** Photos in the order they are drawn: the lightbox walks through them. */
  const orderedUrls = useMemo(() => {
    if (!grouping) return [] as string[];
    const out: string[] = [];
    for (const d of grouping.days) for (const b of d.blocks) for (const p of b.fotos) out.push(p.foto.url);
    for (const g of grouping.sinClasificar.grupos) for (const p of g.fotos) out.push(p.foto.url);
    return out;
  }, [grouping]);

  /** Photo ids in the order they are drawn (Shift+click selects the range between two). */
  const orderedPhotoIds = useMemo(() => {
    if (!grouping) return [] as number[];
    const out: number[] = [];
    for (const d of grouping.days) for (const b of d.blocks) for (const p of b.fotos) out.push(p.foto.id);
    for (const g of grouping.sinClasificar.grupos) for (const p of g.fotos) out.push(p.foto.id);
    return out;
  }, [grouping]);

  const moverDays = useMemo(() => (album && grouping ? opcionesMover(album.actividades, grouping) : []), [album, grouping]);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";
    setUploading(true);
    try {
      await Promise.all(
        files.map(async (file) => {
          const hora = await leerHoraFoto(file);
          const { filePath, downloadUrl } = await uploadPlanAlbumFile({ file, planId });
          return addPlanFoto({
            planId,
            userId: currentUserId,
            url: downloadUrl,
            storagePath: filePath,
            tomadaAt: hora?.at ?? null,
            tomadaFuente: hora?.fuente ?? null,
          });
        }),
      );
      reload();
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(fotoId: number, url: string) {
    setDeletingId(fotoId);
    try {
      await removePlanFoto({ id: fotoId, userId: currentUserId });
      setAlbum((prev) => (prev ? { ...prev, fotos: prev.fotos.filter((f) => f.id !== fotoId) } : prev));
      setLightboxUrl((prev) => (prev === url ? null : prev));
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  }

  // ── Selection and «Mover a…» ───────────────────────────────────────────────────────────

  const canMove = useCallback(
    (userId: string) => isMember && (isAdmin || userId === currentUserId),
    [isMember, isAdmin, currentUserId],
  );

  function exitSelection() {
    setSelecting(false);
    setSelected(new Set());
    setMoverOpen(false);
    lastSelected.current = null;
  }

  function toggleSelected(id: number, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastSelected.current !== null && album) {
        // Shift+click: everything between the last one and this one, in the order drawn.
        const ids = orderedPhotoIds;
        const a = ids.indexOf(lastSelected.current);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const byId = new Map(album.fotos.map((f) => [f.id, f]));
          for (const pid of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) {
            const f = byId.get(pid);
            if (f && canMove(f.user_id)) next.add(pid);
          }
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastSelected.current = id;
  }

  function startSelectionWith(id: number) {
    setSelecting(true);
    setSelected(new Set([id]));
    lastSelected.current = id;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  }

  function showNotice(n: Omit<NonNullable<typeof notice>, "id">) {
    setNotice({ id: Date.now(), ...n });
  }

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice((cur) => (cur && cur.id === notice.id ? null : cur)), notice.error ? 6000 : 10000);
    return () => clearTimeout(t);
  }, [notice]);

  /** Sets the placement of photos in the local copy, so the album redraws without waiting. */
  function applyLocal(ids: number[], c: FotoColocacion) {
    const set = new Set(ids);
    setAlbum((prev) =>
      prev ? { ...prev, fotos: prev.fotos.map((f) => (set.has(f.id) ? { ...f, colocacion: c.colocacion, subplan_id: c.subplanId } : f)) } : prev,
    );
  }

  async function handlePick(choice: MoverChoice) {
    if (!album || !grouping || moving || selected.size === 0) return;
    const ids = [...selected];
    const destino: FotoColocacion =
      choice.kind === "auto"
        ? { colocacion: null, subplanId: null }
        : choice.kind === "sin_clasificar"
          ? { colocacion: "sin_clasificar", subplanId: null }
          : { colocacion: choice.option.colocacion, subplanId: choice.option.subplanId };
    const antes = album.fotos.filter((f) => selected.has(f.id));
    const placementBefore = new Map(grouping.days.flatMap((d) => d.blocks.flatMap((b) => b.fotos)).concat(grouping.sinClasificar.grupos.flatMap((g) => g.fotos)).map((p) => [p.foto.id, p.colocacion]));
    setMoving(true);
    try {
      await moverFotosAlbum(planId, ids, destino);
    } catch (err) {
      console.error("Move failed:", err);
      setMoving(false);
      showNotice({ title: "No se pudo mover", detail: "Comprueba la conexión y vuelve a intentarlo.", error: true });
      return;
    }
    setMoving(false);
    applyLocal(ids, destino);
    exitSelection();

    const undo = () => {
      // Each photo goes back to where it was: the ones that shared a placement go together.
      const grupos = new Map<string, { ids: number[]; c: FotoColocacion }>();
      for (const f of antes) {
        const c: FotoColocacion = { colocacion: f.colocacion, subplanId: f.subplan_id };
        const k = `${c.colocacion}|${c.subplanId}`;
        (grupos.get(k) ?? grupos.set(k, { ids: [], c }).get(k)!).ids.push(f.id);
      }
      setNotice(null);
      for (const g of grupos.values()) {
        applyLocal(g.ids, g.c);
        void moverFotosAlbum(planId, g.ids, g.c).catch(() => reload());
      }
    };

    const n = ids.length;
    if (choice.kind === "auto") {
      showNotice({ title: n === 1 ? "Colocada por su hora" : `${n} fotos colocadas por su hora`, undo });
      return;
    }
    const nombre =
      choice.kind === "sin_clasificar"
        ? "Sin clasificar"
        : choice.option.kind === "viaje"
          ? `Viaje · ${choice.option.titulo}`
          : choice.option.kind === "sigue"
            ? choice.option.titulo.replace(/^Sigue · /, "")
            : choice.option.titulo;
    // Where their time would have put them, when it is somewhere else.
    const lugarAuto = (id: number): string | null => {
      const c = placementBefore.get(id);
      if (!c) return null;
      const d = c.auto;
      if (d.kind === "sin_clasificar") return "Sin clasificar";
      const act = album.actividades.find((a) => a.id === (d.kind === "actividad" ? d.subplanId : d.hastaSubplanId));
      return act ? (d.kind === "viaje" ? `Viaje · hasta ${act.titulo}` : act.titulo) : null;
    };
    const mismo = (id: number) => {
      const c = placementBefore.get(id);
      if (!c) return true;
      const d = c.auto;
      if (choice.kind === "sin_clasificar") return d.kind === "sin_clasificar";
      if (choice.kind !== "destino") return true;
      return (
        d.kind === choice.option.colocacion && (d.kind === "actividad" ? d.subplanId === choice.option.subplanId : d.kind === "viaje" && d.hastaSubplanId === choice.option.subplanId)
      );
    };
    const distintas = ids.filter((id) => !mismo(id));
    let detail: string | undefined;
    if (distintas.length === 1 && n === 1) {
      const f = album.fotos.find((x) => x.id === distintas[0]);
      const donde = lugarAuto(distintas[0]);
      detail = f?.tomada_at && donde ? `Por su hora, ${hhmm(f.tomada_at)}, iría en ${donde}` : undefined;
    } else if (distintas.length > 0) {
      detail = `Por su hora, ${distintas.length === n ? "irían" : `${distintas.length} de ellas irían`} en otro sitio`;
    }
    showNotice({ title: n === 1 ? `Movida a ${nombre}` : `${n} fotos movidas a ${nombre}`, detail, undo });
  }

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function jumpTo(id: string) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  const addButton = isMember ? (
    <button
      type="button"
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading}
      className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--primary)] text-[15px] font-[600] text-[var(--primary)] transition-colors hover:bg-[var(--primary)]/8 disabled:cursor-wait"
    >
      {uploading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Plus className="size-5" aria-hidden />}
      {uploading ? "Subiendo…" : "Añadir fotos"}
    </button>
  ) : null;

  // ── Loading and error ─────────────────────────────────────────────────────────────────

  if (status === "loading" && !album) {
    return (
      <div className="px-[var(--page-margin-x)] pt-5 pb-8" role="status" aria-live="polite">
        <AlbumLink planId={planId} />
        <p className="mb-3 text-[14px] text-muted">Cargando el álbum…</p>
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-square w-full animate-pulse rounded-lg bg-[var(--surface-2)] motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error" || !album || !grouping) {
    return (
      <div className="px-[var(--page-margin-x)] pt-5 pb-8">
        <AlbumLink planId={planId} />
        <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
          <CircleAlert className="size-8 text-muted" aria-hidden />
          <p className="text-[15px] font-[600] text-app">No se pudo cargar el álbum</p>
          <p className="text-[14px] text-muted">Comprueba la conexión y vuelve a intentarlo.</p>
          <button
            type="button"
            onClick={() => { setStatus("loading"); reload(); }}
            className="mt-1 h-11 rounded-lg border border-app px-4 text-[15px] font-[600] text-app transition-colors hover:border-[var(--primary)]"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Album ─────────────────────────────────────────────────────────────────────────────

  const sin = grouping.sinClasificar;
  const hayFotos = grouping.total > 0;
  const visibleDays = grouping.days.filter((d) => (hayFotos ? d.fotoCount > 0 : d.blocks.length > 0));

  const photoProps = {
    album,
    currentUserId,
    deletingId,
    onOpen: (url: string) => setLightboxUrl(url),
    onDelete: handleDelete,
    selecting,
    selected,
    canMove,
    onToggleSelect: toggleSelected,
    onStartSelect: startSelectionWith,
  };

  return (
    <div className="px-[var(--page-margin-x)] pt-5 pb-8">
      {isMember && <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />}

      <AlbumLink planId={planId} />

      <div className="sticky top-0 z-10 -mx-[var(--page-margin-x)] mb-3 flex min-h-11 items-center justify-between bg-[var(--bg)] px-[var(--page-margin-x)]">
        {selecting ? (
          <>
            <button type="button" onClick={exitSelection} aria-label="Salir de la selección" className="-ml-3 flex size-11 items-center justify-center text-app">
              <X className="size-[22px]" aria-hidden />
            </button>
            <p className="flex-1 text-[16px] font-[600] text-app tabular-nums" role="status" aria-live="polite">
              {selected.size === 0 ? "Elige fotos" : selected.size === 1 ? "1 seleccionada" : `${selected.size} seleccionadas`}
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] font-[600] text-app tabular-nums">{hayFotos ? plural(grouping.total, "foto", "fotos") : "Fotos"}</p>
            {hayFotos && album.fotos.some((f) => canMove(f.user_id)) && (
              <button type="button" onClick={() => setSelecting(true)} className="-mr-3 inline-flex min-h-11 items-center gap-1.5 px-3 text-[14px] font-[600] text-app">
                <SquareCheckBig className="size-[18px]" aria-hidden />
                Seleccionar
              </button>
            )}
          </>
        )}
      </div>
      {!selecting && addButton}

      {!hayFotos && (
        <div className="mt-6 text-center">
          <p className="text-[16px] font-[600] text-app">Todavía no hay fotos</p>
          <p className="mx-auto mt-1 max-w-[32ch] text-[14px] text-muted">
            Súbelas cuando quieras, también al volver: cada una se coloca en su actividad por la hora a la que se hizo.
          </p>
        </div>
      )}

      {/* Mobile: a strip of days to jump to. */}
      {hayFotos && (
        <nav aria-label="Días del álbum" className="-mx-[var(--page-margin-x)] mt-4 flex gap-1.5 overflow-x-auto px-[var(--page-margin-x)] pb-1 lg:hidden">
          {grouping.days.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={d.fotoCount === 0}
              onClick={() => jumpTo(`album-dia-${d.key}`)}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-app px-3.5 text-[13px] font-[600] text-muted disabled:opacity-40"
            >
              Día {d.numero}
            </button>
          ))}
          {sin.total > 0 && (
            <button
              type="button"
              onClick={() => jumpTo("album-sin-clasificar")}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-app px-3.5 text-[13px] font-[600] text-muted"
            >
              Sin clasificar <span className="tabular-nums text-app">{sin.total}</span>
            </button>
          )}
        </nav>
      )}

      <div className="mt-2 flex gap-8">
        {/* Desktop: the days on the left. */}
        {hayFotos && (
          <nav aria-label="Días del álbum" className="sticky top-24 hidden w-[220px] shrink-0 self-start lg:flex lg:flex-col lg:gap-0.5 lg:pt-6">
            {grouping.days.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => jumpTo(`album-dia-${d.key}`)}
                disabled={d.fotoCount === 0}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-[14px] text-muted transition-colors hover:bg-[var(--surface-2)] disabled:opacity-40"
              >
                <span className="font-[600] text-app">Día {d.numero}</span>
                <em className="text-[12px] not-italic">{dayLabel(d.key)}</em>
                <span className="tabular-nums ml-auto text-[12px]">{d.fotoCount}</span>
              </button>
            ))}
            {sin.total > 0 && (
              <button
                type="button"
                onClick={() => jumpTo("album-sin-clasificar")}
                className="mt-2 flex min-h-11 items-center gap-2 rounded-none border-t border-app px-3 pt-2 text-left text-[14px] text-muted"
              >
                Sin clasificar <span className="tabular-nums ml-auto text-[12px]">{sin.total}</span>
              </button>
            )}
          </nav>
        )}

        <div className="min-w-0 max-w-[960px] flex-1">
          {visibleDays.map((day) => (
            <section key={day.key} id={`album-dia-${day.key}`} aria-label={dayLabel(day.key)} className="scroll-mt-28">
              <div className="mb-4 border-b border-app pt-6 pb-2.5">
                <h2 className="text-[18px] font-[600] leading-[1.3] text-app">{dayLabel(day.key)}</h2>
                <p className="tabular-nums mt-0.5 text-[13px] text-muted">
                  Día {day.numero} · {hayFotos ? plural(day.fotoCount, "foto", "fotos") : "Sin fotos"}
                </p>
              </div>
              {day.blocks.map((b) =>
                b.kind === "viaje" ? (
                  <LegSection key={b.key} block={b} expanded={expanded.has(b.key)} max={isDesktop ? 8 : 4} onToggle={() => toggleExpanded(b.key)} {...photoProps} />
                ) : (
                  <ActivitySection key={b.key} block={b} expanded={expanded.has(b.key)} max={isDesktop ? 12 : 9} onToggle={() => toggleExpanded(b.key)} {...photoProps} />
                ),
              )}
            </section>
          ))}

          {sin.total > 0 && (
            <section id="album-sin-clasificar" aria-label="Sin clasificar" className="scroll-mt-28">
              <div className="mt-4 mb-4 flex items-center gap-2.5 border-b border-app pt-6 pb-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-app text-app">
                  <Archive className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[18px] font-[600] leading-[1.3] text-app">Sin clasificar</h2>
                  <p className="mt-0.5 text-[13px] text-muted">No caen en ninguna actividad ni viaje</p>
                </div>
                <span className="tabular-nums inline-flex h-7 items-center rounded-full border border-app px-2.5 text-[13px] font-[600] text-app">{sin.total}</span>
              </div>
              {sin.grupos.map((g) => (
                <UnclassifiedSection key={g.key} group={g} porFecha={sin.porFecha} planYear={planYear} expanded={expanded.has(`sin-${g.key}`)} max={isDesktop ? 12 : 9} onToggle={() => toggleExpanded(`sin-${g.key}`)} {...photoProps} />
              ))}
              {hayFotos && <p className="py-3 text-center text-[12px] text-muted">Hasta aquí el viaje</p>}
            </section>
          )}
        </div>
      </div>

      {selecting && (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-app bg-[var(--surface)] px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <div className="mx-auto flex max-w-[960px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            {!isAdmin && album.fotos.some((f) => !canMove(f.user_id)) && (
              <p className="text-[13px] text-muted">Solo puedes mover tus fotos; las de los demás las mueve un admin.</p>
            )}
            <button
              type="button"
              disabled={selected.size === 0 || moving}
              onClick={() => setMoverOpen(true)}
              className="ml-auto flex h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-[15px] font-[600] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:bg-[var(--surface-2)] disabled:text-muted lg:w-auto"
            >
              {moving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              {selected.size === 0 ? "Mover a…" : selected.size === 1 ? "Mover 1 foto a…" : `Mover ${selected.size} fotos a…`}
            </button>
          </div>
        </div>
      )}

      {moverOpen && selected.size > 0 && (
        <AlbumMover count={selected.size} days={moverDays} desktop={isDesktop} onPick={(c) => { setMoverOpen(false); void handlePick(c); }} onClose={() => setMoverOpen(false)} />
      )}

      {notice && (
        <div
          role="status"
          className={`fixed inset-x-3 bottom-6 z-[70] mx-auto flex min-h-14 max-w-[420px] items-center gap-3 rounded-lg border py-2 pr-1.5 pl-3.5 text-[14px] leading-[1.35] shadow-[0_12px_32px_rgba(0,0,0,0.3)] ${notice.error ? "border-[var(--error)] bg-[var(--surface)] text-app" : "border-app bg-[var(--surface)] text-app"}`}
        >
          <span className="min-w-0 flex-1">
            <b className="font-[600]">{notice.title}</b>
            {notice.detail && <span className="block text-[13px] text-muted">{notice.detail}</span>}
          </span>
          {notice.undo && (
            <button type="button" onClick={notice.undo} className="min-h-11 shrink-0 px-2.5 text-[14px] font-[600] text-[var(--primary)]">
              Deshacer
            </button>
          )}
        </div>
      )}

      {album.fotos.some((foto) => DEMO_PHOTO_CREDITS[foto.url]) && (
        <p className="mt-[var(--space-3)] text-[12px] text-tertiary">Fotos de ejemplo de Wikimedia Commons; al abrir cada una verás su autor y licencia.</p>
      )}

      {lightboxUrl && (
        <ImageLightbox
          url={lightboxUrl}
          imageUrls={orderedUrls}
          onClose={() => setLightboxUrl(null)}
          caption={(url) => (DEMO_PHOTO_CREDITS[url] ? <DemoPhotoCaption url={url} /> : null)}
        />
      )}
    </div>
  );
}

// ── Blocks ──────────────────────────────────────────────────────────────────────────────

type PhotoCtx = {
  album: PlanAlbum;
  currentUserId: string;
  deletingId: number | null;
  onOpen: (url: string) => void;
  onDelete: (id: number, url: string) => void;
  selecting: boolean;
  selected: Set<number>;
  canMove: (userId: string) => boolean;
  onToggleSelect: (id: number, shift: boolean) => void;
  onStartSelect: (id: number) => void;
};

type BlockProps = PhotoCtx & { expanded: boolean; max: number; onToggle: () => void };

function ActivitySection({ block, expanded, max, onToggle, ...ctx }: BlockProps & { block: ActivityBlock }) {
  const a = block.actividad;
  const stay = a.tipo === "HOTEL" || a.tipo === "ALOJAMIENTO";
  const shown = expanded ? block.fotos : block.fotos.slice(0, max);
  const rest = block.fotos.length - shown.length;
  return (
    <section aria-label={a.titulo} className="pb-6">
      <div className="flex min-h-11 items-start gap-2.5">
        {stay || block.sigue ? (
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border-2 border-white bg-[#00c9a7] text-[#111]" aria-hidden>
            <Bed className="size-[15px]" />
          </span>
        ) : (
          <span className="tabular-nums flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-white bg-[#00c9a7] text-[13px] font-[700] text-[#111]" aria-hidden>
            {block.ordinal ?? ""}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-[3px]">
          <h3 className="text-[16px] font-[600] leading-[1.3] text-app">
            {block.sigue && !block.sigue.salida ? <>Sigue · {a.titulo}</> : a.titulo}
          </h3>
          <p className="tabular-nums mt-0.5 text-[13px] text-muted">{activitySubtitle(block)}</p>
        </div>
      </div>
      {shown.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-1 lg:grid-cols-6">
          {shown.map((p, i) => (
            <Thumb key={p.foto.id} placed={p} more={i === shown.length - 1 && rest > 0 ? rest : 0} onMore={onToggle} {...ctx} />
          ))}
        </div>
      )}
      {expanded && block.fotos.length > max && <CollapseLink onClick={onToggle} />}
    </section>
  );
}

function LegSection({ block, expanded, max, onToggle, ...ctx }: BlockProps & { block: LegBlock }) {
  const shown = expanded ? block.fotos : block.fotos.slice(0, max);
  const rest = block.fotos.length - shown.length;
  const title = block.desde ? `${block.desde.titulo} → ${block.hasta.titulo}` : `hasta ${block.hasta.titulo}`;
  return (
    <section aria-label={`Viaje de ${block.desde?.titulo ?? "…"} a ${block.hasta.titulo}`} className="relative -mt-3 mb-3 pb-3 pl-10">
      <span aria-hidden className="absolute top-0 bottom-0 left-[13px] border-l-2 border-dashed border-app" />
      <div className="-ml-10 flex min-h-9 items-center gap-2.5">
        <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-app bg-[var(--bg)] text-muted" aria-hidden>
          <Route className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-[600] leading-[1.3] text-app">
            Viaje <span className="font-[500] text-muted">· {title}</span>
          </p>
          <p className="tabular-nums text-[12px] text-muted">{legSubtitle(block)}</p>
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {shown.map((p, i) => (
          <div key={p.foto.id} className="w-[72px] shrink-0">
            <Thumb placed={p} small more={i === shown.length - 1 && rest > 0 ? rest : 0} onMore={onToggle} {...ctx} />
          </div>
        ))}
      </div>
      {expanded && block.fotos.length > max && <CollapseLink onClick={onToggle} />}
    </section>
  );
}

function UnclassifiedSection({ group, porFecha, planYear, expanded, max, onToggle, ...ctx }: BlockProps & { group: UnclassifiedGroup; porFecha: boolean; planYear: number }) {
  const shown = expanded ? group.fotos : group.fotos.slice(0, max);
  const rest = group.fotos.length - shown.length;
  const label = porFecha ? (group.dayKey ? dayLabel(group.dayKey) : MOTIVO_TEXT.sin_hora) : MOTIVO_TEXT[group.motivo ?? "otro"];
  return (
    <div className="mb-4">
      <p className="text-[12px] font-[600] tracking-[.02em] text-muted">
        {label} · <span className="tabular-nums">{group.fotos.length}</span>
      </p>
      <div className="mt-2 grid grid-cols-3 gap-1 lg:grid-cols-6">
        {shown.map((p, i) => (
          <Thumb
            key={p.foto.id}
            placed={p}
            mark={{ text: dateMark(p.foto.tomada_at, planYear), missing: !p.foto.tomada_at }}
            more={i === shown.length - 1 && rest > 0 ? rest : 0}
            onMore={onToggle}
            {...ctx}
          />
        ))}
      </div>
      {expanded && group.fotos.length > max && <CollapseLink onClick={onToggle} />}
    </div>
  );
}

function CollapseLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-2 min-h-11 text-[14px] font-[600] text-[var(--primary)]">
      Ver menos
    </button>
  );
}

// ── Thumbnail ───────────────────────────────────────────────────────────────────────────

function Thumb({
  placed,
  small,
  mark,
  more,
  onMore,
  album,
  currentUserId,
  deletingId,
  onOpen,
  onDelete,
  selecting,
  selected,
  canMove,
  onToggleSelect,
  onStartSelect,
}: PhotoCtx & {
  placed: PlacedPhoto;
  small?: boolean;
  /** «Sin clasificar»: when it was taken, in place of «Aprox.». */
  mark?: { text: string; missing: boolean };
  /** The last thumbnail of a long block says how many more there are, and opens them. */
  more: number;
  onMore: () => void;
}) {
  const { foto, colocacion } = placed;
  const own = foto.user_id === currentUserId;
  const deleting = deletingId === foto.id;
  const when = foto.tomada_at ? hhmm(foto.tomada_at) : "sin hora";
  const label = `Foto de ${authorName(album, foto.user_id, currentUserId)}, ${when}${colocacion.aprox ? ", hora aproximada" : ""}${colocacion.manual ? ", colocada a mano" : ""}`;
  const radius = small ? "rounded-md" : "rounded-lg";
  const selectable = canMove(foto.user_id);
  const isSelected = selected.has(foto.id);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressed = useRef(false);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current);
    press.current = null;
  };
  return (
    <div className={`group relative aspect-square w-full overflow-hidden ${radius} bg-[var(--surface-2)] ${selecting && !selectable ? "opacity-35" : ""} ${isSelected ? "ring-[3px] ring-inset ring-[var(--primary)]" : ""}`}>
      <button
        type="button"
        aria-label={more ? `Ver ${more} fotos más` : label}
        aria-pressed={selecting && selectable ? isSelected : undefined}
        aria-disabled={selecting && !selectable ? true : undefined}
        onClick={(e) => {
          if (pressed.current) {
            pressed.current = false;
            return;
          }
          if (more) {
            onMore();
            return;
          }
          if (selecting) {
            if (selectable) onToggleSelect(foto.id, e.shiftKey);
            return;
          }
          onOpen(foto.url);
        }}
        onPointerDown={(e) => {
          if (selecting || !selectable || e.pointerType === "mouse" || more) return;
          pressed.current = false;
          cancelPress();
          press.current = setTimeout(() => {
            pressed.current = true;
            onStartSelect(foto.id);
          }, 450);
        }}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => {
          if (!selecting && selectable && e.nativeEvent instanceof MouseEvent && (e.nativeEvent as PointerEvent).pointerType === "touch") e.preventDefault();
        }}
        className="absolute inset-0 select-none [-webkit-touch-callout:none]"
      >
        <FotoImage src={foto.url} />
      </button>
      {selecting && selectable && (
        <span
          aria-hidden
          className={`pointer-events-none absolute top-1.5 left-1.5 flex size-6 items-center justify-center rounded-full border-2 ${isSelected ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--bg)]" : "border-white bg-[rgba(17,17,17,.35)] text-transparent"}`}
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {more > 0 && (
        <span className="tabular-nums pointer-events-none absolute inset-0 flex items-center justify-center bg-black/60 text-[20px] font-[600] text-white">+{more}</span>
      )}
      {more === 0 && mark && (
        <span className="pointer-events-none absolute bottom-1 left-1 inline-flex h-5 items-center gap-[3px] rounded-full bg-[rgba(17,17,17,.8)] pr-1.5 pl-1 text-[11px] font-[600] leading-none whitespace-nowrap text-white">
          {mark.missing ? <CircleAlert className="size-3" aria-hidden /> : <CalendarDays className="size-3" aria-hidden />}
          {mark.text}
        </span>
      )}
      {more === 0 && !mark && colocacion.aprox && (
        <span className="pointer-events-none absolute bottom-1 left-1 inline-flex h-5 items-center gap-[3px] rounded-full bg-[rgba(17,17,17,.8)] pr-1.5 pl-1 text-[11px] font-[600] leading-none text-white">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9.5" strokeDasharray="3.2 3" />
            <path d="M12 7v5l3 2" />
          </svg>
          Aprox.
        </span>
      )}
      {more === 0 && colocacion.manual && (
        <span className="pointer-events-none absolute top-1 right-1 flex size-[22px] items-center justify-center rounded-full bg-[rgba(17,17,17,.8)] text-white" aria-hidden>
          <Hand className="size-3" />
        </span>
      )}
      {own && more === 0 && !small && (
        <button
          type="button"
          aria-label="Eliminar foto"
          disabled={deleting}
          onClick={() => onDelete(foto.id, foto.url)}
          className="absolute right-1 bottom-1 hidden size-8 items-center justify-center rounded-full bg-black/55 text-white transition-colors group-hover:flex hover:bg-red-500/80 focus-visible:flex disabled:opacity-50"
        >
          {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}

/** Photo tile: a pulsing placeholder until the image arrives, then a short fade-in. */
function FotoImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-[var(--surface-2)] motion-reduce:animate-none" aria-hidden />}
      <Image
        src={src}
        alt=""
        fill
        className={`object-cover transition-opacity duration-300 motion-reduce:transition-none ${loaded ? "opacity-100" : "opacity-0"}`}
        sizes="(max-width: 640px) 34vw, 160px"
        unoptimized
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
      />
    </>
  );
}

/** Entry to the trip album (/plans/[id]/album; static route + ?id= in the mobile app). */
function AlbumLink({ planId }: { planId: number }) {
  const href = Capacitor.isNativePlatform() ? `/plans/static/album?id=${planId}` : `/plans/${planId}/album`;
  return (
    <Link
      href={href}
      className="mb-4 flex items-center gap-3 rounded-2xl border border-app bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--primary)]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/12 text-[var(--primary)]">
        <BookOpen className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-[600] text-app">Álbum del viaje</span>
        <span className="block text-[13px] text-muted">El viaje día a día: sitios, rutas, fotos y cifras</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
    </Link>
  );
}
