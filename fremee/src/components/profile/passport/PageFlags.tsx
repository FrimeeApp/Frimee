"use client";

import { forwardRef } from "react";
import { FOCUS } from "@/components/plans/home/pieces";

/**
 * Marcas adhesivas que asoman por el borde de arriba de la libreta: «Datos» y un año por cada año con sellos, en el
 * orden del libro (Datos, luego del año más antiguo al más reciente).
 * - La de la sección abierta asoma más (44 px en vez de 34), va en negrita y lleva aria-current: no depende del color.
 * - Colores de papel adhesivo, iguales en los dos temas porque forman parte del objeto. Texto #1F2A28 (≥ 11:1).
 * - 44 px de alto en todas; las inactivas tienen 10 px escondidos bajo la libreta.
 */

const TINTS = ["#D3E6DD", "#DADFF0", "#F1D8C6", "#E9DDF0", "#F0E6C4", "#D9EBF0"]; // menta, azul, melocotón, lila, arena, cielo

export type FlagItem = { id: string; label: string; page: number; /** Hay años anteriores que solo se alcanzan desde el índice: la marca lleva «‹». */ more?: boolean };

const PageFlags = forwardRef<
  HTMLElement,
  {
    items: FlagItem[];
    activeId: string;
    onGo: (page: number) => void;
    /** Ancho total de la libreta en px, para repartir las marcas. */
    bookWidth: number;
    flagWidth?: number;
  }
>(function PageFlags({ items, activeId, onGo, bookWidth, flagWidth = 78 }, ref) {
  // Empiezan a 48 px del borde (20 en móvil) y se separan 20 px; si no caben, se juntan hasta que la última acabe en el borde
  // de la libreta. Si se solapan, el texto va a la izquierda para que se lea la parte que queda a la vista.
  const start = bookWidth < 500 ? 20 : 48;
  const fit = (w: number) => Math.min(w + 20, (bookWidth - start - w) / Math.max(items.length - 1, 1));
  // Si ni así se lee el año, las marcas se estrechan (50 px, texto de 12 px) en vez de salirse de la libreta.
  const width = fit(flagWidth) < 42 ? 50 : flagWidth;
  const step = fit(width);
  const overlap = step < width;
  return (
    <nav ref={ref} aria-label="Marcas del pasaporte" className="absolute inset-x-0 top-0 z-0 h-0">
      {items.map((f, i) => {
        const on = f.id === activeId;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onGo(f.page)}
            aria-current={on ? "page" : undefined}
            aria-label={f.label === "Datos" ? "Ir a la página de datos" : `Ir a ${f.label}${f.more ? ". Los años anteriores están en el índice" : ""}`}
            className={`absolute bottom-full flex ${overlap ? "justify-start pl-1.5 text-[12px]" : "justify-center text-[13px]"} rounded-t-[5px] border border-b-0 border-[rgba(31,42,40,0.14)] leading-none text-[#1F2A28] transition-transform duration-[160ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none ${FOCUS} ${
              on ? "z-10 pt-3 font-bold shadow-[0_-2px_6px_rgba(0,0,0,0.25)]" : "pt-2 font-semibold hover:-translate-y-1"
            }`}
            style={{
              left: start + i * step,
              width,
              height: 44,
              // Las inactivas se hunden 10 px bajo la libreta (siguen teniendo 44 px de área).
              marginBottom: on ? -6 : -16,
              background: TINTS[i % TINTS.length],
            }}
          >
            {f.more ? `‹ ${f.label}` : f.label}
          </button>
        );
      })}
    </nav>
  );
});

export default PageFlags;
