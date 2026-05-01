"use client";

import { forwardRef } from "react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, placeholder = "Buscar", className = "" }, ref) {
    return (
      <div className={`flex items-center gap-[10px] rounded-full border border-app bg-[var(--search-field-bg)] px-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${className}`}>
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
        {value && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => onChange("")}
            className="shrink-0 text-muted transition-opacity hover:opacity-70"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-[18px]">
              <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
