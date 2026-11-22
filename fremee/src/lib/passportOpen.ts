/**
 * Apertura y cierre del pasaporte (perfil ⇄ libreta abierta), con la Web Animations API: solo transform y opacity.
 *
 * APERTURA (escritorio, 840 ms)
 *   0–160    perfil: opacity 1 → 0
 *   0–200    mesa del lector: opacity 0 → 1
 *   0–240    tapa: vuela desde su sitio en el perfil a la página derecha (FLIP), de −3° a 0°
 *   240      mitad derecha (con su marco) y lomo: aparecen de golpe bajo la tapa
 *   240–420  tapa: se pliega sobre el lomo (scaleX 1 → 0, origen a la izquierda) y se oscurece
 *   420–600  guarda (mitad izquierda con su marco): se despliega desde el lomo (scaleX 0 → 1, origen a la derecha)
 *   600–840  cinta (cae 24 px desde arriba), título y controles (+8 px → 0), con fundido
 * Móvil (600 ms): sin guarda; la cinta y los controles entran a los 420 ms.
 *
 * CIERRE (escritorio, 480 ms; móvil, 360 ms): la apertura al revés, más corta. Solo al volver al perfil con «‹ Perfil»
 * o el gesto de atrás y si la tapa del perfil está en pantalla; si no, o con movimiento reducido, fundido de 160 ms.
 *   0–120    cinta y controles se recogen (la cinta sube 24 px)
 *   60–200   guarda: se pliega hacia el lomo
 *   200–340  tapa: se despliega desde el lomo sobre la página derecha, aclarándose
 *   340–480  la libreta cerrada vuela de vuelta al perfil (−3°) · la mesa se desvanece · el perfil aparece
 * En móvil: controles 0–100, tapa 80–220, vuelo 220–360.
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
  /** Capa negra (opacity 0) dentro de coverFold: oscurece la tapa al plegarse. */
  coverShade?: HTMLElement | null;
  /** Capa del perfil, para el fundido de salida. */
  profile?: HTMLElement | null;
  /** Fondo del lector (solo el fondo, no el contenido). */
  desk: HTMLElement;
  /** Mitad derecha con su marco (o la única en móvil) y el lomo. */
  right: HTMLElement[];
  /** Mitad izquierda con su marco (guarda). null en móvil. */
  left: HTMLElement | null;
  /** Cinta marcapáginas. */
  ribbon?: HTMLElement | null;
  /** Título, flechas y contador. */
  chrome?: HTMLElement[];
  /** Rotación de la tapa en el perfil, en grados. */
  fromRotate?: number;
};

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Dónde está el centro de la tapa del perfil respecto al de la del lector, y la escala entre ambas (el giro no falsea el centro). */
function flip(fromCover: HTMLElement, coverMove: HTMLElement) {
  const a = fromCover.getBoundingClientRect();
  const b = coverMove.getBoundingClientRect();
  return {
    dx: a.left + a.width / 2 - (b.left + b.width / 2),
    dy: a.top + a.height / 2 - (b.top + b.height / 2),
    s: fromCover.offsetWidth / b.width,
  };
}

/** Aparece de golpe a los `at` ms (para lo que queda tapado por la tapa al llegar). */
const showAt = (el: HTMLElement, at: number) => el.animate([{ opacity: 0 }, { opacity: 0, offset: 0.999 }, { opacity: 1 }], { duration: at, fill: "both" });

