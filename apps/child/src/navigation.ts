import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";

/**
 * In-app forward navigations carry the screen they came from, so a header's
 * back button can pop the history entry (exactly like the browser's back)
 * whenever that screen is its logical parent.
 */
export interface BackState {
  backTo?: string;
}

export function backState(from: string): BackState {
  return { backTo: from };
}

export function backToOf(location: Location): string | null {
  const state: unknown = location.state;
  return typeof state === "object" && state !== null && "backTo" in state && typeof state.backTo === "string"
    ? state.backTo
    : null;
}

/** Path + query of a location, as used in `?next=` and `backTo`. */
export function pathOf(location: Pick<Location, "pathname" | "search">): string {
  return `${location.pathname}${location.search}`;
}

/** A `?next=` target is followed only when it is an internal path (`/…`, never `//host`). */
export function safeNext(raw: string | null): string | null {
  return raw !== null && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
}

/** `path?next=<target>` */
export function withNext(path: string, next: string): string {
  return `${path}?next=${encodeURIComponent(next)}`;
}

/**
 * The header back action: pop when this entry was pushed from `parent`,
 * otherwise (deep link, reload, chain of replaced activities) replace the
 * entry with `parent`.
 */
export function useBack(parent: string): () => void {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback((): void => {
    if (backToOf(location) === parent) {
      void navigate(-1);
      return;
    }
    void navigate(parent, { replace: true });
  }, [navigate, location, parent]);
}
