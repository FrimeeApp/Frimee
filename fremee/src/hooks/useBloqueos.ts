"use client";

import { useCallback, useSyncExternalStore } from "react";
import { bloquearEndpoint, desbloquearEndpoint, misBloqueadosEndpoint } from "@/services/api/endpoints/bloqueos.endpoint";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

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

// Per account: on sign-out or another account signing in on the same tab, it starts over (and a
// first fetch that ran before the session existed is retried once the session is there).
let usuario: string | null | undefined;
let escuchandoSesion = false;
function seguirSesion() {
  if (escuchandoSesion) return;
  escuchandoSesion = true;
  createBrowserSupabaseClient().auth.onAuthStateChange((_event, session) => {
    const id = session?.user?.id ?? null;
    if (id === usuario) return;
    usuario = id;
    cargado = null;
    publicar(VACIO);
    if (id && oyentes.size > 0) cargar();
  });
}

function suscribir(f: () => void) {
  oyentes.add(f);
  seguirSesion();
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
