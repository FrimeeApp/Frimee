"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, UserPlus, CalendarCheck, PartyPopper } from "lucide-react";
import React from "react";

const steps = [
  { step: "01", icon: Plus, title: "Crear", desc: "Nuevo plan en segundos" },
  { step: "02", icon: UserPlus, title: "Invitar", desc: "Directo al grupo" },
  { step: "03", icon: CalendarCheck, title: "Organizar", desc: "Gastos, tickets e ideas" },
  { step: "04", icon: PartyPopper, title: "Disfrutar", desc: "Sin estrés" },
];

export default function FlowStepper() {
  const [active, setActive] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const stepperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stepper = stepperRef.current;
    const section = stepper?.closest("section");

    if (!section) {
      setHasStarted(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setHasStarted(true);
        observer.disconnect();
      },
      { threshold: 0.25 },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasStarted || allDone) return;
    const timer = setTimeout(() => {
      if (active >= steps.length - 1) {
        setAllDone(true);
      } else {
        setActive((prev) => prev + 1);
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [active, allDone, hasStarted]);

  return (
    <div ref={stepperRef} className="v3-stepper-h">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isActive = !allDone && i === active;
        const isDone = allDone || i < active;
        return (
          <React.Fragment key={s.step}>
            <div className={`v3-stepper-h-step${isActive ? " active" : ""}${isDone ? " done" : ""}`}>
              <div className="v3-stepper-h-circle">
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <Icon size={14} strokeWidth={2.5} />
                )}
              </div>
              <div className="v3-stepper-h-label">
                <p className="v3-stepper-h-title">{s.title}</p>
                <p className="v3-stepper-h-desc">{s.desc}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="v3-stepper-h-line">
                <div
                  className="v3-stepper-h-line-fill"
                  style={{ width: active > i ? "100%" : "0%" }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
