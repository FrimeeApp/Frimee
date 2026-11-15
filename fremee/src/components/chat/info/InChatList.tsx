"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Download, ExternalLink, ImagePlus, MapPin, Play } from "lucide-react";
import { contenidoChatEndpoint, type ContenidoRow, type ContenidoTipo } from "@/services/api/endpoints/chat.endpoint";
import { parseMoment, type Moment } from "@/components/chat/bitacora/moments";
import { mapsUrl } from "@/components/chat/bitacora/MomentCards";
import { ImageLightbox, LightboxAction } from "@/components/ui/ImageLightbox";
import { savePlanFotoFromChat } from "@/services/api/endpoints/plan-fotos.endpoint";

const PAGE = 30;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

export const IN_CHAT_LABEL: Record<ContenidoTipo, string> = {
  fotos: "Fotos y vídeos",
  archivos: "Archivos",
  sitios: "Sitios",
  enlaces: "Enlaces",
  decisiones: "Decisiones",
};

const EMPTY: Record<ContenidoTipo, string> = {
  fotos: "Aún no habéis compartido fotos ni vídeos.",
  archivos: "Aún no habéis compartido archivos.",
  sitios: "Aún no habéis compartido sitios.",
  enlaces: "Aún no habéis compartido enlaces.",
  decisiones: "Aún no habéis decidido nada.",
};

