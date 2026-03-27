"use client";

import { useEffect, useRef, useState } from "react";

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
}: {
  value: string;
  onChange: (v: string, coords?: Coords) => void;
  placeholder?: string;
  className?: string;
}) {
  const [mapsReady, setMapsReady] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.places?.AutocompleteSuggestion) { setMapsReady(true); return; }
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
    <div className={`relative flex-1 ${className ?? ""}`}>
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full border-none bg-transparent text-body outline-none ring-0 focus:border-none focus:outline-none focus:ring-0 placeholder:text-muted"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute top-[calc(100%+8px)] left-0 z-[90] w-full max-h-[220px] overflow-y-auto scrollbar-thin rounded-[12px] border border-app bg-surface shadow-elev-4">
          {suggestions.slice(0, 5).map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); void handleSelect(s); }}
              className="cursor-pointer px-[var(--space-3)] py-[var(--space-3)] hover:bg-surface-inset"
            >
              <p className="text-body-sm font-[var(--fw-medium)] text-primary">{s.placePrediction.mainText.toString()}</p>
              <p className="text-caption text-muted">{s.placePrediction.secondaryText?.toString() ?? ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
