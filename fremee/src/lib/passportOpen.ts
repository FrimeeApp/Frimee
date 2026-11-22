/**
 * Apertura del pasaporte (perfil → libreta abierta), con la Web Animations API: solo transform y opacity.
 *
 * Línea de tiempo en escritorio (840 ms):
 *   0–160    perfil: opacity 1 → 0
 *   0–200    mesa del lector: opacity 0 → 1
 *   0–240    tapa: vuela desde su sitio en el perfil a la página derecha (FLIP), de −3° a 0°
 *   240      página derecha: aparece de golpe bajo la tapa
 *   240–420  tapa: se pliega sobre el lomo (scaleX 1 → 0, origen a la izquierda)
 *   420–600  guarda / página izquierda: se despliega desde el lomo (scaleX 0 → 1, origen a la derecha)
 *   600–840  pestañas (−12 px → 0) y título y controles (+8 px → 0), con fundido
 * En móvil (sin página izquierda) las pestañas y los controles entran a los 420 ms.
 */

export const EASE = {
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
} as const;

const T = {
  profileOut: { delay: 0, duration: 160 },
  deskIn: { delay: 0, duration: 200 },
  coverMove: { delay: 0, duration: 240 },
  coverFold: { delay: 240, duration: 180 },
  leftUnfold: { delay: 420, duration: 180 },
  chrome: { delay: 600, duration: 240 },
  chromeMobile: { delay: 420, duration: 180 },
} as const;

export type OpenEls = {
  /** La tapa pequeña del perfil: se lee su posición y se oculta mientras vuela la del lector. */
  fromCover: HTMLElement;
  /** Tapa del lector: envoltorio con el tamaño de la tapa, centrado sobre la página derecha (o la única). */
  coverMove: HTMLElement;
  /** Hijo de coverMove: es el que se pliega. */
  coverFold: HTMLElement;
  /** Capa del perfil, para el fundido de salida. */
  profile?: HTMLElement | null;
  /** Fondo del lector (solo el fondo, no el contenido). */
  desk: HTMLElement;
  /** Página derecha (o la única en móvil) y el lomo. */
  right: HTMLElement[];
  /** Guarda / página izquierda. null en móvil. */
  left: HTMLElement | null;
  /** Pestañas del canto. */
  tabs?: HTMLElement | null;
  /** Título, flechas y contador. */
  chrome?: HTMLElement[];
  /** Rotación de la tapa en el perfil, en grados. */
  fromRotate?: number;
};

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Lanza la apertura. La promesa se resuelve al terminar (para empezar después la animación de «Sello nuevo»). */
export async function playOpen(els: OpenEls): Promise<void> {
  const opt = (t: { delay: number; duration: number }, easing: string = EASE.standard): KeyframeAnimationOptions => ({
    delay: t.delay,
    duration: t.duration,
    easing,
    fill: "both",
  });

  // FLIP: dónde está la tapa en el perfil y dónde tiene que acabar. Se compara por centros para que la inclinación no falsee la posición.
  const a = els.fromCover.getBoundingClientRect();
  const b = els.coverMove.getBoundingClientRect();
  const dx = a.left + a.width / 2 - (b.left + b.width / 2);
  const dy = a.top + a.height / 2 - (b.top + b.height / 2);
  const s = els.fromCover.offsetWidth / b.width; // misma proporción: una sola escala
  const rot = els.fromRotate ?? -3;

  els.fromCover.style.visibility = "hidden";
  els.coverMove.style.transformOrigin = "50% 50%";
  els.coverFold.style.transformOrigin = "0 50%";
  if (els.left) els.left.style.transformOrigin = "100% 50%";

  const anims: Animation[] = [];
  if (els.profile) anims.push(els.profile.animate([{ opacity: 1 }, { opacity: 0 }], opt(T.profileOut, "linear")));
  anims.push(els.desk.animate([{ opacity: 0 }, { opacity: 1 }], opt(T.deskIn, "linear")));

  anims.push(els.coverMove.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot}deg)` }, { transform: "none" }], opt(T.coverMove)));

  // La página de debajo aparece justo cuando llega la tapa.
  for (const el of els.right) {
    anims.push(el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1 }], { duration: T.coverMove.duration, fill: "both" }));
  }

  anims.push(els.coverFold.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], opt(T.coverFold, EASE.accelerate)));

  if (els.left) {
    anims.push(els.left.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], opt(T.leftUnfold)));
  }

  const chromeT = els.left ? T.chrome : T.chromeMobile;
  if (els.tabs) {
    anims.push(els.tabs.animate([{ opacity: 0, transform: "translateX(-12px)" }, { opacity: 1, transform: "none" }], opt(chromeT)));
  }
  for (const el of els.chrome ?? []) {
    anims.push(el.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], opt(chromeT)));
  }

  await Promise.all(anims.map((x) => x.finished.catch(() => undefined)));

  // Limpieza: la tapa del lector desaparece y la del perfil vuelve (para cuando se cierre).
  els.coverMove.style.display = "none";
  els.fromCover.style.visibility = "";
  anims.forEach((x) => x.cancel()); // el estado final es el natural
}

/** Cerrar: fundido corto de vuelta al perfil (no se repite la apertura al revés). */
export async function playClose(root: HTMLElement, profile?: HTMLElement | null): Promise<void> {
  const o = { duration: 160, easing: "linear", fill: "both" as const };
  profile?.animate([{ opacity: 0 }, { opacity: 1 }], o);
  await root.animate([{ opacity: 1 }, { opacity: 0 }], o).finished.catch(() => undefined);
}