/** Lanza la apertura. La promesa se resuelve al terminar (para empezar después la animación de «Sello nuevo»). */
export async function playOpen(els: OpenEls): Promise<void> {
  const opt = (t: { delay: number; duration: number }, easing: string = EASE.standard): KeyframeAnimationOptions => ({
    delay: t.delay,
    duration: t.duration,
    easing,
    fill: "both",
  });

  const { dx, dy, s } = flip(els.fromCover, els.coverMove);
  const rot = els.fromRotate ?? -3;

  els.fromCover.style.visibility = "hidden";
  els.coverMove.style.transformOrigin = "50% 50%";
  els.coverFold.style.transformOrigin = "0 50%";
  if (els.left) els.left.style.transformOrigin = "100% 50%";

  const anims: Animation[] = [];
  if (els.profile) anims.push(els.profile.animate([{ opacity: 1 }, { opacity: 0 }], opt(T.profileOut, "linear")));
  anims.push(els.desk.animate([{ opacity: 0 }, { opacity: 1 }], opt(T.deskIn, "linear")));

  anims.push(els.coverMove.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${rot}deg)` }, { transform: "none" }], opt(T.coverMove)));

  // La mitad derecha (con su marco) aparece justo cuando llega la tapa.
  for (const el of els.right) anims.push(showAt(el, T.coverMove.duration));

  anims.push(els.coverFold.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], opt(T.coverFold, EASE.accelerate)));
  if (els.coverShade) anims.push(els.coverShade.animate([{ opacity: 0 }, { opacity: 0.35 }], opt(T.coverFold, "linear")));

  if (els.left) {
    anims.push(els.left.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], opt(T.leftUnfold)));
  }

  const chromeT = els.left ? T.chrome : T.chromeMobile;
  if (els.ribbon) {
    anims.push(els.ribbon.animate([{ opacity: 0, transform: "translateY(-24px)" }, { opacity: 1, transform: "none" }], opt(chromeT)));
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

/** Cerrar con fundido corto (sin tapa a la que volver, enlace directo o movimiento reducido). */
export async function playClose(root: HTMLElement, profile?: HTMLElement | null): Promise<void> {
  const o = { duration: 160, easing: "linear", fill: "both" as const };
  profile?.animate([{ opacity: 0 }, { opacity: 1 }], o);
  await root.animate([{ opacity: 1 }, { opacity: 0 }], o).finished.catch(() => undefined);
}

/** ¿Se ve la tapa del perfil en pantalla? Si no, no hay adónde volar. */
export function isInViewport(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

/**
 * Cierre con la libreta: la apertura al revés. Debe llamarse con la tapa del lector (coverMove) ya montada sobre la
 * página derecha. Devuelve `done` (el lector se desmonta cuando termina, no antes) y `cancel` (salta al final).
 */
export function playCloseBook(els: OpenEls): { done: Promise<void>; cancel: () => void } {
  const mobile = !els.left;
  const t = mobile
    ? { chrome: [0, 100], left: [0, 0], cover: [80, 220], fly: [220, 360] }
    : { chrome: [0, 120], left: [60, 200], cover: [200, 340], fly: [340, 480] };
  const o = (r: number[], easing: string = EASE.standard): KeyframeAnimationOptions => ({ delay: r[0], duration: r[1] - r[0], easing, fill: "both" });

  // Se mide antes de crear ninguna animación: la tapa aún está sin plegar.
  const { dx, dy, s } = flip(els.fromCover, els.coverMove);
  els.coverMove.style.transformOrigin = "50% 50%";
  els.coverFold.style.transformOrigin = "0 50%";
  if (els.left) els.left.style.transformOrigin = "100% 50%";

  const A: Animation[] = [];

  // 1 · cinta y controles se recogen
  if (els.ribbon) A.push(els.ribbon.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-24px)" }], o(t.chrome, EASE.accelerate)));
  for (const el of els.chrome ?? []) A.push(el.animate([{ opacity: 1 }, { opacity: 0 }], o(t.chrome, "linear")));

  // 2 · la guarda se pliega hacia el lomo
  if (els.left) A.push(els.left.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], o(t.left, EASE.accelerate)));

  // 3 · la tapa se despliega sobre la página derecha; aparece al empezar
  A.push(els.coverFold.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], o(t.cover)));
  if (els.coverShade) A.push(els.coverShade.animate([{ opacity: 0.35 }, { opacity: 0 }], o(t.cover, "linear")));

  // la mitad derecha (con su marco) desaparece cuando la tapa ya la tapa
  const hideAt = (el: HTMLElement) => el.animate([{ opacity: 1 }, { opacity: 1, offset: 0.999 }, { opacity: 0 }], { duration: t.cover[1], fill: "both" });
  for (const el of els.right) A.push(hideAt(el));

  // 4 · vuelo de vuelta (FLIP inverso) y relevo de fondos
  A.push(els.coverMove.animate([{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${els.fromRotate ?? -3}deg)` }], o(t.fly)));
  A.push(els.desk.animate([{ opacity: 1 }, { opacity: 0 }], o(t.fly, "linear")));
  if (els.profile) A.push(els.profile.animate([{ opacity: 0 }, { opacity: 1 }], o(t.fly, "linear")));

  els.fromCover.style.visibility = "hidden";
  const done = Promise.all(A.map((x) => x.finished.catch(() => undefined))).then(() => {
    els.fromCover.style.visibility = "";
  });
  return { done, cancel: () => A.forEach((a) => a.finish()) };
}
