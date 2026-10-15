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
   * (and `ref`). A router whose link takes `to` is adapted once:
   * `const AppLink = ({ href, ...props }) => <RouterLink to={href} {...props} />`,
   * declared at module scope (a component made during render remounts every
   * link). Default: a plain `<a>`.
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
 * Whether `href` leaves the app, so the router's link must not handle it: a
 * scheme (`https:`, `mailto:`) or a protocol-relative `//host`.
 */
export function isExternalHref(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//");
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
