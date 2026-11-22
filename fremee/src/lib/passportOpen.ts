/**
 * Abrir el pasaporte: la tapa del perfil se escala (240 ms) hasta ocupar la pantalla y, al llegar a la libreta,
 * se funde dejando ver la página. La capa vive en <body> para sobrevivir al cambio de ruta.
 */

const OVERLAY_ID = "passport-opening";
const OPEN_MS = 240;
const CLOSE_MS = 240;

/** Escala la tapa hasta cubrir la pantalla y luego llama a `go` (la navegación). Con movimiento reducido, navega sin más. */
export function openPassportFrom(cover: HTMLElement | null, go: () => void) {
  if (!cover || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    go();
    return;
  }
  const r = cover.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) {
    go();
    return;
  }
  document.getElementById(OVERLAY_ID)?.remove();
  const layer = document.createElement("div");
  layer.id = OVERLAY_ID;
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    left: `${r.left}px`,
    top: `${r.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    zIndex: "9999",
    pointerEvents: "none",
    transformOrigin: "center center",
    background: "var(--passport-cover)",
    borderRadius: "8px",
    overflow: "hidden",
  });
  const clone = cover.cloneNode(true) as HTMLElement;
  clone.style.transform = "none";
  clone.style.margin = "0";
  clone.style.position = "absolute";
  clone.style.left = "0";
  clone.style.top = "0";
  layer.appendChild(clone);
  document.body.appendChild(layer);

  const scale = Math.max(window.innerWidth / r.width, window.innerHeight / r.height) * 1.02;
  const dx = window.innerWidth / 2 - (r.left + r.width / 2);
  const dy = window.innerHeight / 2 - (r.top + r.height / 2);
  const anim = layer.animate([{ transform: "translate(0, 0) scale(1)" }, { transform: `translate(${dx}px, ${dy}px) scale(${scale})` }], {
    duration: OPEN_MS,
    easing: "cubic-bezier(0.2, 0, 0, 1)",
    fill: "forwards",
  });
  let went = false;
  const next = () => {
    if (went) return;
    went = true;
    go();
  };
  anim.onfinish = next;
  anim.oncancel = next;
  // Por si la libreta no llega a retirar la capa, nunca se queda tapando la pantalla.
  window.setTimeout(() => layer.remove(), 6000);
}

/** La libreta ya está lista: la capa de la tapa se funde y se retira. */
export function closePassportOpening() {
  const layer = document.getElementById(OVERLAY_ID);
  if (!layer) return;
  const fade = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: CLOSE_MS, easing: "linear", fill: "forwards" });
  fade.onfinish = () => layer.remove();
  fade.oncancel = () => layer.remove();
}
