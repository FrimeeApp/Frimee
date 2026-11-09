"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChevronDown, ChevronLeft, ChevronRight, LayoutGrid, Maximize2, Mic, MicOff, Minimize2,
  ScreenShare, ScreenShareOff, Signal, SignalLow, Video, VideoOff,
} from "lucide-react";
import type { CallMiembro } from "@/hooks/useCall";
import type { ParticipantTile } from "@/hooks/useLivekitRoom";
import { useCallRoom } from "@/providers/CallProvider";
import { useAuth } from "@/providers/AuthProvider";
import { CallAvatar, CallControl, CallDots, HangUpIcon, NO_POSTER } from "./ui";
import RoomTile, { trackKeyOf } from "./room/RoomTile";
import SelfView from "./room/SelfView";
import { firstName, gridShape, paginate, useElementSize } from "./room/layout";

type Props = {
  miembros: CallMiembro[];
  /** The other person (1:1) or the chat (group). */
  participanteNombre: string;
  tipo: "audio" | "video";
  isGroup: boolean;
  /** When the call was answered (ms since epoch), for the timer. */
  activeSince?: number | null;
  onMinimize?: () => void;
};

/** Controls hide after this long without touching the screen, in video. */
const CHROME_IDLE_MS = 4000;

/**
 * The room (boards M6–M12, D6–D11, M18a, D18a). Always dark. On desktop it leaves the app's side
 * menu visible; going to another page minimizes it. The connection lives in CallProvider
 * (useCallRoom), so this is only the view.
 */
