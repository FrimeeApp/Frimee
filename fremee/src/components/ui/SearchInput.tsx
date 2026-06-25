"use client";

import { forwardRef, type ReactNode } from "react";
import { CloseX } from "@/components/ui/CloseX";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  emptyAction?: ReactNode;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, placeholder = "Buscar", className = "", emptyAction }, ref) {
    return (
      <div className={`flex items-center gap-[10px] rounded-full border border-app bg-[var(--search-field-bg)] px-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-transform duration-150 ease-out active:translate-y-[1px] active:scale-[0.99] ${className}`}>
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px] shrink-0 text-muted">
          <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16 16L20.5 20.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 border-none bg-transparent text-body-sm font-[400] text-app shadow-none outline-none ring-0 focus:border-none focus:shadow-none focus:outline-none focus:ring-0 placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {value ? (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => onChange("")}
            className="-mr-3 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-[opacity,transform] duration-150 ease-out hover:opacity-70 active:scale-90"
          >
            <CloseX />
          </button>
        ) : emptyAction}
      </div>
    );
  }
);
