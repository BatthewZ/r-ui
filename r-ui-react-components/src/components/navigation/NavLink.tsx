import type { ElementType, ReactNode } from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn, type SlotClassNames } from "../../util/style";

export interface NavLinkOwnProps {
  /** Decorative icon (give it `aria-hidden`); the label is the accessible name. */
  icon?: ReactNode;
  /** This item is the current page: sets `aria-current="page"` and draws the accent marker. */
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
 * holding an `<a>` (or `as={RouterLink}`), with the accent "you are here" marker.
 * Where it sits decides its form: a sidebar row, an icon-rail button, or a
 * bottom-nav tab (see the navigation stylesheet).
 */
export function NavLink<C extends ElementType = "a">({
  as,
  icon,
  current = false,
  badge,
  className,
  classNames,
  children,
  ...props
}: NavLinkProps<C>) {
  const Component: ElementType = as ?? "a";
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