/** «hoy», «ayer», «12 nov», another year «12 nov 2024». */
function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return "hoy";
  if (diff === 1) return "ayer";
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ""}`;
}

const logError = (where: string, e: unknown) =>
  console.error(`[en el chat] ${where}:`, (e as { message?: string } | null)?.message ?? String(e));

/**
 * A list of «En el chat» (gi-sistema): photos, places, links or decisions, newest first, by pages.
 * Every row takes you to its message; the chat stays where it is next to the panel.
 */
export function InChatList({ chatId, tipo, total, planId, currentUserId, newest, onJumpTo }: {
  chatId: string;
  tipo: ContenidoTipo;
  /** From fn_chat_info: how many placeholders to draw while loading. */
  total?: number;
  /** A plan's chat: photos can be saved to its album. */
  planId?: number;
  currentUserId: string;
  /** A new message of «En el chat» arrived (its id): what is newer than the top row is added. */
  newest?: number;
  onJumpTo: (mensajeId: number) => void;
}) {
  const [rows, setRows] = useState<ContenidoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const busyRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async (from: ContenidoRow[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError(false);
    try {
      const page = await contenidoChatEndpoint(chatId, tipo, from.length ? from[from.length - 1].id : null, PAGE);
      setRows([...from, ...page]);
      if (page.length < PAGE) setDone(true);
    } catch (e) {
      logError(`Error cargando ${tipo}`, e);
      setError(true);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [chatId, tipo]);

  useEffect(() => {
    setRows([]);
    setDone(false);
    void loadMore([]);
  }, [loadMore]);

  // Arrived while open: the first page again, keeping only what is newer than the top row.
  const topId = rows[0]?.id ?? 0;
  useEffect(() => {
    if (!newest || newest <= topId || busyRef.current) return;
    let alive = true;
    contenidoChatEndpoint(chatId, tipo, null, PAGE)
      .then((page) => {
        if (!alive) return;
        setRows((prev) => [...page.filter((r) => r.id > (prev[0]?.id ?? 0)), ...prev]);
        if (page.length === 0) setDone(true);
      })
      .catch((e) => logError(`Error actualizando ${tipo}`, e));
    return () => { alive = false; };
  }, [newest, topId, chatId, tipo]);

  // The next page when the end of the list comes into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || done || error) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((x) => x.isIntersecting)) void loadMore(rows);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [rows, done, error, loadMore]);

  const photoUrls = rows.map((r) => r.image_url).filter((u): u is string => Boolean(u));
  // In the viewer, the next page arrives before reaching the last loaded one.
  const nearEnd = useCallback((i: number) => {
    if (!done && !error && i >= rows.length - 3) void loadMore(rows);
  }, [done, error, rows, loadMore]);
  const isVideoUrl = (url: string) => Boolean(rows.find((r) => r.image_url === url)?.image_type?.startsWith("video/"));

  const footer = error ? (
    <p className="flex min-h-[44px] items-center gap-[8px] px-[8px] text-[13px] text-muted">
      No se han podido cargar.
      <button type="button" onClick={() => void loadMore(rows)} className="min-h-[44px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)]">Reintentar</button>
    </p>
  ) : !done ? (
    <div ref={sentinelRef} aria-hidden className={tipo === "fotos" ? "h-[1px]" : "mx-[8px] mt-[4px] h-[52px] animate-pulse rounded-[8px] bg-[var(--surface-2)] motion-reduce:animate-none"} />
  ) : null;

  if (done && rows.length === 0) {
    return <p className="flex min-h-[44px] items-center px-[8px] text-[14px] text-muted">{EMPTY[tipo]}</p>;
  }

  return (
    <div aria-busy={loading}>
      {tipo === "fotos" ? (
        <>
          <ul className="grid grid-cols-3 gap-[2px] px-[8px]">
            {rows.map((r) => r.image_url && (
              <li key={r.id}>
                <button type="button" onClick={() => setViewer(r.image_url)} aria-label={`${r.image_type?.startsWith("video/") ? "Vídeo" : "Foto"} de ${r.sender_nombre}, ${shortDate(r.created_at)}`} className="relative block aspect-square w-full overflow-hidden bg-[var(--surface-2)]">
                  {r.image_type?.startsWith("video/") ? <VideoThumb url={r.image_url} /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  )}
                </button>
              </li>
            ))}
            {loading && rows.length === 0 && Array.from({ length: Math.min(Math.max(total ?? 9, 1), 9) }, (_, i) => (
              <li key={`s${i}`} aria-hidden className="aspect-square animate-pulse bg-[var(--surface-2)] motion-reduce:animate-none" />
            ))}
          </ul>
          {footer}
        </>
      ) : (
        <>
          <ul>
            {rows.map((r) => (
              <li key={r.id}><Row row={r} tipo={tipo} onJumpTo={onJumpTo} /></li>
            ))}
          </ul>
          {footer}
        </>
      )}

      {viewer && (
        <ImageLightbox
          url={viewer}
          imageUrls={photoUrls}
          isVideo={isVideoUrl}
          totalCount={total}
          onIndexChange={nearEnd}
          onClose={() => setViewer(null)}
          alt={(url) => {
            const r = rows.find((x) => x.image_url === url);
            return r ? `Foto de ${r.sender_nombre}, ${shortDate(r.created_at)}` : "Foto";
          }}
          caption={(url) => {
            const r = rows.find((x) => x.image_url === url);
            if (!r) return null;
            return (
              <ViewerCaption
                row={r}
                planId={planId}
                currentUserId={currentUserId}
                onJump={() => { setViewer(null); onJumpTo(r.id); }}
              />
            );
          }}
        />
      )}
    </div>
  );
}

/** Under the viewer: who and when, «Ir al mensaje», «Descargar» and, in a plan's chat, the album. */
function ViewerCaption({ row, planId, currentUserId, onJump }: { row: ContenidoRow; planId?: number; currentUserId: string; onJump: () => void }) {
  const [album, setAlbum] = useState<"idle" | "saving" | "guardada" | "ya_estaba" | "error">("idle");
  const isVideo = Boolean(row.image_type?.startsWith("video/"));
  const url = row.image_url ?? "";

  const save = async () => {
    if (!planId || album === "saving") return;
    setAlbum("saving");
    try {
      setAlbum(await savePlanFotoFromChat({ planId, userId: currentUserId, url }));
    } catch (e) {
      logError("Error guardando en el álbum", e);
      setAlbum("error");
    }
  };

  return (
    <div className="flex flex-col items-center gap-[10px]">
      <p className="text-[14px] text-white/90">{row.sender_nombre} · {shortDate(row.created_at)}</p>
      <div className="flex flex-wrap items-center justify-center gap-[8px]">
        <LightboxAction onClick={onJump}>Ir al mensaje <ArrowRight className="size-[16px]" aria-hidden /></LightboxAction>
        <LightboxAction href={url} download="">
          <Download className="size-[16px]" aria-hidden /> Descargar
        </LightboxAction>
        {planId && !isVideo && (
          <LightboxAction onClick={() => void save()} disabled={album === "saving" || album === "guardada" || album === "ya_estaba"}>
            <ImagePlus className="size-[16px]" aria-hidden />
            {album === "saving" ? "Guardando…" : album === "guardada" ? "Guardada en el álbum" : album === "ya_estaba" ? "Ya está en el álbum" : "Guardar en el álbum del viaje"}
          </LightboxAction>
        )}
      </div>
      {album === "error" && (
        <p role="alert" className="text-[13px] text-[#ff8a80]">
          {typeof navigator !== "undefined" && !navigator.onLine ? "Sin conexión. No se ha guardado en el álbum." : "No se ha guardado en el álbum. Inténtalo de nuevo."}
        </p>
      )}
    </div>
  );
}

/**
 * A video in the grid: a still frame (never plays here: several moving at once weigh on a cheap
 * phone), ▶ in the middle and its length in a dark pill. Loads only when it comes into view.
 */
function VideoThumb({ url }: { url: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [near, setNear] = useState(false);
  const [length, setLength] = useState<string | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="block h-full w-full">
      {near && (
        <video
          src={`${url}#t=0.1`}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          aria-hidden
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setLength(`${Math.floor(d / 60)}:${String(Math.round(d % 60)).padStart(2, "0")}`);
          }}
          className="pointer-events-none h-full w-full object-cover"
        />
      )}
      <span aria-hidden className="absolute left-1/2 top-1/2 flex size-[32px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white">
        <Play className="ml-[2px] size-[16px] fill-current" />
      </span>
      {length && (
        <span aria-hidden className="absolute bottom-[4px] right-[4px] rounded-[4px] bg-black/65 px-[5px] py-[1px] text-[11px] font-[var(--fw-semibold)] tabular-nums leading-[16px] text-white">{length}</span>
      )}
    </span>
  );
}

