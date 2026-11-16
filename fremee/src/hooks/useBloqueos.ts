"use client";

import { useCallback, useSyncExternalStore } from "react";
import { bloquearEndpoint, desbloquearEndpoint, misBloqueadosEndpoint } from "@/services/api/endpoints/bloqueos.endpoint";

/**
 * Who I have blocked, shared by every mounted component (profile, chat info, composer, group
 * messages): blocking in one place updates the others at once. Asked once per session.
 */
const VACIO: Set<string> = new Set();
let actual: Set<string> = VACIO;
let cargado: Promise<void> | null = null;
const oyentes = new Set<() => void>();

function publicar(s: Set<string>) {
  actual = s;
  oyentes.forEach((f) => f());
}

function cargar() {
  if (cargado) return;
  cargado = misBloqueadosEndpoint()
    .then((ids) => publicar(new Set(ids)))
    .catch((e) => {
      cargado = null;
      console.error("[bloqueos] Error leyendo a quién has bloqueado:", (e as { message?: string })?.message ?? String(e));
    });
}

function suscribir(f: () => void) {
  oyentes.add(f);
  cargar();
  return () => { oyentes.delete(f); };
}

export function useBloqueos() {
  const bloqueados = useSyncExternalStore(suscribir, () => actual, () => VACIO);

  const bloquear = useCallback(async (id: string) => {
    await bloquearEndpoint(id);
    publicar(new Set(actual).add(id));
  }, []);

  const desbloquear = useCallback(async (id: string) => {
    await desbloquearEndpoint(id);
    const s = new Set(actual);
    s.delete(id);
    publicar(s);
  }, []);

  return { bloqueados, bloquear, desbloquear };
}
