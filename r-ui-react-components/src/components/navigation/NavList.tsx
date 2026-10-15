"use client";
import { type ComponentPropsWithRef, type ElementType, type ReactNode, useId } from "react";

import { cn } from "../../util/style";
import { NavLink, type NavLinkProps } from "./NavLink";

export type NavListProps = {
  /** The navigation landmark's name, e.g. "Settings". */
  label: string;
} & ComponentPropsWithRef<"nav">;

/**
 * A vertical list of links for a settings or docs page: `NavList.Item`s, grouped
 * by `NavList.Section`s if needed. The current item carries the accent marker.
 */
function NavListRoot({ label, className, children, ...props }: NavListProps) {
  return (
    <nav aria-label={label} className={cn("min-w-0", className)} {...props}>
      <ul className="flex flex-col gap-r6">{children}</ul>
    </nav>
  );
}

export type NavListSectionProps = {
  /** The group's heading. */
  title: ReactNode;
} & ComponentPropsWithRef<"li">;

/** A titled group of items. */
function NavListSection({ title, className, children, ...props }: NavListSectionProps) {
  const titleId = useId();
  return (
    <li className={cn("flex flex-col gap-r6 not-first:mt-r3", className)} {...props}>
      <div id={titleId} className="px-r4 pb-r6 text-body-3 font-medium text-fg-muted">
        {title}
      </div>
      <ul aria-labelledby={titleId} className="flex flex-col gap-r6">
        {children}
      </ul>
    </li>
  );
}

export type NavListItemProps<C extends ElementType = "a"> = NavLinkProps<C>;

/** One link: the router's link, an `<a>`, or `as`. `current` (or the router's `isCurrent`) marks the page you are on. */
function NavListItem<C extends ElementType = "a">(props: NavListItemProps<C>) {
  return <NavLink {...props} />;
}

export const NavList = Object.assign(NavListRoot, { Section: NavListSection, Item: NavListItem });
