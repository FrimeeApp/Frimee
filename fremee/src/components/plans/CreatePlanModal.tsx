"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";

export type CreatePlanPayload = {
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  visibility: "PUBLICO" | "SOLO_GRUPO";
  inviteMode: "now" | "later";
};

type CreatePlanModalProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: CreatePlanPayload) => void;
};

const DEFAULT_VISIBILITY: CreatePlanPayload["visibility"] = "SOLO_GRUPO";
const DEFAULT_INVITE_MODE: CreatePlanPayload["inviteMode"] = "later";

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function isBlobUrl(url: string) {
  return url.startsWith("blob:");
}

export default function CreatePlanModal({ open, onClose, onCreate }: CreatePlanModalProps) {
  const wasOpenRef = useRef(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(addDays(new Date(), 1)));
  const [visibility, setVisibility] = useState<CreatePlanPayload["visibility"]>(DEFAULT_VISIBILITY);
  const [inviteMode, setInviteMode] = useState<CreatePlanPayload["inviteMode"]>(DEFAULT_INVITE_MODE);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!location.trim()) return false;
    if (!startDate || !endDate) return false;
    return endDate >= startDate;
  }, [endDate, location, startDate, title]);

  const resetForm = () => {
    const today = new Date();
    setTitle("");
    setLocation("");
    setStartDate(toDateInputValue(today));
    setEndDate(toDateInputValue(addDays(today, 1)));
    setVisibility(DEFAULT_VISIBILITY);
    setInviteMode(DEFAULT_INVITE_MODE);
    setCoverImageUrl(null);
    setCoverFileName(null);
    setErrorMsg(null);
  };

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      resetForm();
    }
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (coverImageUrl && isBlobUrl(coverImageUrl)) {
        URL.revokeObjectURL(coverImageUrl);
      }
    };
  }, [coverImageUrl]);

  if (!open) return null;

  const onPickCover = () => {
    coverInputRef.current?.click();
  };

  const onCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (coverImageUrl && isBlobUrl(coverImageUrl)) {
      URL.revokeObjectURL(coverImageUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    setCoverImageUrl(nextUrl);
    setCoverFileName(file.name);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      setErrorMsg("Completa el nombre y el destino para continuar.");
      return;
    }

    setErrorMsg(null);
    onCreate({
      title: title.trim(),
      location: location.trim(),
      startDate,
      endDate,
      coverImageUrl,
      visibility,
      inviteMode,
    });
  };

  const onStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value && endDate < value) {
      setEndDate(value);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-safe py-[var(--space-6)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-modal border border-strong bg-surface shadow-elev-2"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-plan-title"
      >
        <div className="flex items-start justify-between gap-[var(--space-4)] border-b border-app px-[var(--space-4)] py-[var(--space-3)]">
          <div>
            <h2 id="create-plan-title" className="text-[var(--font-h4)] font-[var(--fw-semibold)] leading-[var(--lh-h4)]">
              Crear plan
            </h2>
            <p className="mt-[var(--space-1)] text-body-sm text-muted">Lo esencial y listo para empezar.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-avatar border border-app bg-surface text-body transition-colors hover:bg-[var(--interactive-hover-surface)]"
          >
            X
          </button>
        </div>

        <form onSubmit={onSubmit} className="max-h-[70vh] space-y-[var(--space-4)] overflow-y-auto px-[var(--space-4)] py-[var(--space-4)]">
          <Field label="Nombre del plan" required>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej. Ruta por la sierra"
              className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
            />
          </Field>

          <Field label="Destino" required>
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Ciudad, pais o zona"
              className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
            />
          </Field>

          <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
            <Field label="Fecha inicio" required>
              <input
                type="date"
                value={startDate}
                onChange={(event) => onStartDateChange(event.target.value)}
                className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
              />
            </Field>
            <Field label="Fecha fin" required>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
              />
            </Field>
          </div>

          <Field label="Portada" optional>
            <div className="space-y-[var(--space-2)]">
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="Vista previa portada"
                  className="h-[160px] w-full rounded-input border border-app object-cover"
                />
              ) : (
                <div className="flex h-[160px] w-full items-center justify-center rounded-input border border-dashed border-app bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.9),_rgba(240,240,240,0.6))] text-body-sm text-muted">
                  Portada opcional
                </div>
              )}

              <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                <button
                  type="button"
                  onClick={onPickCover}
                  className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-3)] text-body-sm font-[var(--fw-medium)]"
                >
                  {coverImageUrl ? "Cambiar portada" : "Subir portada"}
                </button>
                {coverImageUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (coverImageUrl && isBlobUrl(coverImageUrl)) {
                        URL.revokeObjectURL(coverImageUrl);
                      }
                      setCoverImageUrl(null);
                      setCoverFileName(null);
                    }}
                    className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-3)] text-body-sm font-[var(--fw-medium)]"
                  >
                    Quitar
                  </button>
                ) : null}
              </div>
              {coverFileName ? <p className="text-caption text-muted">{coverFileName}</p> : null}
              <input ref={coverInputRef} type="file" accept="image/*" onChange={onCoverChange} className="hidden" />
            </div>
          </Field>

          <Field label="Visibilidad">
            <div className="grid grid-cols-2 gap-[var(--space-2)]">
              <button
                type="button"
                onClick={() => setVisibility("PUBLICO")}
                className={`h-input rounded-input border px-[var(--space-3)] text-left text-body-sm font-[var(--fw-medium)] ${
                  visibility === "PUBLICO"
                    ? "border-primary-token bg-primary-token text-contrast-token"
                    : "border-app bg-surface-inset"
                }`}
              >
                Publico
              </button>
              <button
                type="button"
                onClick={() => setVisibility("SOLO_GRUPO")}
                className={`h-input rounded-input border px-[var(--space-3)] text-left text-body-sm font-[var(--fw-medium)] ${
                  visibility === "SOLO_GRUPO"
                    ? "border-primary-token bg-primary-token text-contrast-token"
                    : "border-app bg-surface-inset"
                }`}
              >
                Privado
              </button>
            </div>
            <p className="mt-[var(--space-2)] text-caption text-muted">Privado significa visible solo para tu grupo.</p>
          </Field>

          <Field label="Invitar amigos" optional>
            <div className="rounded-input border border-app bg-surface-inset p-[var(--space-3)]">
              <div className="flex items-center justify-between gap-[var(--space-3)]">
                <div>
                  <p className="text-body-sm font-[var(--fw-medium)]">Invitar ahora</p>
                  <p className="text-caption text-muted">Puedes hacerlo mas tarde desde el plan.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteMode((prev) => (prev === "now" ? "later" : "now"))}
                  className={`h-input min-w-[88px] rounded-input border px-[var(--space-3)] text-body-sm font-[var(--fw-medium)] ${
                    inviteMode === "now"
                      ? "border-primary-token bg-primary-token text-contrast-token"
                      : "border-app bg-surface"
                  }`}
                >
                  {inviteMode === "now" ? "Si" : "No"}
                </button>
              </div>
              {inviteMode === "now" ? (
                <p className="mt-[var(--space-2)] text-caption text-muted">La invitacion se gestiona despues de crear el plan.</p>
              ) : null}
            </div>
          </Field>

          {errorMsg ? <p className="text-body-sm text-error-token">{errorMsg}</p> : null}

          <div className="flex items-center justify-end gap-[var(--space-2)] border-t border-app pt-[var(--space-3)]">
            <button
              type="button"
              onClick={onClose}
              className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-4)] text-body-sm font-[var(--fw-medium)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-btn-primary rounded-input border border-primary-token bg-primary-token px-[var(--space-4)] text-body-sm font-[var(--fw-semibold)] text-contrast-token disabled:opacity-[var(--disabled-opacity)]"
            >
              Crear plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  required = false,
  optional = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] text-body-sm font-[var(--fw-medium)]">
        <span>{label}</span>
        {required ? <span className="text-error-token">*</span> : null}
        {!required && optional ? <span className="text-caption text-muted">Opcional</span> : null}
      </span>
      {children}
    </label>
  );
}
