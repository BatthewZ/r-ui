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

/** What the solo route's anchor holds: `#/solo/<id>[,<id>…][?runway]`. */
export interface SoloRoute {
  /** Section ids (`<group>-<file>`, as on the Overview), in the order to render them. */
  ids: string[];
  /** A viewport of empty page above and below the sections, for checks that need them below the fold or scrolled away. */
  runway: boolean;
}

export function parseSoloAnchor(anchor: string | null): SoloRoute {
  const [list = "", options = ""] = (anchor ?? "").split("?");
  return {
    ids: [...new Set(list.split(",").map((id) => id.trim()).filter(Boolean))],
    runway: options.split("&").includes("runway"),
  };
}

export const soloHref = ({ ids, runway }: SoloRoute) => href("solo", `${ids.join(",")}${runway ? "?runway" : ""}`);
