"use client";

import { useState } from "react";

interface PollCreatorModalProps {
  onClose: () => void;
  onCreate: (question: string, options: string[]) => void;
}

export function PollCreatorModal({ onClose, onCreate }: PollCreatorModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const canCreate = question.trim().length > 0 && options.filter((o) => o.trim()).length >= 2;

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-[20px] bg-app p-[var(--space-5)] md:rounded-[16px]" onClick={(e) => e.stopPropagation()}>
        <p className="mb-[var(--space-4)] text-body font-[var(--fw-semibold)] text-app">Nueva encuesta</p>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta..."
          className="mb-[var(--space-3)] w-full rounded-[10px] border border-app bg-surface px-3 py-[10px] text-body-sm text-app outline-none focus:border-[var(--border-strong)]"
        />
        <div className="mb-[var(--space-3)] space-y-[8px]">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => setOptions((prev) => prev.map((o, i) => (i === idx ? e.target.value : o)))}
                placeholder={`Opción ${idx + 1}`}
                className="flex-1 rounded-[10px] border border-app bg-surface px-3 py-[8px] text-body-sm text-app outline-none focus:border-[var(--border-strong)]"
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-muted transition-colors hover:text-red-400"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="size-[16px]"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 6 && (
          <button
            type="button"
            onClick={() => setOptions((prev) => [...prev, ""])}
            className="mb-[var(--space-4)] text-body-sm text-[var(--text-primary)] transition-opacity hover:opacity-70"
          >
            + Añadir opción
          </button>
        )}
        <div className="flex gap-[var(--space-2)]">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] text-app transition-colors hover:bg-surface">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => onCreate(question.trim(), options.filter((o) => o.trim()))}
            className="flex-1 rounded-full bg-[var(--text-primary)] py-[10px] text-body-sm font-[var(--fw-semibold)] text-contrast-token transition-opacity hover:opacity-80 disabled:opacity-30"
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
