"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fff", color: "#1c1c22" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100dvh", gap: 24, padding: "0 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(220,38,38,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertTriangle size={32} color="#dc2626" aria-hidden />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Error crítico</h1>
            <p style={{ margin: 0, fontSize: 14, color: "#60606b", maxWidth: 280 }}>
              La aplicación ha encontrado un error inesperado. Por favor, recarga la página.
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 8, background: "#298e7d", color: "#fff", border: "none", fontSize: 14, cursor: "pointer" }}
          >
            <RefreshCw size={16} aria-hidden />
            Recargar
          </button>
        </div>
      </body>
    </html>
  );
}
