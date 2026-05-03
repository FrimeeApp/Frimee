"use client";

import { useEffect } from "react";
import styles from "./ModalFeedback.module.css";

export type ModalFeedbackState =
  | { type: "loading" }
  | { type: "success"; label?: string }
  | { type: "error"; message: string };

interface ModalFeedbackProps {
  state: ModalFeedbackState;
  /** Llamado ~1.5s después de mostrar el éxito — aquí llama a onCreated() + requestClose() */
  onSuccess: () => void;
  /** Llamado cuando el usuario pulsa "Reintentar" — vuelve al formulario */
  onDismissError: () => void;
}

const SUCCESS_DURATION = 1500;

export function ModalFeedback({ state, onSuccess, onDismissError }: ModalFeedbackProps) {
  useEffect(() => {
    if (state.type !== "success") return;
    const t = setTimeout(onSuccess, SUCCESS_DURATION);
    return () => clearTimeout(t);
  }, [state.type, onSuccess]);

  return (
    <div className={styles.overlay} role="status" aria-live="polite">
      {state.type === "loading" && (
        <div className={styles.spinner} aria-label="Cargando…" />
      )}

      {state.type === "success" && (
        <>
          <div className={`${styles.iconWrap} ${styles.iconSuccess}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className={styles.label}>{state.label ?? "¡Listo!"}</p>
        </>
      )}

      {state.type === "error" && (
        <>
          <div className={`${styles.iconWrap} ${styles.iconError}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <p className={styles.label}>Algo ha salido mal</p>
          <p className={styles.sublabel}>{state.message}</p>
          <button type="button" className={styles.retryBtn} onClick={onDismissError}>
            Reintentar
          </button>
        </>
      )}
    </div>
  );
}
