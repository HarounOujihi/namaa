import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api";

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message;
  }
  if (err instanceof Error && err.message.length > 0) {
    return err.message;
  }
  return "Something went wrong";
}

export function useQuery<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown>): QueryState<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
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
        setError(getErrorMessage(err));
        setLoading(false);
      });
    return () => {
      active = false;
    };
    // The caller declares the reactive inputs; the nonce drives manual reloads.
  }, [...deps, nonce]);

  const reload = useCallback(() => {
    setNonce((current) => current + 1);
  }, []);

  return { data, loading, error, reload };
}
