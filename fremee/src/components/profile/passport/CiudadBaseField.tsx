"use client";

import { useEffect, useRef, useState } from "react";
import LocationAutocomplete from "@/components/plans/LocationAutocomplete";
import { fetchCiudadBase, saveCiudadBase } from "@/services/api/endpoints/pasaporte.endpoint";

/** Campo de Ajustes: ciudad donde vives. Se guarda al elegir una sugerencia o al salir del campo; vacío la borra. */
export default function CiudadBaseField({ disabled }: { disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const saved = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCiudadBase()
      .then((c) => {
        if (cancelled) return;
        saved.current = c ?? "";
        setValue(c ?? "");
      })
      .catch(() => { /* sin dato: el campo queda vacío */ });
    return () => { cancelled = true; };
  }, []);

  async function commit(next: string) {
    const clean = next.trim().slice(0, 80);
    if (saved.current === null || clean === saved.current) return;
    try {
      const stored = await saveCiudadBase(clean);
      saved.current = stored ?? "";
      setValue(stored ?? "");
      setError(false);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="w-[min(240px,50vw)]">
      <LocationAutocomplete
        value={value}
        onChange={(v) => !disabled && setValue(v)}
        onPick={(p) => { setValue(p.main); void commit(p.main); }}
        onCommit={() => void commit(value)}
        placeholder="Tu ciudad"
        dropdownVariant="surface"
        inputClassName="h-10 text-[14px]"
      />
      {error && <p role="alert" className="m-0 mt-1 text-[13px] text-[var(--error)]">No se pudo guardar. Inténtalo de nuevo.</p>}
    </div>
  );
}
