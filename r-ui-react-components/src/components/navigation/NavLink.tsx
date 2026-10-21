"use client";
import type { ElementType, ReactNode } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { useIsCurrent, useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { safeUrl } from "../../util/url";

export interface NavLinkOwnProps {
  /** Decorative icon (give it `aria-hidden`); the label is the accessible name. */
  icon?: ReactNode;
  /**
   * This item is the current page: sets `aria-current="page"` and draws the
   * accent marker. Unset, the `RouterProvider`'s `isCurrent(href)` decides.
   */
  current?: boolean;
  /** A count or short status after the label, read as part of the item's name. */
  badge?: ReactNode;
  /** `item` is the `<li>`; `className` and every other prop go to the link itself. */
  classNames?: SlotClassNames<"item" | "icon" | "label" | "badge">;
  children?: ReactNode;
}

export type NavLinkProps<C extends ElementType = "a"> = PolymorphicProps<C, NavLinkOwnProps>;

/**
 * The link row shared by `AppShell.NavItem` and `NavList.Item`: a list item
 * holding the router's link (`RouterProvider`), an `<a>`, or `as`, with the
 * accent "you are here" marker. `href` passes through `safeUrl`: a refused
 * scheme (`javascript:` …) is dropped, and the item still renders, as text that
 * goes nowhere.
 * Where it sits decides its form: a sidebar row, an icon-rail button, or a
 * bottom-nav tab (see the navigation stylesheet).
 */
export function NavLink<C extends ElementType = "a">({
  as,
  icon,
  current: currentProp,
  badge,
  className,
  classNames,
  children,
  ...given
}: NavLinkProps<C>) {
  const givenHref = (given as { href?: unknown }).href;
  // Replace the key only when the caller passed one: an `href: undefined` key
  // would override an `as` component's own href.
  const href = typeof givenHref === "string" ? safeUrl(givenHref) || undefined : givenHref;
  const props = typeof givenHref === "string" ? { ...given, href } : given;
  const Component = useLinkElement(as, href);
  const current = useIsCurrent(currentProp, href);
  return (
    <li className={classNames?.item}>
      <Component
        aria-current={current ? "page" : undefined}
        {...props}
        className={cn("r-navigation-link", className)}
      >
        {icon != null && <span className={cn("r-navigation-link-icon", classNames?.icon)}>{icon}</span>}
        <span className={cn("r-navigation-link-label", classNames?.label)}>{children}</span>
        {/* A text space, so the accessible name reads "Incidents 4", not "Incidents4". */}
        {badge != null && " "}
        {badge != null && <span className={cn("r-navigation-link-badge", classNames?.badge)}>{badge}</span>}
      </Component>
    </li>
  );
}
