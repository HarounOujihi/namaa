"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/**
 * Minimal fetch-on-mount hook. `deps` are the caller-declared reactive inputs
 * and `enabled: false` skips fetching entirely (the query stays idle).
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options?: { enabled?: boolean },
): QueryState<T> {
  const enabled = options?.enabled !== false;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    fetcherRef
      .current()
      .then((result) => {
        if (!active) {
          return;
        }
        setData(result);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setError(err);
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // The caller declares the reactive inputs; the nonce drives manual reloads.
  }, [...deps, nonce, enabled]);

  const reload = useCallback(() => {
    setNonce((current) => current + 1);
  }, []);

  return { data, loading, error, reload };
}
