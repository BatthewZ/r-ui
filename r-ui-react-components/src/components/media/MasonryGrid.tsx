"use client";

import {
  Children,
  type ComponentPropsWithRef,
  type CSSProperties,
  isValidElement,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import type { Space } from "../layout";

/** The narrowest a column may get before the grid drops one: the contract's column floors. */
export type MasonryMinColumn = "sm" | "md" | "lg";

export type MasonryGridProps = {
  /** Space between columns and between stacked items, from the UI scale. Default `r3`. */
  gap?: Space;
  /** The column floor (`--COLUMN-SM`, `--COLUMN-MD`, `--COLUMN-LG`). Default `md`. */
  minColumn?: MasonryMinColumn;
  /** The most columns, however wide the grid gets. Default: as many as fit. */
  maxColumns?: number;
  /** Announce it as a list (`role="list"`, each item a `listitem`): a gallery or a feed is one. */
  list?: boolean;
  classNames?: SlotClassNames<"item">;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"div">, "children">;

// Literal class names, so Tailwind's scanner sees every utility.
const GAP: Record<Space, string> = {
  r1: "[--r-media-masonry-gap:var(--R-SIZE-1)]",
  r2: "[--r-media-masonry-gap:var(--R-SIZE-2)]",
  r3: "[--r-media-masonry-gap:var(--R-SIZE-3)]",
  r4: "[--r-media-masonry-gap:var(--R-SIZE-4)]",
  r5: "[--r-media-masonry-gap:var(--R-SIZE-5)]",
  r6: "[--r-media-masonry-gap:var(--R-SIZE-6)]",
};

const FLOOR: Record<MasonryMinColumn, string> = {
  sm: "[--r-media-masonry-floor:var(--COLUMN-SM)]",
  md: "[--r-media-masonry-floor:var(--COLUMN-MD)]",
  lg: "[--r-media-masonry-floor:var(--COLUMN-LG)]",
};

/** Where one item goes: its column (0-based, from the inline start) and its offset from the top, in px. */
export interface MasonryPlacement {
  column: number;
  top: number;
}

/**
 * Greedy shortest-column placement, in source order: each item goes to the
 * column whose stack is shortest so far (the inline-start one on a tie), one
 * `gap` below what is already there. Column heights only grow and each item
 * takes the lowest, so every item starts no higher than the one before it.
 */
export function placeMasonry(heights: readonly number[], columns: number, gap: number): MasonryPlacement[] {
  const count = Math.max(1, Math.floor(columns));
  const stacks: number[] = Array.from({ length: count }, () => 0);
  return heights.map((height) => {
    let column = 0;
    for (let c = 1; c < count; c++) if ((stacks[c] ?? 0) < (stacks[column] ?? 0)) column = c;
    const top = stacks[column] ?? 0;
    stacks[column] = top + height + gap;
    return { column, top };
  });
}

/**
 * Lays the items out: reads the column tracks the CSS grid chose for the grid's
 * width, measures each item, and pins it to its column in the first row with its
 * offset as a top margin. The row grows to the tallest column, so the grid's own
 * height needs no script. With no tracks (no layout, as in jsdom) the plain grid stays.
 */
function layout(root: HTMLElement) {
  // Read the tracks with the items unplaced: an item pinned to a column the grid no
  // longer has (it narrowed) makes an implicit track, which the computed value lists.
  root.removeAttribute("data-placed");
  const style = getComputedStyle(root);
  const tracks = style.gridTemplateColumns.split(" ").filter((t) => t && t !== "none").length;
  const items = [...root.children].filter((el): el is HTMLElement => el instanceof HTMLElement);
  if (tracks === 0 || items.length === 0) return;
  const gap = Number.parseFloat(style.rowGap) || 0;
  const heights = items.map((el) => el.getBoundingClientRect().height);
  placeMasonry(heights, tracks, gap).forEach(({ column, top }, i) => {
    const el = items[i];
    if (!el) return;
    el.style.setProperty("--r-media-masonry-column", String(column + 1));
    el.style.setProperty("--r-media-masonry-top", String(top));
  });
  root.dataset.columns = String(tracks);
  root.setAttribute("data-placed", "");
}

/**
 * Items of differing heights in columns, packed without row gaps: photos, cards,
 * notes. The number of columns follows the GRID's own width (as many
 * `minColumn`-wide columns as fit, at most `maxColumns`), never the viewport's.
 *
 * **Reading order (the trade-off).** CSS multi-column would need no script but
 * reads down the first column, then the second: tab order and visual order part
 * ways at once. Here the items stay in source order and a script places each in
 * the shortest column so far, so every item starts no higher than the one before
 * it: reading top to bottom meets them in source (and tab) order, and only items
 * side by side can sit out of left-to-right order. The columns come from the CSS
 * grid (so RTL mirrors them and `gap` is the grid's); the script only measures
 * heights and assigns column and offset, again whenever the grid's width or an
 * item's height changes. Before it runs (server rendering, no script) the items
 * are a plain grid in source order.
 *
 * On paper the items fall back to that plain grid, each kept on one page.
 *
 * Children can be anything: `Image`, a `Lightbox.Trigger` around one, a
 * `MediaCard`. Give pictures their intrinsic `width` / `height` so a box never
 * changes height when its picture arrives, which would move every item below it.
 */
export function MasonryGrid({
  gap = "r3",
  minColumn = "md",
  maxColumns,
  list = false,
  classNames,
  className,
  style,
  children,
  ref,
  ...props
}: MasonryGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);

  // Every commit: place, then watch the grid's width and each item's height
  // (a font arriving, text rewrapping). A change is placed on the next frame, so
  // the observer never sees a size it caused in its own callback.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    layout(root);
    if (typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => layout(root));
    });
    observer.observe(root);
    for (const child of root.children) observer.observe(child);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  });

  const sizing = (maxColumns ? { "--r-media-masonry-max": Math.max(1, Math.floor(maxColumns)), ...style } : style) as
    | CSSProperties
    | undefined;

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      role={list ? "list" : undefined}
      style={sizing}
      className={cn("r-media-masonry", GAP[gap], FLOOR[minColumn], className)}
      {...props}
    >
      {items.map((child, i) => (
        <div
          // `Children.toArray` keys every element by its own key, so an insertion moves no item.
          key={isValidElement(child) && child.key !== null ? child.key : i}
          role={list ? "listitem" : undefined}
          data-print="avoid-break"
          className={cn("r-media-masonry-item min-w-0", classNames?.item)}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