/** «PDF», «DOC»… from the file name; «ARCHIVO» if it has none. */
function fileExt(name: string): string {
  const m = name.match(/\.([a-z0-9]{1,5})$/i);
  return m ? m[1].toUpperCase() : "ARCHIVO";
}

/** A long name cut in the middle keeping the end and the extension: «Billetes_Sin…_CP.pdf». */
function middleCut(name: string, max = 26): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  const base = ext ? name.slice(0, dot) : name;
  const room = max - ext.length - 1;
  const tail = Math.min(4, Math.floor(room / 3));
  return `${base.slice(0, room - tail)}…${base.slice(base.length - tail)}${ext}`;
}

/** «184 KB», «2,4 MB». */
function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

const URL_RE = /https?:\/\/[^\s<>"]+/i;

function linkParts(texto: string): { url: string; domain: string; title: string } | null {
  const m = texto.match(URL_RE);
  if (!m) return null;
  const url = m[0].replace(/[),.;:!?]+$/, "");
  let domain = url;
  let path = "";
  try {
    const u = new URL(url);
    domain = u.hostname.replace(/^www\./, "");
    path = decodeURIComponent(u.pathname).replace(/\/$/, "");
  } catch { /* not a valid URL: the raw text */ }
  // The words around the link name it; a bare link falls back to its last path piece.
  const around = texto.replace(m[0], " ").replace(/\s+/g, " ").trim().replace(/[\s:;,.\-–—]+$/, "");
  const last = path.split("/").filter(Boolean).pop()?.replace(/[-_]+/g, " ").replace(/\.\w+$/, "");
  return { url, domain, title: around || (last ? last.charAt(0).toUpperCase() + last.slice(1) : domain) };
}

