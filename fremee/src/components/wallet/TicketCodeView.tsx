"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { TicketCodeFormat } from "@/lib/ticket-barcode";

const BCID: Record<Exclude<TicketCodeFormat, "qr">, string> = { aztec: "azteccode", pdf417: "pdf417" };

/**
 * Dibuja el código de un billete tal como se leyó: QR, Aztec o PDF417 (el de las tarjetas de embarque).
 * El QR usa qrcode.react; los otros dos, bwip-js, que solo se carga cuando hace falta.
 */
export function TicketCodeView({ formato, contenido, size }: { formato: TicketCodeFormat; contenido: string; size: number }) {
  if (formato === "qr") return <QRCodeSVG value={contenido} size={size} level="M" title="Código QR del billete" />;
  return <OtherCode formato={formato} contenido={contenido} size={size} />;
}

function OtherCode({ formato, contenido, size }: { formato: Exclude<TicketCodeFormat, "qr">; contenido: string; size: number }) {
  const [svg, setSvg] = useState<{ key: string; markup: string } | null>(null);
  const key = `${formato}:${contenido}`;
  useEffect(() => {
    let cancelled = false;
    import("bwip-js/browser")
      .then((bwip) => {
        // PDF417 es ancho y bajo; Aztec, cuadrado. El SVG lo genera la librería a partir del texto: no lleva HTML de nadie.
        const markup = bwip.toSVG({ bcid: BCID[formato], text: contenido, scale: 3, padding: 4, backgroundcolor: "ffffff" });
        if (!cancelled) setSvg({ key, markup });
      })
      .catch((err) => console.error("[billetes] No se pudo dibujar el código:", (err as { message?: string } | null)?.message ?? err));
    return () => { cancelled = true; };
  }, [formato, contenido, key]);

  const label = formato === "aztec" ? "Código Aztec del billete" : "Código PDF417 del billete";
  if (!svg || svg.key !== key) return <div role="img" aria-label={label} style={{ width: size, height: formato === "aztec" ? size : size / 2 }} />;
  return (
    <div
      role="img"
      aria-label={label}
      className="[&>svg]:h-auto [&>svg]:max-w-full"
      style={{ width: formato === "aztec" ? size : Math.min(size * 1.6, 320) }}
      dangerouslySetInnerHTML={{ __html: svg.markup }}
    />
  );
}
