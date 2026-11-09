"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Lock, MicOff, Phone, RefreshCw, Settings, VideoOff } from "lucide-react";
import { openAppSettings } from "@/services/native/appSettings";

/**
 * The microphone or the camera was refused (boards M17a, M17b, D17). Web: how to allow it
 * from the address bar, then "Reintentar". Android app: "Abrir ajustes"; coming back to the app
 * tries again by itself. Phones: bottom sheet. Desktop: dialog.
 * The microphone is needed to call ("Ahora no" hangs up); without the camera the call goes on
 * with voice only.
 */
export default function PermissionSheet({ kind, tipo, onRetry, onDismiss }: {
  kind: "mic" | "camera";
  tipo: "audio" | "video";
  onRetry: () => void;
  /** Mic: hang up. Camera: go on with voice only. */
  onDismiss: () => void;
}) {
  const native = Capacitor.isNativePlatform();
  const [host] = useState(() => (typeof window !== "undefined" ? window.location.host : "frimee.es"));
  const mic = kind === "mic";

  // Back from Android's settings: try again.
  useEffect(() => {
    if (!native) return;
    const sub = App.addListener("resume", () => onRetry());
    return () => { void sub.then((s) => s.remove()); };
  }, [native, onRetry]);

  const title = native
    ? mic ? "Frimee no puede usar el micrófono" : "Frimee no puede usar la cámara"
    : mic ? "Activa el micrófono para llamar" : "Activa la cámara para la videollamada";
  const text = native
    ? mic ? "Dale permiso en los ajustes de Android para hacer llamadas." : "Dale permiso en los ajustes de Android para hacer videollamadas."
    : mic ? `Has bloqueado el micrófono para ${host} en este navegador.` : `Has bloqueado la cámara para ${host} en este navegador.`;
  const device = mic ? "Micrófono" : "Cámara";

  const stepsNative = [
    <>Toca <b>Abrir ajustes</b>.</>,
    <>Entra en <b>Permisos</b> › <b>{device}</b>.</>,
    <>Elige <b>Permitir solo mientras se usa la app</b>.</>,
  ];
  const stepsPhone = [
    <>Toca el icono que hay junto a la dirección.</>,
    <>Entra en <b>Permisos</b>.</>,
    <>Activa <b>{device}</b> y vuelve aquí.</>,
  ];
  const stepsDesktop = [
    <>Haz clic en el icono a la izquierda de la dirección.</>,
    mic ? <>En <b>Micrófono</b>{tipo === "video" && <> (y <b>Cámara</b> si es videollamada)</>}, elige <b>Permitir</b>.</> : <>En <b>Cámara</b>, elige <b>Permitir</b>.</>,
    <>Vuelve aquí y pulsa <b>Reintentar</b>. En Safari: Safari › Ajustes para este sitio web.</>,
  ];

  const Icon = mic ? MicOff : VideoOff;
  const steps = (list: React.ReactNode[]) => (
    <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0 text-left">
      {list.map((step, i) => (
        <li key={i} className="flex items-start gap-3 text-[14px] leading-[1.45] text-[var(--text-primary)]">
          <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--call-btn-neutral)] text-[12px] font-semibold">{i + 1}</span>
          <span className="pt-px">{step}</span>
        </li>
      ))}
    </ol>
  );
  const addressBar = (
    <div aria-hidden className="mt-4 flex h-10 items-center gap-2 rounded-full bg-[var(--call-btn-neutral)] pr-4 text-[14px] text-[var(--text-secondary)]">
      <span className="flex size-10 items-center justify-center rounded-full border-2 border-[var(--call-accent-text)] text-[var(--call-accent-text)]"><Lock className="size-4" /></span>
      {host}
    </div>
  );
  const primary = "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--call-btn-fill)] text-[15px] font-semibold text-[var(--call-btn-fill-text)]";
  const neutral = "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--call-btn-neutral)] text-[15px] font-semibold text-[var(--text-primary)]";
  const dismissLabel = mic ? "Ahora no" : "Seguir solo con voz";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-[var(--call-scrim)] md:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="call-permission-title"
        aria-describedby="call-permission-text"
        className="call-enter w-full rounded-t-2xl bg-[var(--surface)] px-5 pt-2 text-[var(--text-primary)] md:w-[480px] md:rounded-lg md:border md:border-[var(--call-border)] md:p-7"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 20px)" }}
      >
        <div aria-hidden className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--call-border)] md:hidden" />

        {/* Phones (web and app): centred sheet. */}
        <div className="flex flex-col items-center text-center md:hidden">
          <div aria-hidden className="flex size-14 items-center justify-center rounded-full bg-[var(--call-btn-neutral)]"><Icon className="size-6" /></div>
          <h2 id="call-permission-title" className="m-0 mt-4 text-[19px] font-semibold">{title}</h2>
          <p id="call-permission-text" className="m-0 mt-1.5 text-[14px] leading-[1.45] text-[var(--text-secondary)]">{text}</p>
          {!native && <div className="w-full">{addressBar}</div>}
          <div className="w-full">{steps(native ? stepsNative : stepsPhone)}</div>
          <div className="mt-6 flex w-full flex-col gap-2">
            {native ? (
              <button type="button" className={primary} onClick={() => void openAppSettings()}><Settings className="size-4" aria-hidden />Abrir ajustes</button>
            ) : (
              <button type="button" className={primary} onClick={onRetry}>Ya lo he activado</button>
            )}
            <button type="button" className={neutral} onClick={onDismiss}>{!mic && <Phone className="size-4" aria-hidden />}{dismissLabel}</button>
          </div>
        </div>

        {/* Desktop: dialog with the icon on the left (D17). */}
        <div className="hidden md:block">
          <div className="flex items-start gap-4">
            <div aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--call-btn-neutral)]"><Icon className="size-5" /></div>
            <div>
              <h2 className="m-0 text-[19px] font-semibold">{title}</h2>
              <p className="m-0 mt-1 text-[14px] leading-[1.45] text-[var(--text-secondary)]">{text}</p>
            </div>
          </div>
          {addressBar}
          {steps(stepsDesktop)}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className={`${neutral} w-auto px-4`} onClick={onDismiss}>{dismissLabel}</button>
            <button type="button" className={`${primary} w-auto px-4`} onClick={onRetry}><RefreshCw className="size-4" aria-hidden />Reintentar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
