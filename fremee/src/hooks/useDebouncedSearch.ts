"use client";

import { useState, useEffect } from "react";

/**
 * Runs `searchFn` after `delay` ms whenever `query` changes.
 * Cancels in-flight requests when `query` changes or the component unmounts.
 * Returns empty results (not loading) when `query` is shorter than `minLength`.
 */
export function useDebouncedSearch<T>(
  query: string,
  searchFn: (q: string) => Promise<T[]>,
  { delay = 250, minLength = 2, enabled = true }: { delay?: number; minLength?: number; enabled?: boolean } = {}
) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || query.trim().length < minLength) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await searchFn(query.trim());
        if (!cancelled) setResults(data);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, searchFn, delay, minLength, enabled]);

  return { results, loading };
}
