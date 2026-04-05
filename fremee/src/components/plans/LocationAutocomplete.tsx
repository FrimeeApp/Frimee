"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";

type PlaceSuggestion = {
  placePrediction: {
    text: { toString(): string };
    mainText: { toString(): string };
    secondaryText?: { toString(): string };
    toPlace(): { fetchFields(opts: { fields: string[] }): Promise<void>; location?: { lat(): number; lng(): number } };
  };
};

export type Coords = { lat: number; lng: number };

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = "¿Dónde será?",
  className,
  onCommit,
  onEnter,
}: {
  value: string;
  onChange: (v: string, coords?: Coords) => void;
  placeholder?: string;
  className?: string;
  onCommit?: () => void;
  onEnter?: () => void;
}) {
  const [mapsReady, setMapsReady] = useState(
    () =>
      typeof window !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Boolean((window as any).google?.maps?.places?.AutocompleteSuggestion)
  );
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = typeof document !== "undefined";

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.places?.AutocompleteSuggestion) return;
    if (document.getElementById("google-maps-script")) {
      const existing = document.getElementById("google-maps-script");
      existing?.addEventListener("load", () => setMapsReady(true));
      return;
    }
    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&v=weekly&libraries=places,geometry`;
    script.async = true;
    script.onload = () => setMapsReady(true);
    document.head.appendChild(script);
  }, []);

  // Recalculate dropdown position whenever it opens or window scrolls/resizes
  useEffect(() => {
    if (!open || !wrapperRef.current) return;
    const updatePos = () => {
      if (!wrapperRef.current) return;
      // Use the parent container (includes leading icon) for full-width alignment
      const anchor = wrapperRef.current.parentElement ?? wrapperRef.current;
      const rect = anchor.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, suggestions]);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) { setSuggestions([]); setOpen(false); return; }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { suggestions: results } = await (window as any).google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input });
      setSuggestions(results ?? []);
      setOpen((results ?? []).length > 0);
    } catch { setSuggestions([]); }
  };

  const handleSelect = async (s: PlaceSuggestion) => {
    const text = s.placePrediction.text.toString();
    onChange(text);
    setSuggestions([]);
    setOpen(false);
    onCommit?.();
    try {
      const place = s.placePrediction.toPlace();
      await place.fetchFields({ fields: ["location"] });
      if (place.location) {
        onChange(text, { lat: place.location.lat(), lng: place.location.lng() });
      }
    } catch { /* coords unavailable, geocoding will be used as fallback */ }
  };

  const handleChange = (v: string) => {
    onChange(v);
    if (!mapsReady) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  };

  return (
    <div ref={wrapperRef} className={`relative flex-1 ${className ?? ""}`}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); setOpen(false); onEnter?.(); }
        }}
        placeholder={placeholder}
        className="w-full border-none bg-transparent text-body outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 placeholder:text-muted"
      />
      {isMounted && open && suggestions.length > 0 && createPortal(
        <ul
          style={dropdownStyle}
          className="rounded-[12px] border-0 bg-transparent shadow-none max-md:rounded-none"
        >
          {suggestions.slice(0, 5).map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); void handleSelect(s); }}
              className="flex cursor-pointer items-center gap-[var(--space-3)] px-[var(--space-3)] py-[var(--space-3)] hover:bg-surface"
            >
              <MapPin className="size-4 shrink-0 text-muted" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="truncate text-body-sm font-[var(--fw-medium)] text-app">{s.placePrediction.mainText.toString()}</p>
                <p className="truncate text-caption text-muted">{s.placePrediction.secondaryText?.toString() ?? ""}</p>
              </div>
            </li>
          ))}
        </ul>,
        document.body
      )}
    </div>
  );
}
