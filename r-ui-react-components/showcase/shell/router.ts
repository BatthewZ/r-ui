import { useSyncExternalStore } from "react";

/**
 * Hash routes: `#/overview`, `#/dashboard`, … An optional second segment names
 * an in-page anchor (`#/overview/form-button`), so the Overview TOC deep-links
 * without fighting the router for the hash.
 */
export interface Route {
  page: string;
  anchor: string | null;
}

export function parseHash(hash: string, fallback: string): Route {
  const [page, anchor] = hash.replace(/^#\/?/, "").split("/");
  return { page: page || fallback, anchor: anchor ? decode(anchor) : null };
}

/** A malformed escape (a typed `%`) would throw during render and blank the app; keep it as written. */
function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export const href = (page: string, anchor?: string) =>
  `#/${page}${anchor ? `/${encodeURIComponent(anchor)}` : ""}`;

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHashRoute(fallback: string): Route {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  return parseHash(hash, fallback);
}
