/**
 * Abrir el pasaporte. La tapa del perfil se queda puesta en una capa de <body> (sobrevive al cambio de ruta) y,
 * cuando la libreta está montada, viaja hasta la página que ocupa su sitio, se endereza y se funde con ella.
 * Escala uniforme: la tapa y la página tienen casi la misma proporción, así que nada se estira.
 */

const OVERLAY_ID = "passport-opening";
const TRAVEL_MS = 240;
const FADE_MS = 200;
const EASE = "cubic-bezier(0.2, 0, 0, 1)";

/** Deja la tapa en una capa fija sobre el perfil y navega. Con movimiento reducido, solo navega. */
export function openPassportFrom(cover: HTMLElement | null, go: () => void) {
  if (!cover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    go();
    return;
  }
  const rect = cover.getBoundingClientRect();
  const w = cover.offsetWidth;
  const h = cover.offsetHeight;
  if (!w || !h) {
    go();
    return;
  }
  document.getElementById(OVERLAY_ID)?.remove();
  // La capa mide lo que la tapa sin inclinar y se centra donde está la tapa; la copia conserva su inclinación.
  const layer = document.createElement("div");
  layer.id = OVERLAY_ID;
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    left: `${rect.left + rect.width / 2 - w / 2}px`,
    top: `${rect.top + rect.height / 2 - h / 2}px`,
    width: `${w}px`,
    height: `${h}px`,
    zIndex: "9999",
    pointerEvents: "none",
    transformOrigin: "center center",
    willChange: "transform",
  });
  const clone = cover.cloneNode(true) as HTMLElement;
  clone.dataset.role = "cover";
  Object.assign(clone.style, { position: "absolute", inset: "0", margin: "0" });
  layer.appendChild(clone);
  document.body.appendChild(layer);
  // Por si la libreta no llega a retirarla, nunca se queda tapando la pantalla.
  window.setTimeout(() => layer.remove(), 8000);
  go();
}

/**
 * La libreta ya está montada: la tapa viaja hasta `target` (la página que ocupa su lugar), y entonces se funde
 * mientras `book` aparece. Sin capa (entrada directa, movimiento reducido) no hace nada.
 */
export function closePassportOpening(target: () => HTMLElement | null, book: HTMLElement | null) {
  const layer = document.getElementById(OVERLAY_ID);
  if (!layer) return;
  if (book) book.style.opacity = "0";
  const finish = () => {
    layer.remove();
    if (book) book.style.opacity = "";
  };
  // Dos fotogramas: la libreta calcula su escala justo después de montarse.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const t = target()?.getBoundingClientRect();
      const w = layer.offsetWidth;
      const h = layer.offsetHeight;
      if (!t || !t.width || !w || !h) {
        finish();
        return;
      }
      const s = Math.min(t.width / w, t.height / h);
      const from = layer.getBoundingClientRect();
      const dx = t.left + t.width / 2 - (from.left + from.width / 2);
      const dy = t.top + t.height / 2 - (from.top + from.height / 2);
      const move = layer.animate([{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], {
        duration: TRAVEL_MS,
        easing: EASE,
        fill: "forwards",
      });
      // La tapa se endereza durante el viaje (su inclinación es la del perfil).
      const tilt = getComputedStyle(layer.querySelector<HTMLElement>("[data-role=cover]")!).transform;
      layer.querySelector<HTMLElement>("[data-role=cover]")?.animate([{ transform: tilt === "none" ? "rotate(0deg)" : tilt }, { transform: "rotate(0deg)" }], { duration: TRAVEL_MS, easing: EASE, fill: "forwards" });
      move.onfinish = () => {
        book?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "linear" });
        if (book) book.style.opacity = "";
        const fade = layer.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, opacity: 0 }], {
          duration: FADE_MS,
          easing: "linear",
          fill: "forwards",
        });
        fade.onfinish = finish;
        fade.oncancel = finish;
      };
      move.oncancel = finish;
    }),
  );
}
