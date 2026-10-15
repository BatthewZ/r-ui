"use client";
import { createContext, type ElementType, type ReactNode, useContext, useMemo } from "react";

/**
 * The app's router, configured once. Every component that renders an internal
 * link (`Link`, `NavList.Item`, `AppShell.NavItem`, `AppShell.Brand`,
 * `Breadcrumbs.Item`, `Pagination` with `getHref`) reads it, so a consumer never
 * threads `as={RouterLink}` through each one. An explicit `as` or `current` on a
 * component still wins.
 */
export interface RouterConfig {
  /**
   * Renders an internal link. It receives `href` and the anchor's other props
   * (and `ref`). A router whose link takes `to` is adapted once, at module
   * scope (a component made during render remounts every link):
   *
   * ```tsx
   * function AppLink({ href, ...props }: ComponentPropsWithRef<"a"> & { href: string }) {
   *   return <RouterLink to={href} {...props} />;
   * }
   * ```
   *
   * Default: a plain `<a>`.
   */
  link?: ElementType;
  /**
   * Whether `href` is the page being shown. Navigation items with no explicit
   * `current` ask this to set `aria-current="page"` and the accent marker.
   */
  isCurrent?: (href: string) => boolean;
}

export type RouterProviderProps = RouterConfig & { children?: ReactNode };

interface ResolvedRouter {
  link: ElementType;
  isCurrent: (href: string) => boolean;
}

const never = () => false;
const DEFAULT_ROUTER: ResolvedRouter = { link: "a", isCurrent: never };

const RouterContext = createContext<ResolvedRouter>(DEFAULT_ROUTER);

/** Sets the router for every link-rendering component beneath it. */
export function RouterProvider({ link, isCurrent, children }: RouterProviderProps) {
  const value = useMemo(() => ({ link: link ?? "a", isCurrent: isCurrent ?? never }), [link, isCurrent]);
  return <RouterContext value={value}>{children}</RouterContext>;
}

/** The configured router (a plain `<a>` and "nothing is current" outside any provider). */
export function useRouter(): ResolvedRouter {
  return useContext(RouterContext);
}

/**
 * Stand-in app origins. A relative href stays on whichever one it resolves
 * against; an absolute URL can stay on at most one, so it never passes both.
 */
const APP_ORIGINS = ["http://app.invalid", "https://app.invalid"];

/**
 * Whether `href` leaves the app, so the router's link must not handle it: a
 * scheme (`https:`, `mailto:`) or another host. Judged by resolving it as a
 * browser does, so `/\host`, `///host`, ` //host` and `/<tab>/host` are other
 * hosts too; an href that does not parse counts as leaving.
 */
export function isExternalHref(href: string): boolean {
  return APP_ORIGINS.some((origin) => {
    try {
      return new URL(href, origin).origin !== origin;
    } catch {
      return true;
    }
  });
}

/**
 * What an internal-link part renders: the caller's `as` if given, else the
 * router's link for an internal `href`, else `fallback` (`"a"` for a link part,
 * `"span"` for a crumb with no href).
 */
export function useLinkElement(as: ElementType | undefined, href: unknown, fallback: ElementType = "a"): ElementType {
  const { link } = useRouter();
  if (as !== undefined) return as;
  if (typeof href === "string" && !isExternalHref(href)) return link;
  return typeof href === "string" ? "a" : fallback;
}

/**
 * `current` as the caller said, or the router's verdict on `href` when the
 * caller said nothing.
 */
export function useIsCurrent(current: boolean | undefined, href: unknown): boolean {
  const { isCurrent } = useRouter();
  if (current !== undefined) return current;
  return typeof href === "string" && isCurrent(href);
}