export default function CallRoom({ miembros, participanteNombre, tipo, isGroup, activeSince, onMinimize }: Props) {
  const room = useCallRoom();
  const { tiles, speaking, unstable, reconnecting, micEnabled, cameraEnabled, screenSharing, attachTrack } = room;
  const { profile } = useAuth();
  const [stageRef, stage] = useElementSize<HTMLDivElement>();
  const [contentRef, content] = useElementSize<HTMLDivElement>();
  const mobile = stage.width > 0 && stage.width < 768;

  const [focusId, setFocusId] = useState<string | null>(null);
  const [gridOverride, setGridOverride] = useState(false);
  const [page, setPage] = useState(0);
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const shareRef = useRef<HTMLDivElement | null>(null);

  // ── Who is who ──
  const me = { id: profile?.id ?? "me", nombre: profile?.nombre ?? "Tú", foto: profile?.profile_image ?? undefined };
  const miembro = (identity: string) => miembros.find((m) => m.id === identity);
  const nameOf = (tile: ParticipantTile) => {
    if (tile.isScreenShare) return tile.isLocal ? "Tu pantalla" : `Pantalla de ${firstName(miembro(tile.identity)?.nombre ?? "Participante")}`;
    return tile.isLocal ? "Tú" : miembro(tile.identity)?.nombre ?? (isGroup ? "Participante" : participanteNombre);
  };
  const cameraTiles = [...tiles.filter((t) => !t.isScreenShare && !t.isLocal), ...tiles.filter((t) => !t.isScreenShare && t.isLocal)];
  const shareTile = tiles.find((t) => t.isScreenShare) ?? null;
  const remote = cameraTiles.find((t) => !t.isLocal) ?? null;
  const remoteName = remote ? nameOf(remote) : participanteNombre;
  const anyCameraOn = cameraTiles.some((t) => !t.videoMuted);
  const othersSharing = shareTile && !shareTile.isLocal ? firstName(miembro(shareTile.identity)?.nombre ?? "Alguien") : null;

  // ── Layout ──
  const focusTile = focusId ? tiles.find((t) => t.id === focusId) ?? null : null;
  const mainShare = shareTile && !gridOverride ? shareTile : null;
  const mode: "voice" | "one" | "focus" | "grid" =
    mainShare || (focusTile && isGroup) ? "focus"
      : !isGroup && cameraTiles.length <= 2 ? (tipo === "audio" && !anyCameraOn ? "voice" : "one")
        : "grid";
  const mainTile = mode === "focus" ? mainShare ?? focusTile : null;
  const strip = mode === "focus" ? cameraTiles.filter((t) => t.id !== mainTile?.id) : [];
  const gridTiles = gridOverride && shareTile ? [shareTile, ...cameraTiles] : cameraTiles;
  const pages = paginate(gridTiles);
  const currentPage = Math.min(page, pages.length - 1);

  // ── Controls that fade away in video ──
  const autoHide = (mode === "one" && anyCameraOn) && !reconnecting;
  const [idle, setIdle] = useState(false);
  const [wakeCount, setWakeCount] = useState(0);
  const [hint, setHint] = useState(false);
  const hintSeen = useRef(false);
  useEffect(() => {
    if (!autoHide) return;
    const t = setTimeout(() => {
      setIdle(true);
      if (mobile && !hintSeen.current) {
        hintSeen.current = true;
        setHint(true);
        setTimeout(() => setHint(false), 3000);
      }
    }, CHROME_IDLE_MS);
    return () => clearTimeout(t);
  }, [autoHide, wakeCount, mobile]);
  const chromeHidden = autoHide && idle;
  const wake = () => {
    if (idle) setIdle(false);
    setWakeCount((n) => n + 1);
  };

  // Desktop shortcuts: M micro, V camera, Ctrl/Cmd+E share, Esc back to the grid.
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      const r = roomRef.current;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") { e.preventDefault(); void r.toggleScreenShare(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") void r.toggleMute();
      else if (e.key === "v" || e.key === "V") void r.toggleVideo();
      else if (e.key === "Escape") setFocusId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Going to another page from the side menu minimizes the call.
  const pathname = usePathname();
  const firstPath = useRef(pathname);
  useEffect(() => {
    if (pathname !== firstPath.current) {
      firstPath.current = pathname;
      onMinimize?.();
    }
  }, [pathname, onMinimize]);

  // ── Header ──
  const dot = <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: reconnecting ? "var(--stage-warn)" : "var(--stage-speaking)" }} />;
  const timer = activeSince ? <CallTimer since={activeSince} /> : null;
  const title = mode === "voice" ? "Llamada de voz" : isGroup ? participanteNombre : remoteName;
  const subtitle = reconnecting ? <span style={{ color: "var(--stage-warn)" }}>Reconectando…</span>
    : mode === "voice" ? "En llamada"
      : isGroup ? <>{cameraTiles.length} personas{timer && <> · {timer}</>}</>
        : timer;
  const headerRight = (() => {
    if (mode === "focus" && focusTile && !mainShare) {
      return mobile ? (
        <CallControl kind="plain" small ariaLabel="Volver a la cuadrícula" onClick={() => setFocusId(null)}><LayoutGrid className="size-5" aria-hidden /></CallControl>
      ) : (
        <button type="button" onClick={() => setFocusId(null)} className="flex h-11 items-center gap-2 rounded-lg bg-[var(--stage-control)] px-4 text-[14px] font-semibold text-white hover:bg-[var(--stage-control-hover)]">
          <LayoutGrid className="size-4" aria-hidden /> Volver a la cuadrícula
        </button>
      );
    }
    if (shareTile && !mobile) {
      return (
        <CallControl kind="stage" small ariaLabel={gridOverride ? "Ver la pantalla compartida" : "Ver en cuadrícula"} pressed={gridOverride} onClick={() => setGridOverride((v) => !v)}>
          <LayoutGrid className="size-5" aria-hidden />
        </CallControl>
      );
    }
    if (mode === "grid" && pages.length > 1 && !mobile) {
      return <span className="call-num text-[13px] text-[var(--stage-text-2)]">Página {currentPage + 1} de {pages.length}</span>;
    }
    return null;
  })();

  // ── Sizes ──
  const headerH = mobile ? 56 : 64;
  const barBottom = mobile ? 16 : 24;
  const barH = 88;
  const contentTop = headerH;
  const contentBottom = barBottom + barH + (mobile ? 16 : 12);
  const pad = mobile ? 8 : 24;
  const gap = mobile ? 8 : 12;
  const fullBleed = mode === "one";
  const landscape = content.width > content.height;

  const tileFor = (t: ParticipantTile, extra?: { className?: string; style?: React.CSSProperties; pinned?: boolean; select?: boolean }) => (
    <RoomTile
      key={t.id}
      tile={t}
      nombre={nameOf(t)}
      avatarNombre={t.isLocal ? me.nombre : undefined}
      foto={t.isLocal ? me.foto : miembro(t.identity)?.foto}
      speaking={!t.isScreenShare && speaking.has(t.identity) && !t.audioMuted}
      unstable={!t.isScreenShare && unstable.has(t.identity)}
      pinned={extra?.pinned}
      attach={attachTrack}
      onSelect={extra?.select === false ? undefined : () => setFocusId((id) => (id === t.id ? null : t.id))}
      className={extra?.className}
      style={extra?.style}
    />
  );

  return (
    <div
      ref={stageRef}
      role="dialog"
      aria-label={`Llamada con ${title}`}
      className="call-stage fixed inset-0 z-[60] overflow-hidden md:left-[102px]"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      onPointerMove={autoHide ? wake : undefined}
      onPointerDown={autoHide ? wake : undefined}
      onKeyDown={autoHide ? wake : undefined}
    >
      <div className="relative size-full">
        {/* ── Content ── */}
        <div
          ref={contentRef}
          className={`absolute ${reconnecting ? "call-dim" : ""}`}
          style={fullBleed ? { inset: 0 } : { top: contentTop, bottom: contentBottom, left: pad, right: pad }}
        >
          {mode === "voice" && (
            <div className="flex size-full flex-col items-center justify-center text-center">
              <div className="call-voice-av" data-speaking={remote && speaking.has(remote.identity) && !remote.audioMuted ? "true" : "false"}>
                <CallAvatar id={remote?.identity ?? participanteNombre} nombre={remoteName} foto={remote ? miembro(remote.identity)?.foto : undefined} size={mobile ? 168 : 200} />
              </div>
              <h2 className="call-serif m-0 mt-8 text-[40px] leading-[1.1] md:text-[48px]">{remoteName}</h2>
              {timer && <p className="call-num m-0 mt-2 text-[17px] text-[var(--stage-text-2)]">{timer}</p>}
              <ConnectionLine bad={remote ? unstable.has(remote.identity) : false} />
              {mobile && remote && speaking.has(remote.identity) && !remote.audioMuted && (
                <span className="call-tag call-tag-inline mt-4">{firstName(remoteName)} está hablando</span>
              )}
            </div>
          )}

          {mode === "one" && (
            <>
              {remote && !remote.videoMuted ? (
                <div className="absolute inset-0" onClick={() => mobile && (chromeHidden ? wake() : setIdle(true))}>
                  <video data-tile={remote.id} poster={NO_POSTER} autoPlay playsInline muted ref={(el) => attachTrack(trackKeyOf(remote), el)} className="absolute inset-0 size-full object-cover" />
                  {unstable.has(remote.identity) && (
                    <span className="call-tag call-tag-warn absolute left-4" style={{ top: headerH + 8 }}>
                      <SignalLow className="size-3.5" aria-hidden /><span>Conexión inestable</span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex size-full flex-col items-center justify-center text-center" style={{ paddingBottom: contentBottom - contentTop }}>
                  <CallAvatar id={remote?.identity ?? participanteNombre} nombre={remoteName} foto={remote ? miembro(remote.identity)?.foto : undefined} size={mobile ? 140 : 160} />
                  <h2 className="call-serif m-0 mt-6 text-[36px] leading-[1.1]">{remoteName}</h2>
                  <span className="call-tag call-tag-inline mt-4"><VideoOff className="size-3.5" aria-hidden /><span>Cámara apagada</span></span>
                </div>
              )}
              <SelfView
                stage={stage}
                insets={{ top: headerH + 16, bottom: contentBottom, side: 16 }}
                mobile={mobile}
                cameraOn={cameraEnabled}
                micOn={micEnabled}
                userId={me.id}
                userName={me.nombre}
                userFoto={me.foto}
                canFlip={room.canFlipCamera}
                flipping={room.flippingCamera}
                onFlip={() => void room.flipCamera()}
                attach={attachTrack}
              />
            </>
          )}

          {mode === "grid" && (
            <div className="relative size-full">
              <div
                ref={pagesRef}
                className="call-pages size-full"
                style={{ height: pages.length > 1 && mobile ? "calc(100% - 20px)" : "100%" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
                }}
              >
                {pages.map((pageTiles, i) => {
                  const shape = gridShape(pageTiles.length, landscape);
                  return (
                    <div
                      key={i}
                      className="grid size-full"
                      style={{
                        gap,
                        padding: !mobile && pages.length > 1 ? "0 60px" : undefined,
                        gridTemplateColumns: `repeat(${shape.cols}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${shape.rows}, minmax(0, 1fr))`,
                      }}
                    >
                      {pageTiles.map((t) => tileFor(t))}
                    </div>
                  );
                })}
              </div>
              {pages.length > 1 && mobile && (
                <div className="absolute inset-x-0 bottom-0 flex h-5 items-center justify-center gap-1.5" aria-label={`Página ${currentPage + 1} de ${pages.length}`}>
                  {pages.map((_, i) => (
                    <span key={i} aria-hidden className="h-1.5 rounded-full transition-all" style={{ width: i === currentPage ? 16 : 6, background: i === currentPage ? "#fff" : "rgba(255,255,255,0.3)" }} />
                  ))}
                </div>
              )}
              {pages.length > 1 && !mobile && (
                <>
                  <PageArrow side="left" disabled={currentPage === 0} onClick={() => pagesRef.current?.scrollTo({ left: (currentPage - 1) * (pagesRef.current?.clientWidth ?? 0), behavior: "smooth" })} />
                  <PageArrow side="right" disabled={currentPage === pages.length - 1} onClick={() => pagesRef.current?.scrollTo({ left: (currentPage + 1) * (pagesRef.current?.clientWidth ?? 0), behavior: "smooth" })} />
                </>
              )}
            </div>
          )}

          {mode === "focus" && mainTile && (
            <div className={`flex size-full ${mobile ? "flex-col" : "flex-row"}`} style={{ gap }}>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ gap }}>
                {mainTile.isScreenShare && mainTile.isLocal ? (
                  <>
                    <div className="flex h-14 shrink-0 items-center gap-3 rounded-lg border border-[var(--stage-speaking)] px-4">
                      <ScreenShare className="size-5 text-[var(--stage-speaking)]" aria-hidden />
                      <span className="flex-1 text-[14px] font-semibold">Estás compartiendo tu pantalla</span>
                      <button type="button" onClick={() => void room.toggleScreenShare()} className="flex h-10 items-center gap-2 rounded-lg bg-[var(--stage-control-off)] px-4 text-[14px] font-semibold text-[var(--stage-control-off-icon)]">
                        <ScreenShareOff className="size-4" aria-hidden /> Dejar de compartir
                      </button>
                    </div>
                    <div className="call-tile flex flex-1 flex-col items-center justify-center p-6 text-center">
                      <div className="relative aspect-[16/10] w-[320px] max-w-full overflow-hidden rounded-lg bg-black">
                        <video data-tile={mainTile.id} poster={NO_POSTER} autoPlay playsInline muted ref={(el) => attachTrack(trackKeyOf(mainTile), el)} className="absolute inset-0 size-full object-contain" />
                      </div>
                      <p className="m-0 mt-5 text-[17px] font-semibold">Los demás están viendo tu pantalla</p>
                      <p className="m-0 mt-1 text-[14px] text-[var(--stage-text-2)]">Aquí la verás en pequeño para evitar el efecto espejo.</p>
                    </div>
                  </>
                ) : mainTile.isScreenShare && mobile ? (
                  <div className="flex flex-col items-center gap-3 pt-6">
                    <div ref={shareRef} className="relative aspect-video w-full">
                      {tileFor(mainTile, { className: "size-full", select: false })}
                      <div className="absolute right-2 top-2">
                        <CallControl kind="ghost" small ariaLabel="Ver la pantalla más grande" onClick={() => void shareRef.current?.requestFullscreen?.().catch(() => {})}>
                          <Maximize2 className="size-5" aria-hidden />
                        </CallControl>
                      </div>
                    </div>
                    <p className="m-0 text-center text-[13px] text-[var(--stage-text-2)]">Gira el móvil o toca la pantalla para verla más grande</p>
                  </div>
                ) : (
                  tileFor(mainTile, { className: "flex-1", pinned: !mainTile.isScreenShare, select: !mainTile.isScreenShare })
                )}
              </div>
              {strip.length > 0 && (
                <div
                  className={`call-strip flex shrink-0 ${mobile ? "mt-auto flex-row overflow-x-auto" : "w-[240px] flex-col overflow-y-auto"}`}
                  style={{ gap }}
                >
                  {strip.map((t) => tileFor(t, { className: "shrink-0", style: mobile ? { width: 104, height: 128 } : { width: 240, height: 135 } }))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Header ── */}
        <div
          className="call-chrome call-chrome-top absolute inset-x-0 top-0 z-[4] flex items-center"
          data-hidden={chromeHidden ? "true" : "false"}
          style={{ height: headerH, padding: mobile ? "0 8px" : "0 24px", background: fullBleed ? "var(--stage-veil)" : undefined }}
        >
          {mobile ? (
            <>
              <div className="w-11">
                {onMinimize && (
                  <CallControl kind={fullBleed ? "ghost" : "plain"} small ariaLabel="Minimizar llamada" onClick={onMinimize}>
                    <ChevronDown className="size-6" aria-hidden />
                  </CallControl>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                <span className="max-w-full truncate text-[15px] font-semibold">{title}</span>
                <span className="call-num flex items-center gap-1.5 text-[13px] text-[var(--stage-text-2)]">{dot}{subtitle}</span>
              </div>
              <div className="flex w-11 justify-end">{headerRight}</div>
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold">{title}</span>
                <span className="call-num flex items-center gap-1.5 text-[13px] text-[var(--stage-text-2)]">{dot}{subtitle}</span>
              </div>
              {headerRight}
            </>
          )}
        </div>

        {/* ── Controls ── */}
        <div
          className="call-chrome call-chrome-bottom absolute inset-x-0 z-[4] flex justify-center"
          data-hidden={chromeHidden ? "true" : "false"}
          style={{ bottom: `calc(env(safe-area-inset-bottom) + ${barBottom}px)` }}
        >
          <div className="call-bar" role="toolbar" aria-label="Controles de la llamada">
            <CallControl kind={micEnabled ? "stage" : "off"} ariaLabel={micEnabled ? "Silenciar micro" : "Activar micro"} pressed={!micEnabled} onClick={() => void room.toggleMute()}>
              {micEnabled ? <Mic className="size-6" aria-hidden /> : <MicOff className="size-6" aria-hidden />}
            </CallControl>
            <CallControl
              kind={cameraEnabled || tipo === "audio" ? "stage" : "off"}
              ariaLabel={cameraEnabled ? "Apagar cámara" : "Activar cámara"}
              pressed={cameraEnabled}
              onClick={() => void room.toggleVideo()}
            >
              {cameraEnabled || tipo === "audio" ? <Video className="size-6" aria-hidden /> : <VideoOff className="size-6" aria-hidden />}
            </CallControl>
            {!mobile && (
              <>
                <CallControl
                  kind={screenSharing ? "on" : "stage"}
                  ariaLabel={screenSharing ? "Dejar de compartir pantalla" : "Compartir pantalla"}
                  tip={othersSharing ? `${othersSharing} ya está compartiendo` : undefined}
                  pressed={screenSharing}
                  disabled={!!othersSharing}
                  onClick={() => void room.toggleScreenShare()}
                >
                  <ScreenShare className="size-6" aria-hidden />
                </CallControl>
                {onMinimize && (
                  <CallControl ariaLabel="Minimizar llamada" tip="Minimizar" onClick={onMinimize}>
                    <Minimize2 className="size-6" aria-hidden />
                  </CallControl>
                )}
                <span className="call-bar-sep" aria-hidden />
              </>
            )}
            <CallControl kind="hang" ariaLabel="Colgar" onClick={room.disconnect}>
              <HangUpIcon size={28} />
            </CallControl>
          </div>
        </div>

        {hint && (
          <div role="status" className="absolute inset-x-0 z-[5] flex justify-center" style={{ top: 16 }}>
            <span className="rounded-lg bg-[var(--stage-tile)] px-3 py-2 text-[14px] font-semibold">Toca la pantalla para ver los controles</span>
          </div>
        )}

        {reconnecting && (
          <div className="absolute inset-0 z-[5] flex items-center justify-center" role="alert">
            <div className="call-reconnect">
              <span className="inline-flex text-[var(--stage-warn)]"><CallDots /></span>
              <p className="m-0 mt-3 text-[17px] font-semibold">Reconectando...</p>
              <p className="m-0 mt-1 text-[14px] text-[var(--stage-text-2)]">Se ha caído la conexión. Seguimos intentándolo.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionLine({ bad }: { bad: boolean }) {
  return (
    <p className="m-0 mt-3 flex items-center gap-2 text-[14px] text-[var(--stage-text-2)]">
      {bad ? <SignalLow className="size-4 text-[var(--stage-warn)]" aria-hidden /> : <Signal className="size-4 text-[var(--stage-speaking)]" aria-hidden />}
      {bad ? "Conexión inestable" : "Conexión estable"}
    </p>
  );
}

function PageArrow({ side, disabled, onClick }: { side: "left" | "right"; disabled: boolean; onClick: () => void }) {
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-0" : "right-0"}`}>
      <CallControl small ariaLabel={side === "left" ? "Página anterior" : "Página siguiente"} disabled={disabled} onClick={onClick}>
        {side === "left" ? <ChevronLeft className="size-5" aria-hidden /> : <ChevronRight className="size-5" aria-hidden />}
      </CallControl>
    </div>
  );
}

/** Call time since it was answered. Its own component: ticking every second must not redraw the room. */
function CallTimer({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const total = Math.max(0, Math.floor((now - since) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const sec = (total % 60).toString().padStart(2, "0");
  return <>{h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`}</>;
}
