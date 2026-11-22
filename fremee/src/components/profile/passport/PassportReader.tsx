"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { ChevronLeft, List, MoreHorizontal } from "lucide-react";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { FOCUS } from "@/components/plans/home/pieces";
import { isInViewport, playClose, prefersReducedMotion } from "@/lib/passportOpen";
import { buildPages, groupTrips, type PasaporteAjustes, type Sello } from "@/lib/passport";
import { fetchCiudadBase, ocultarSello } from "@/services/api/endpoints/pasaporte.endpoint";
import PassportIndex, { type Tab as IndexTab } from "./PassportIndex";
import PassportPrivacySheet from "./PassportPrivacySheet";
import StampPopover from "./StampPopover";
import Libreta, { type LibretaIntro, type LibretaOutro } from "./Libreta";

/**
 * El pasaporte abierto, como capa a pantalla completa. Desde el perfil se monta encima de él (así la tapa puede volar
 * desde su sitio); con un enlace directo no hay tapa de origen y solo hay un fundido corto.
 */
export default function PassportReader({
  nombre,
  sellos: sellosIniciales,
  ajustes: ajustesIniciales = null,
  userId,
  ciudadDe,
  onAjustesChange,
  readOnly = false,
  title = "Pasaporte",
  fromCover = null,
  profile = null,
  closing = false,
  startPage,
  onRequestClose,
  onClosed,
}: {
  nombre: string;
  sellos: Sello[];
  /** Quién ve tu pasaporte (los lee el perfil junto con los sellos). */
  ajustes?: PasaporteAjustes | null;
  userId?: string;
  /** De quién es la ciudad base que se enseña en la página de datos (por defecto, la propia). */
  ciudadDe?: string;
  onAjustesChange?: (a: PasaporteAjustes) => void;
  /** El pasaporte de otra persona: sin ajustes, sin ocultos y sin acciones sobre los sellos. */
  readOnly?: boolean;
  title?: string;
  /** La tapa pequeña del perfil desde la que se abre; sin ella no hay vuelo. */
  fromCover?: HTMLElement | null;
  /** Capa del perfil que se funde al abrir y vuelve al cerrar. */
  profile?: HTMLElement | null;
  closing?: boolean;
  /** Página (desde 1) por la que se abre el libro. */
  startPage?: number;
  onRequestClose: () => void;
  onClosed?: () => void;
}) {
  const router = useRouter();
  const [example, setExample] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const openExample = async () => {
    setExample({ loading: true, error: null });
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc("fn_guest_seed_demo");
      if (error) throw error;
      router.push(Capacitor.isNativePlatform() ? `/plans/static?id=${data as number}` : `/plans/${data as number}`);
    } catch (e) {
      console.error("[pasaporte] ejemplo:", e instanceof Error ? e.message : e);
      setExample({ loading: false, error: "No se ha podido abrir el ejemplo. Vuelve a intentarlo." });
    }
  };
  const emptyPage = !readOnly && !sellosIniciales.some((s) => !s.hidden)
    ? { onCreate: () => router.push("/calendar?create=1"), onExample: () => void openExample(), exampleLoading: example.loading, exampleError: example.error }
    : null;
  const rootRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [reduced] = useState(prefersReducedMotion);
  // Ocultar un sello o decir «no fui» cambia el pasaporte al momento, sin volver a leerlo.
  const [sellos, setSellos] = useState(sellosIniciales);
  const [sheet, setSheet] = useState<{ sello: Sello; el: HTMLElement } | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  const [indexTab, setIndexTab] = useState<IndexTab>("paises");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  // «Ver tu pasaporte como lo ven los demás»: el pasaporte tal como lo ven los demás (sin ocultos y, si lo quitaste, sin sellos de plan).
  const [preview, setPreview] = useState(false);
  const [ajustes, setAjustes] = useState(ajustesIniciales);
  const [ciudad, setCiudad] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchCiudadBase(ciudadDe).then((c) => { if (!cancelled) setCiudad(c); }).catch(() => {});
    return () => { cancelled = true; };
  }, [ciudadDe]);
  const [jump, setJump] = useState<{ page: number; nonce: number } | null>(null);
  const pages = useMemo(() => buildPages(groupTrips(sellos)), [sellos]);
  const hasStamps = sellos.some((s) => !s.hidden);
  const flight = Boolean(fromCover) && !reduced;

  const intro = useMemo<LibretaIntro | undefined>(
    () => (flight && fromCover ? { fromCover, profile, deskRef, chromeRefs: [titleRef] } : undefined),
    [flight, fromCover, profile],
  );

  // Sin vuelo (enlace directo o movimiento reducido): el lector aparece con un fundido de 160 ms.
  useLayoutEffect(() => {
    if (flight) return;
    rootRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "linear" });
  }, [flight]);

  // Al volver al perfil (botón o gesto de atrás) con su tapa a la vista, la libreta se cierra y vuela hasta ella;
  // si no, un fundido corto.
  const cancelRef = useRef<(() => void) | null>(null);
  const outro = useMemo<LibretaOutro | null>(
    () =>
      closing && !reduced && fromCover && isInViewport(fromCover)
        ? { fromCover, profile, deskRef, chromeRefs: [titleRef], registerCancel: (c) => { cancelRef.current = c; }, onDone: () => onClosed?.() }
        : null,
    [closing, reduced, fromCover, profile, onClosed],
  );
  useEffect(() => {
    if (!closing || !rootRef.current || outro) return;
    void playClose(rootRef.current, profile).then(() => onClosed?.());
  }, [closing, outro, profile, onClosed]);
  // Tocar o pulsar una tecla durante el cierre salta al final: nunca hace esperar.
  useEffect(() => {
    if (!closing) return;
    const skip = () => cancelRef.current?.();
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [closing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || closing) return;
      // Esc cierra primero el índice y luego el pasaporte.
      // La hoja de privacidad es un portal propio: su Esc lo gestiona ella.
      if (privacyOpen) setPrivacyOpen(false);
      else if (sheet) setSheet(null);
      else if (indexOpen) setIndexOpen(false);
      else onRequestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onRequestClose, indexOpen, sheet, privacyOpen, closing]);

  return (
    <div ref={rootRef} role="dialog" aria-modal="true" aria-label="Pasaporte" className="fixed inset-0 z-[1050] h-dvh overflow-y-auto text-app">
      <div ref={deskRef} aria-hidden="true" className="fixed inset-0 bg-[var(--passport-table)]" />
      <div className="relative px-safe pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-mobile-safe-top md:px-8 md:py-[var(--space-8)]">
        <div ref={titleRef} className="mx-auto flex w-full max-w-[460px] items-center gap-1 pb-2 md:max-w-[1080px]">
          <button type="button" onClick={onRequestClose} aria-label="Volver al perfil" className={`inline-flex min-h-11 items-center gap-0.5 rounded-[8px] pl-1 pr-3 text-[16px] font-[var(--fw-semibold)] text-app ${FOCUS}`}>
            <ChevronLeft className="size-[22px]" aria-hidden />
            Perfil
          </button>
          <h1 className="sr-only">{title}</h1>
          <div className="flex-1" />
          {hasStamps && (
            <button type="button" onClick={() => { setIndexTab("paises"); setIndexOpen(true); }} aria-label="Índice del pasaporte" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
              <List className="size-[22px]" aria-hidden />
            </button>
          )}
          {!readOnly && (
          <button type="button" onClick={() => setPrivacyOpen(true)} aria-label="Más opciones" className={`inline-flex size-11 items-center justify-center rounded-[8px] text-app ${FOCUS}`}>
            <MoreHorizontal className="size-[22px]" aria-hidden />
          </button>
          )}
        </div>
        {preview ? (
          <>
            <div role="status" className="mx-auto mb-3 flex w-full max-w-[460px] items-center gap-3 rounded-[8px] border border-app bg-surface px-3 py-2 md:max-w-[1080px]">
              <span className="flex-1 text-[14px] leading-[1.5]">{ajustes?.passport_visibility === "TODOS" ? "Así ve tu pasaporte cualquiera en Frimee." : "Así ven tu pasaporte tus amistades."}</span>
              <button
                type="button"
                onClick={() => {
                  // Mirar, cambiar algo y volver a mirar: se vuelve al diálogo de privacidad, no al lector.
                  setPreview(false);
                  setPrivacyOpen(true);
                }}
                className={`min-h-11 px-2 text-[14px] font-[var(--fw-semibold)] text-[var(--primary)] ${FOCUS}`}>
                Salir de la vista previa
              </button>
            </div>
            <Libreta key="preview" outro={outro} nombre={nombre} ciudad={ciudad} sellos={sellos.filter((x) => !x.hidden && ((ajustes?.show_plan_stamps ?? true) || x.kind === "pais"))} />
          </>
        ) : (
          <Libreta outro={outro} nombre={nombre} ciudad={ciudad} emptyPage={emptyPage} sellos={sellos} intro={intro} jumpTo={jump} startPage={startPage} onOpenStamp={readOnly ? undefined : (sello, el) => setSheet({ sello, el })} />
        )}
        {privacyOpen && (
          <PassportPrivacySheet
            ajustes={ajustes}
            hiddenCount={sellos.filter((x) => x.hidden && x.kind === "plan").length}
            shareUrl={userId && typeof window !== "undefined" ? `${window.location.origin}/profile/${userId}` : undefined}
            onChange={(a) => {
              setAjustes(a);
              onAjustesChange?.(a);
            }}
            onOpenHidden={() => {
              setPrivacyOpen(false);
              setIndexTab("ocultos");
              setIndexOpen(true);
            }}
            onPreview={() => {
              setPrivacyOpen(false);
              setSheet(null);
              setPreview(true);
            }}
            onClose={() => setPrivacyOpen(false)}
          />
        )}
        {indexOpen && (
          <PassportIndex
            initialTab={indexTab}
            sellos={sellos}
            pages={pages}
            onClose={() => setIndexOpen(false)}
            onRestore={readOnly ? undefined : async (s) => {
              await Promise.all(sellos.filter((x) => x.plan_id === s.plan_id && x.hidden).map((x) => ocultarSello(x.id, false)));
              setSellos((all) => all.map((x) => (x.plan_id === s.plan_id ? { ...x, hidden: false } : x)));
            }}
            onPick={(page) => {
              setIndexOpen(false);
              setJump((j) => ({ page, nonce: (j?.nonce ?? 0) + 1 }));
            }}
          />
        )}
        {sheet && (
          <StampPopover
            sello={sheet.sello}
            anchor={sheet.el}
            sellos={sellos}
            onClose={() => setSheet(null)}
            // Ocultar un sello oculta su viaje entero: plan, países y hitos.
            onHide={async (planId) => {
              await Promise.all(sellos.filter((x) => x.plan_id === planId && !x.hidden).map((x) => ocultarSello(x.id, true)));
            }}
            onHidden={(planId) => {
              setSellos((all) => all.map((x) => (x.plan_id === planId ? { ...x, hidden: true } : x)));
              setSheet(null);
            }}
            onNoFui={(planId) => {
              setSellos((all) => all.filter((x) => x.plan_id !== planId));
              setSheet(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
