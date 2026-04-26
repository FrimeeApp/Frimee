"use client";

import { useRef, useEffect, useState, useCallback } from "react";

export interface TabDef {
  value: string;
  label: string;
  badge?: React.ReactNode;
}

interface TabsProps {
  tabs: TabDef[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  fontWeight?: string;
}

export function Tabs({ tabs, value, onChange, className = "", fontWeight }: TabsProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });

  const measure = useCallback(() => {
    const row = rowRef.current;
    const target = buttonRefs.current.get(value);
    if (!row || !target) return;
    const rowRect = row.getBoundingClientRect();
    const tabRect = target.getBoundingClientRect();
    setIndicator({ left: tabRect.left - rowRect.left, width: tabRect.width, ready: true });
  }, [value]);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div
      ref={rowRef}
      className={`relative flex gap-[var(--space-5)] border-b border-app pb-[var(--space-2)] text-body text-muted ${className}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          ref={(el) => {
            if (el) buttonRefs.current.set(tab.value, el);
            else buttonRefs.current.delete(tab.value);
          }}
          onClick={() => onChange(tab.value)}
          className={`flex items-center gap-[var(--space-1)] transition-colors duration-[220ms] ${
            value === tab.value ? "text-app" : "hover:text-app"
          }`}
          style={fontWeight ? { fontWeight } : undefined}
        >
          {tab.label}
          {tab.badge}
        </button>
      ))}
      <span
        className={`pointer-events-none absolute bottom-0 h-[1.5px] bg-[var(--text-primary)] transition-[left,width,opacity] duration-[220ms] [transition-timing-function:var(--ease-standard)] ${
          indicator.ready ? "opacity-100" : "opacity-0"
        }`}
        style={{ left: indicator.left, width: indicator.width }}
        aria-hidden="true"
      />
    </div>
  );
}