function decisionText(m: Moment | null): { title: string; detail: string } | null {
  // Only what fn_momento_decidido counts as decided reaches here.
  if (m?.type === "hito_plan") return { title: m.titulo, detail: "Añadido al plan" };
  if (m?.type === "plan_creado") return { title: m.titulo, detail: "Plan creado" };
  if (m?.type === "propuesta") return { title: m.titulo, detail: m.detalle || "Propuesta aceptada" };
  if (m?.type === "poll") return { title: m.question, detail: "Encuesta cerrada" };
  return null;
}

function Row({ row, tipo, onJumpTo }: { row: ContenidoRow; tipo: ContenidoTipo; onJumpTo: (id: number) => void }) {
  const meta = `${row.sender_nombre} · ${shortDate(row.created_at)}`;
  const rowClass = "flex min-h-[56px] min-w-0 flex-1 items-center gap-[12px] rounded-[8px] py-[6px] pl-[8px] pr-[4px] text-left hover:bg-[var(--surface-2)]";
  const sideClass = "flex min-h-[44px] shrink-0 items-center rounded-[8px] px-[8px] text-[14px] font-[var(--fw-semibold)] text-[var(--chat-accent-text)] hover:bg-[var(--surface-2)]";

  if (tipo === "sitios") {
    const m = parseMoment(row.texto);
    if (m?.type !== "lugar") return null;
    return (
      <div className="flex items-center gap-[4px]">
        <button type="button" onClick={() => onJumpTo(row.id)} className={rowClass}>
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-2)] text-muted"><MapPin className="size-[18px]" aria-hidden /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-app">{m.nombre}</span>
            <span className="block truncate text-[12px] text-muted">{m.direccion || meta}</span>
          </span>
        </button>
        <a href={mapsUrl(m.lat, m.lng)} target="_blank" rel="noreferrer" aria-label={`Abrir ${m.nombre} en Mapas`} className={sideClass}>Mapas</a>
      </div>
    );
  }

  if (tipo === "archivos") {
    if (!row.document_url) return null;
    const name = row.document_name || "Documento";
    return (
      <div className="flex items-center gap-[4px]">
        <button type="button" onClick={() => onJumpTo(row.id)} title={name} className={rowClass}>
          <span aria-hidden className="flex h-[40px] w-[34px] shrink-0 items-end justify-center rounded-[6px] border border-app bg-[var(--surface-2)] pb-[5px] text-[9px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">
            {fileExt(name).slice(0, 4)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-app"><span className="sr-only">{name}</span><span aria-hidden>{middleCut(name)}</span></span>
            <span className="block truncate text-[12px] text-muted">{[meta, row.document_size ? fileSize(row.document_size) : null].filter(Boolean).join(" · ")}</span>
          </span>
        </button>
        <a href={row.document_url} target="_blank" rel="noreferrer" download={name} aria-label={`Descargar ${name}`} title="Descargar" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)] hover:text-app">
          <Download className="size-[18px]" aria-hidden />
        </a>
      </div>
    );
  }

  if (tipo === "enlaces") {
    const l = linkParts(row.texto);
    if (!l) return null;
    return (
      <div className="flex items-center gap-[4px]">
        <button type="button" onClick={() => onJumpTo(row.id)} className={rowClass}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] text-app">{l.title}</span>
            <span className="block truncate text-[12px] text-muted">{l.domain} · {meta}</span>
          </span>
        </button>
        <a href={l.url} target="_blank" rel="noreferrer" aria-label={`Abrir ${l.domain}`} title="Abrir el enlace" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-muted hover:bg-[var(--surface-2)] hover:text-app">
          <ExternalLink className="size-[18px]" aria-hidden />
        </a>
      </div>
    );
  }

  const d = decisionText(parseMoment(row.texto));
  if (!d) return null;
  return (
    <button type="button" onClick={() => onJumpTo(row.id)} className={`${rowClass} w-full`}>
      <span className="flex size-[34px] shrink-0 items-center justify-center">
        <span aria-hidden className="size-[10px] rotate-45 rounded-[2px] border-2 border-[var(--primary)] bg-[var(--primary)]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-app">{d.title}</span>
        <span className="block truncate text-[12px] text-muted">{d.detail} · {meta}</span>
      </span>
    </button>
  );
}
