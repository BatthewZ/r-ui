"use client";

import { type ComponentPropsWithRef, createContext, type ElementType, type ReactNode, useContext } from "react";

import { useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { safeUrl } from "../../util/url";
import { Grid, type GridColumnMap, type GridColumns, type GridMinColumn, type Space } from "../layout";

/** A feature title's heading level in the page outline. The look is the same at every level. */
export type FeatureHeadingLevel = 2 | 3 | 4 | 5 | 6;

/**
 * - `plain` (default): no chrome; the items sit on whatever is behind them.
 * - `card`: each item is a bordered card on `--C-SURFACE-0`.
 */
export type FeatureGridVariant = "plain" | "card";

interface FeatureGridContextValue {
  headingLevel: FeatureHeadingLevel;
  variant: FeatureGridVariant;
}

const FeatureGridContext = createContext<FeatureGridContextValue | null>(null);

/** Two columns from a 36rem container, three from 56rem: six features read as two even rows. */
const DEFAULT_COLUMNS: GridColumnMap = { base: 1, "@xl": 2, "@4xl": 3 };

export type FeatureGridProps = {
  /** Every item title's heading level (default 3). */
  headingLevel?: FeatureHeadingLevel;
  variant?: FeatureGridVariant;
  /**
   * Column counts by the GRID's own width (default one, two from `@xl`, three
   * from `@4xl`). Pass `minColumn` instead to auto-fit as many as fit.
   */
  columns?: GridColumns | GridColumnMap;
  /** Auto-fits columns at this floor (`--COLUMN-*`) instead of fixed counts. */
  minColumn?: GridMinColumn;
  /** Space between items (default `r1` plain, `r2` card). */
  gap?: Space;
  /** `FeatureGrid.Item` elements. */
  children?: ReactNode;
  classNames?: SlotClassNames<"container">;
} & Omit<ComponentPropsWithRef<"ul">, "children">;

/**
 * A grid of features: each an icon, a title and a sentence or two, optionally
 * a link. A list (`<ul>`) on the layout `Grid`, so its columns follow the
 * grid's OWN width, never the viewport. `className` and every other prop go to
 * the list; the size container around it is `classNames.container`.
 */
function FeatureGridRoot({
  headingLevel = 3,
  variant = "plain",
  columns,
  minColumn,
  gap,
  classNames,
  children,
  ...props
}: FeatureGridProps) {
  return (
    <FeatureGridContext value={{ headingLevel, variant }}>
      <Grid
        as="ul"
        gap={gap ?? (variant === "card" ? "r2" : "r1")}
        columns={minColumn === undefined ? (columns ?? DEFAULT_COLUMNS) : columns}
        minColumn={minColumn}
        classNames={classNames}
        {...props}
      >
        {children}
      </Grid>
    </FeatureGridContext>
  );
}

export type FeatureGridItemProps = {
  /** The feature's name, and its link's when it has one. */
  title: ReactNode;
  /** A decorative glyph (an SVG icon), sized to `--ICON` in a quiet tile. */
  icon?: ReactNode;
  /**
   * Makes the whole item one link, named by the title: a press anywhere on the
   * item follows it, and its focus ring draws around the item.
   */
  href?: string;
  /** Renders the link (default: the router's link for an internal `href`, else `<a>`). */
  linkAs?: ElementType;
  /** The description: a sentence or two, on the prose scale. */
  children?: ReactNode;
  classNames?: SlotClassNames<"icon" | "title" | "link" | "body">;
} & Omit<ComponentPropsWithRef<"li">, "title" | "children">;

/**
 * One feature. With `href` the title's link stretches over the whole item (the
 * same stretched link as `MediaCard`), so assistive tech meets one link named
 * by the title rather than a link wrapping a paragraph.
 */
function FeatureGridItem({ title, icon, href, linkAs, children, className, classNames, ...props }: FeatureGridItemProps) {
  const context = useContext(FeatureGridContext);
  if (!context) throw new Error("FeatureGrid.Item must be inside a FeatureGrid.");
  const { headingLevel, variant } = context;
  const Heading = `h${headingLevel}` as const;
  const safeHref = href === undefined ? "" : safeUrl(href);
  const Link = useLinkElement(linkAs, safeHref || undefined);
  const card = variant === "card";

  return (
    <li
      data-print="avoid-break"
      data-variant={variant}
      className={cn(
        "r-marketing-feature relative flex min-w-0 flex-col gap-r4",
        card && "rounded-lg border border-border bg-surface-0 p-r2",
        card && safeHref && "hover:border-border-strong",
        className,
      )}
      {...props}
    >
      {icon != null && (
        <span
          aria-hidden
          className={cn(
            "inline-flex size-control shrink-0 items-center justify-center self-start rounded-md border border-border text-fg-primary *:size-icon",
            classNames?.icon,
          )}
        >
          {icon}
        </span>
      )}
      <Heading className={cn("min-w-0 break-words text-pretty text-display-4 text-fg-primary", classNames?.title)}>
        {safeHref ? (
          <Link href={safeHref} className={cn("r-marketing-stretched-link", classNames?.link)}>
            {title}
          </Link>
        ) : (
          title
        )}
      </Heading>
      {children != null && (
        <div className={cn("min-w-0 break-words text-pretty text-prose-3 text-fg-secondary", classNames?.body)}>{children}</div>
      )}
    </li>
  );
}

/** `FeatureGrid` with its `FeatureGrid.Item`. */
export const FeatureGrid = Object.assign(FeatureGridRoot, { Item: FeatureGridItem });
