"use client";
import { ChevronRight, Ellipsis } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type ElementType,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { elementChildren } from "../../util/children";
import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { useIsCurrent, useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { type LabelsProp, useLabels } from "../../util/locale";
import { safeUrl } from "../../util/url";

export interface BreadcrumbsLabels {
  /** The navigation landmark's name. */
  nav: string;
  /** The accessible name of the button standing in for `hidden` collapsed crumbs. */
  expand: (hidden: number) => string;
}

export const DEFAULT_BREADCRUMBS_LABELS: BreadcrumbsLabels = {
  nav: "Breadcrumb",
  expand: (hidden) => `Show ${hidden} more`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Breadcrumbs: BreadcrumbsLabels;
  }
}

export type BreadcrumbsProps = {
  /**
   * Collapse the middle crumbs behind a "more" button when there are more than
   * this many. Default: never collapse.
   */
  maxItems?: number;
  /** Crumbs kept before the collapsed run. Default 1. */
  itemsBeforeCollapse?: number;
  /** Crumbs kept after the collapsed run. Default 2. */
  itemsAfterCollapse?: number;
  labels?: LabelsProp<BreadcrumbsLabels>;
  classNames?: SlotClassNames<"list" | "item" | "separator" | "expand">;
} & ComponentPropsWithRef<"nav">;

/**
 * The trail from the root to the current page: `Breadcrumbs.Item`s, the last one
 * `current`. A long trail can collapse its middle into one button that expands it
 * in place and moves focus to the first crumb it revealed (its link, or the
 * crumb itself when it is plain text).
 */
function BreadcrumbsRoot({
  labels: labelsProp,
  maxItems,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 2,
  className,
  classNames,
  children,
  ...props
}: BreadcrumbsProps) {
  const labels = useLabels("Breadcrumbs", DEFAULT_BREADCRUMBS_LABELS, labelsProp);
  const crumbs = elementChildren(children);
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  /** How many crumbs the expand button stood for, while focus waits to land on them. */
  const revealed = useRef(0);
  const focusReveal = useRef(false);

  const before = Math.max(0, itemsBeforeCollapse);
  const after = Math.max(0, itemsAfterCollapse);
  const hidden = crumbs.length - before - after;
  const collapsed = !expanded && maxItems !== undefined && crumbs.length > maxItems && hidden > 1;

  // The button that had focus is gone: focus the first revealed crumb that can
  // take it, else the first revealed crumb itself, so focus never drops to <body>.
  useEffect(() => {
    const count = revealed.current;
    if (!expanded || count === 0) return;
    revealed.current = 0;
    const run = Array.from(listRef.current?.children ?? []).slice(before, before + count) as HTMLElement[];
    const target = run
      .map((li) => li.querySelector<HTMLElement>('a[href], button, input, [tabindex]:not([tabindex="-1"])'))
      .find((el) => el !== null);
    if (target) return target.focus();
    const first = run[0];
    if (!first) return;
    first.tabIndex = -1;
    first.focus();
  }, [expanded, before]);

  const separator = (
    <ChevronRight aria-hidden className={cn("size-icon shrink-0 text-fg-muted rtl:-scale-x-100", classNames?.separator)} />
  );

  const item = (node: ReactNode, index: number) => (
    <li key={index} className={cn("inline-flex min-w-0 items-center gap-r5", classNames?.item)}>
      {index > 0 && separator}
      {node}
    </li>
  );

  const items = collapsed
    ? [
        ...crumbs.slice(0, before).map((node, i) => item(node, i)),
        <li key="expand" className={cn("inline-flex items-center gap-r5", classNames?.item)}>
          {before > 0 && separator}
          <button
            type="button"
            aria-label={labels.expand(hidden)}
            className={cn(
              "hit-area inline-flex items-center rounded-sm px-r6 text-fg-secondary hover:bg-fg-primary/8 hover:text-fg-primary",
              classNames?.expand,
            )}
            onClick={() => {
              revealed.current = hidden;
              setExpanded(true);
            }}
          >
            <Ellipsis aria-hidden className="size-icon" />
          </button>
        </li>,
        ...crumbs.slice(crumbs.length - after).map((node, i) => item(node, crumbs.length - after + i)),
      ]
    : crumbs.map((node, i) => item(node, i));

  return (
    <nav aria-label={labels.nav} className={className} {...props}>
      <ol ref={listRef} className={cn("flex flex-wrap items-center gap-x-r5 gap-y-r6 text-body-2", classNames?.list)}>{items}</ol>
    </nav>
  );
}

export type BreadcrumbsItemProps<C extends ElementType = "a"> = PolymorphicProps<
  C,
  {
    /**
     * The page this trail ends on: `aria-current="page"`, not styled as a link.
     * Unset, the `RouterProvider`'s `isCurrent(href)` decides.
     */
    current?: boolean;
    children?: ReactNode;
  }
>;

/**
 * One crumb: a link (the router's link, an `<a>`, or `as`), or plain text when
 * it has no `href` and no `as`. `href` passes through `safeUrl`: a refused
 * scheme (`javascript:` …) is dropped, so the crumb reads as plain text.
 */
function BreadcrumbsItem<C extends ElementType = "a">({
  as,
  current: currentProp,
  className,
  ...rest
}: BreadcrumbsItemProps<C>) {
  const given = (rest as { href?: unknown }).href;
  const href = typeof given === "string" ? safeUrl(given) || undefined : given;
  // Only a given href is replaced: an `undefined` key would override an `as` link's own.
  const props = typeof given === "string" ? { ...rest, href } : rest;
  const isLink = as !== undefined || href !== undefined;
  const Component = useLinkElement(as, href, "span");
  const current = useIsCurrent(currentProp, href);
  return (
    <Component
      aria-current={current ? "page" : undefined}
      {...props}
      className={cn(
        "min-w-0 break-words",
        current
          ? "font-medium text-fg-primary"
          : isLink
            ? "hit-area rounded-sm text-fg-secondary hover:text-fg-primary hover:underline forced-colors:text-fg-accent"
            : "text-fg-secondary",
        className,
      )}
    />
  );
}

export const Breadcrumbs = Object.assign(BreadcrumbsRoot, { Item: BreadcrumbsItem });
