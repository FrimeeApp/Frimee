"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { fetchSubplanes, type SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";

const DESKTOP_QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Same breakpoint as the app's `md:`. The phone layout and the desktop one differ too much for CSS alone. */
export function useIsDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
}

/** Activities per plan, kept while the calendar is open (it goes back and forth between weeks). */
const cache = new Map<number, SubplanRow[]>();
const inflight = new Map<number, Promise<SubplanRow[]>>();

/** Called when the calendar opens, so activities added in a plan meanwhile show up. */
export function resetPlanActivities() {
  cache.clear();
}

function load(planId: number) {
  let p = inflight.get(planId);
  if (!p) {
    p = fetchSubplanes(planId)
      .then((rows) => {
        cache.set(planId, rows);
        return rows;
      })
      .finally(() => inflight.delete(planId));
    inflight.set(planId, p);
  }
  return p;
}

/**
 * Activities of the given plans. While some are loading, the ones already cached are returned;
 * `failed` lists the plans whose activities could not be loaded.
 */
export function usePlanActivities(planIds: number[]) {
  const key = useMemo(() => [...new Set(planIds)].sort((a, b) => a - b).join(","), [planIds]);
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState<number[]>([]);

  useEffect(() => {
    const ids = key ? key.split(",").map(Number) : [];
    const missing = ids.filter((id) => !cache.has(id));
    if (!missing.length) return;
    let cancelled = false;
    void Promise.allSettled(missing.map(load)).then((results) => {
      if (cancelled) return;
      const bad = missing.filter((_, i) => results[i].status === "rejected");
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          const e = r.reason as { message?: string; code?: string };
          console.error("[calendario] actividades", missing[i], e?.code, e?.message ?? String(r.reason));
        }
      });
      setFailed(bad);
      setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return useMemo(() => {
    const ids = key ? key.split(",").map(Number) : [];
    const byPlan = new Map<number, SubplanRow[]>();
    for (const id of ids) {
      const rows = cache.get(id);
      if (rows) byPlan.set(id, rows);
    }
    return { byPlan, loading: ids.some((id) => !cache.has(id) && !failed.includes(id)), failed };
    // version: re-read the cache after a load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, failed]);
}
