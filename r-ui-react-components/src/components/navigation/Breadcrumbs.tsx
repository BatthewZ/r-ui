"use client";
import { ChevronRight, Ellipsis } from "lucide-react";
import {
  Children,
  type ComponentPropsWithRef,
  type ElementType,
  isValidElement,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";

import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { cn, type SlotClassNames } from "../../util/style";

export type BreadcrumbsProps = {
  /** The navigation landmark's name. Default "Breadcrumb". */
  label?: string;
  /**
   * Collapse the middle crumbs behind a "more" button when there are more than
   * this many. Default: never collapse.
   */
  maxItems?: number;
  /** Crumbs kept before the collapsed run. Default 1. */
  itemsBeforeCollapse?: number;
  /** Crumbs kept after the collapsed run. Default 2. */
  itemsAfterCollapse?: number;
  /** Accessible name of the "more" button. Default "Show N more". */
  expandLabel?: (hidden: number) => string;
  classNames?: SlotClassNames<"list" | "item" | "separator" | "expand">;
} & ComponentPropsWithRef<"nav">;

const defaultExpandLabel = (hidden: number) => `Show ${hidden} more`;

/**
 * The trail from the root to the current page: `Breadcrumbs.Item`s, the last one
 * `current`. A long trail can collapse its middle into one button that expands it
 * in place and moves focus to the first crumb it revealed.
 */
function BreadcrumbsRoot({
  label = "Breadcrumb",
  maxItems,
  itemsBeforeCollapse = 1,
  itemsAfterCollapse = 2,
  expandLabel = defaultExpandLabel,
  className,
  classNames,
  children,
  ...props
}: BreadcrumbsProps) {
  const crumbs = Children.toArray(children).filter(isValidElement);
  const [expanded, setExpanded] = useState(false);
  const revealRef = useRef<HTMLLIElement>(null);
  const focusReveal = useRef(false);

  const before = Math.max(0, itemsBeforeCollapse);
  const after = Math.max(0, itemsAfterCollapse);
  const hidden = crumbs.length - before - after;
  const collapsed = !expanded && maxItems !== undefined && crumbs.length > maxItems && hidden > 1;

  useEffect(() => {
    if (!expanded || !focusReveal.current) return;
    focusReveal.current = false;
    revealRef.current?.querySelector<HTMLElement>("a, button, [tabindex]")?.focus();
  }, [expanded]);

  const separator = (
    <ChevronRight aria-hidden className={cn("size-icon shrink-0 text-fg-muted rtl:-scale-x-100", classNames?.separator)} />
  );

  const item = (node: ReactNode, index: number, ref?: Ref<HTMLLIElement>) => (
    <li key={index} ref={ref} className={cn("inline-flex min-w-0 items-center gap-r5", classNames?.item)}>
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
            aria-label={expandLabel(hidden)}
            className={cn(
              "hit-area inline-flex items-center rounded-sm px-r6 text-fg-secondary hover:bg-fg-primary/8 hover:text-fg-primary",
              classNames?.expand,
            )}
            onClick={() => {
              focusReveal.current = true;
              setExpanded(true);
            }}
          >
            <Ellipsis aria-hidden className="size-icon" />
          </button>
        </li>,
        ...crumbs.slice(crumbs.length - after).map((node, i) => item(node, crumbs.length - after + i)),
      ]
    : crumbs.map((node, i) => item(node, i, i === before ? revealRef : undefined));

  return (
    <nav aria-label={label} className={className} {...props}>
      <ol className={cn("flex flex-wrap items-center gap-x-r5 gap-y-r6 text-body-2", classNames?.list)}>{items}</ol>
    </nav>
  );
}

export type BreadcrumbsItemProps<C extends ElementType = "a"> = PolymorphicProps<
  C,
  {
    /** The page this trail ends on: `aria-current="page"`, not styled as a link. */
    current?: boolean;
    children?: ReactNode;
  }
>;

/**
 * One crumb: a link (`<a>`, or `as={RouterLink}`), or plain text when it has no
 * `href` and no `as`.
 */
function BreadcrumbsItem<C extends ElementType = "a">({
  as,
  current = false,
  className,
  ...props
}: BreadcrumbsItemProps<C>) {
  const isLink = as !== undefined || (props as { href?: string }).href !== undefined;
  const Component: ElementType = as ?? (isLink ? "a" : "span");
  return (
    <Component
      aria-current={current ? "page" : undefined}
      {...props}
      className={cn(
        "min-w-0 break-words",
        current
          ? "font-medium text-fg-primary"
          : isLink
            ? "hit-area rounded-sm text-fg-secondary hover:text-fg-primary hover:underline"
            : "text-fg-secondary",
        className,
      )}
    />
  );
}

export const Breadcrumbs = Object.assign(BreadcrumbsRoot, { Item: BreadcrumbsItem });
