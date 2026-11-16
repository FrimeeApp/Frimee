"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronLeft, X } from "lucide-react";
import "@/styles/components/wizard.css";

/**
 * Three-step wizard shell (Design boards ca-* «Nueva actividad» and ga-* «Nuevo gasto»):
 * phone = sheet from 52 px down with a grabber (drag down to close), desktop = centred
 * 560 px window. Named steps you can tap to go back, a scrolling body and a fixed footer.
 */
export function Wizard({
  label, headTitle, steps, step, onStep, onBack, onDismiss, isClosing, busy, zClass = "z-[1310]", footer, children,
}: {
  /** Dialog name, e.g. «Nueva actividad»; «, paso N de 3» is appended. */
  label: string;
  /** Small centred line in the header, e.g. «Nueva actividad · Escapada a Lisboa». */
  headTitle: string;
  steps: readonly string[];
  /** 1-based. */
  step: number;
  /** Go back to an earlier step (tapping a done step). */
  onStep: (n: number) => void;
  onBack: () => void;
  onDismiss: () => void;
  isClosing: boolean;
  busy?: boolean;
  zClass?: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; dy: number } | null>(null);

  // Focus: first control on open, the step title when the step changes.
  const first = useRef(true);
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = 0;
    if (first.current) {
      first.current = false;
      body.querySelector<HTMLElement>("[data-autofocus], button, input")?.focus({ preventScroll: true });
    } else {
      body.querySelector<HTMLElement>(".wz-title")?.focus({ preventScroll: true });
    }
  }, [step]);

  // Focus trap + Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      if (e.key === "Escape") {
        // An open picker (time sheet, listbox) handles its own Escape.
        if (document.querySelector("[data-vaul-drawer][data-state='open'], [data-wz-listbox]")) return;
        e.preventDefault();
        if (!busy) onDismiss();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex='-1'])",
      )).filter((n) => n.offsetParent !== null);
      if (nodes.length === 0) return;
      const a = nodes[0], z = nodes[nodes.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); a.focus(); return; }
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onDismiss]);

  // Phone: drag the header down to close.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || (e.target as HTMLElement).closest("button")) return;
    drag.current = { y: e.clientY, dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !panelRef.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    panelRef.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!panelRef.current || !d) return;
    panelRef.current.style.transform = "";
    if (d.dy > 90 && !busy) onDismiss();
  };

  if (typeof document === "undefined") return null;
  // Portal: the plan page is itself a fixed layer (z 1200); rendered in place the wizard stays under it.
  return createPortal(
    <div className={`wz fixed inset-0 ${zClass}`}>
      <div data-closing={isClosing ? "true" : "false"} className="app-modal-overlay wz-scrim" onClick={busy ? undefined : onDismiss} />
      <div className="wz-pos" onClick={busy ? undefined : onDismiss}>
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`${label}, paso ${step} de ${steps.length}`}
          data-closing={isClosing ? "true" : "false"}
          className="wz-panel app-modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <span aria-hidden className="wz-grab" />
            <div className="wz-head">
              {step > 1 ? (
                <button type="button" className="wz-ib" aria-label="Volver al paso anterior" title="Volver" onClick={onBack} disabled={busy}>
                  <ChevronLeft className="size-[22px]" aria-hidden />
                </button>
              ) : <span className="w-11 flex-none" />}
              <div className="wz-head-t">{headTitle}</div>
              <button type="button" className="wz-ib" aria-label="Cerrar" title="Cerrar" onClick={onDismiss} disabled={busy}>
                <X className="size-[22px]" aria-hidden />
              </button>
            </div>
          </div>
          <nav aria-label={`Pasos: ${step} de ${steps.length}`} className="wz-steps">
            {steps.map((s, i) => {
              const n = i + 1;
              const done = n < step;
              return (
                <button
                  key={s} type="button"
                  className={`wz-step ${done ? "done" : ""} ${n === step ? "cur" : ""}`}
                  aria-current={n === step ? "step" : undefined}
                  disabled={!done || busy}
                  onClick={() => onStep(n)}
                >
                  <i />
                  <span>{done && <Check className="size-[12px]" aria-hidden />}{s}</span>
                </button>
              );
            })}
          </nav>
          <div ref={bodyRef} className="wz-body">
            <div key={step} className="wz-anim">{children}</div>
          </div>
          <div className="wz-foot">{footer}</div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

/** «Restaurante · Time Out Market · Sáb 21 nov · Sin hora»: what's chosen so far; missing ones dashed. */
export function WizardSummary({ items }: { items: { label: ReactNode; missing?: boolean; key: string }[] }) {
  return (
    <div className="wz-sum" aria-label="Resumen">
      {items.map((it) => <span key={it.key} className={it.missing ? "no" : undefined}>{it.label}</span>)}
    </div>
  );
}

/** «Tipo» + «opcional» section heading. */
export function WizardSection({ title, optional, extra, id }: { title: string; optional?: string | boolean; extra?: ReactNode; id?: string }) {
  return (
    <div className="wz-sec">
      <b id={id}>{title}</b>
      {optional && <span className="wz-opc">{optional === true ? "opcional" : optional}</span>}
      {extra}
    </div>
  );
}

/**
 * Frimee dropdown (design «menu» + «opt»): a field-like button and a listbox in a portal,
 * with arrows, Enter, Escape and the chosen option ticked.
 */
export function WizardSelect<T extends string | number>({
  value, options, onChange, label, compact,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  /** Text-only trigger (currency next to the amount) instead of a full field. */
  compact?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const selIdx = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selIdx];

  const show = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const h = Math.min(options.length * 40 + 10, 260);
    const below = window.innerHeight - r.bottom - 8 >= h || r.top < h;
    const width = Math.max(r.width, 180);
    setPos({ left: Math.min(r.left, window.innerWidth - width - 8), width, ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) });
    setActive(selIdx);
    setOpen(true);
  };
  const close = (focus = true) => { setOpen(false); if (focus) btnRef.current?.focus(); };
  const pick = (i: number) => { onChange(options[i].value); close(); };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const out = (e: PointerEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, [open]);
  useEffect(() => {
    if (open) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pick(active); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  };

  return (
    <>
      <button
        ref={btnRef} type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={`${label}: ${current?.label ?? ""}`}
        className={compact ? "wz-sel-c" : "wz-fld wz-sel"}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => { if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); show(); } }}
      >
        <span className="wz-ell min-w-0 flex-1 text-left">{current?.label}</span>
        <ChevronDown className="size-[18px] shrink-0 text-[var(--text-secondary)]" aria-hidden />
      </button>
      {open && pos && createPortal(
        <ul
          ref={listRef} role="listbox" tabIndex={-1} aria-label={label} data-wz-listbox=""
          aria-activedescendant={`wz-opt-${active}`}
          className="wz wz-menu" style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          onKeyDown={onKey}
        >
          {options.map((o, i) => (
            <li
              key={String(o.value)} id={`wz-opt-${i}`} role="option" aria-selected={i === selIdx}
              className={`wz-opt ${i === active ? "act" : ""} ${i === selIdx ? "sel" : ""}`}
              onPointerEnter={() => setActive(i)} onClick={() => pick(i)}
            >
              <span className="ck">{i === selIdx && <Check className="size-[16px]" aria-hidden />}</span>
              <span className="wz-ell">{o.label}</span>
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
