/**
 * Abrir el pasaporte: la tapa del perfil se queda puesta (capa en <body>, sobrevive al cambio de ruta) y, cuando la
 * libreta está lista, se escala (240 ms) hasta ocupar el hueco del libro; entonces se funde y las páginas aparecen.
 */

const OVERLAY_ID = "passport-opening";
const SCALE_MS = 240;
const FADE_MS = 200;

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
  // La capa mide lo que la tapa sin inclinar, centrada donde está ahora.
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
    transformOrigin: "top left",
    background: "var(--passport-cover)",
    borderLeft: "7px solid var(--passport-spine)",
    borderRadius: "8px",
    boxSizing: "border-box",
    overflow: "hidden",
  });
  const clone = cover.cloneNode(true) as HTMLElement;
  clone.dataset.role = "content";
  clone.style.transform = "none";
  clone.style.position = "absolute";
  clone.style.inset = "0";
  clone.style.margin = "0";
  clone.style.borderLeft = "0";
  clone.style.boxShadow = "none";
  layer.appendChild(clone);
  document.body.appendChild(layer);
  // Por si la libreta no llega a retirarla, nunca se queda tapando la pantalla.
  window.setTimeout(() => layer.remove(), 8000);
  go();
}

/**
 * La libreta ya tiene algo que enseñar: la tapa se escala hasta el libro (`target`), se funde y `book` aparece.
 * Sin capa (otra entrada, movimiento reducido) no hace nada y el libro se ve tal cual.
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
      const from = layer.getBoundingClientRect();
      const move = layer.animate(
        [
          { transform: "translate(0, 0) scale(1, 1)" },
          { transform: `translate(${t.left - from.left}px, ${t.top - from.top}px) scale(${t.width / w}, ${t.height / h})` },
        ],
        { duration: SCALE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
      );
      // El texto de la tapa se apaga pronto para que no se vea estirado.
      layer.querySelector<HTMLElement>("[data-role=content]")?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SCALE_MS * 0.45, easing: "linear", fill: "forwards" });
      move.onfinish = () => {
        book?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "linear" });
        if (book) book.style.opacity = "";
        const fade = layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "linear", fill: "forwards" });
        fade.onfinish = finish;
        fade.oncancel = finish;
      };
      move.oncancel = finish;
    }),
  );
}
