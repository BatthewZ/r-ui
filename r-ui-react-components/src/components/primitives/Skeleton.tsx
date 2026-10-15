import type { ComponentPropsWithRef } from "react";

import { cn } from "../../util/style";

export type SkeletonProps = {
  /**
   * - `text` (default): one line box of the inherited type (a 1em bar centred
   *   in 1lh), so it takes the space the text will; `lines` stacks several.
   * - `block`: a rectangle you size with `className` (`h-chart`, `h-control`…).
   * - `circle`: a disc, `size-control` by default (an avatar's stand-in).
   */
  shape?: "text" | "block" | "circle";
  /** `text` only: number of lines; the last one is shorter, as real text runs out. */
  lines?: number;
  /**
   * Makes this skeleton the status for its group: `role="status"` plus this
   * text, visually hidden. Without it the skeleton is decoration (`aria-hidden`);
   * give ONE skeleton per loading region a label.
   */
  label?: string;
} & Omit<ComponentPropsWithRef<"span">, "children">;

const PULSE = "r-primitives-skeleton block w-full animate-pulse bg-fg-primary/10 motion-reduce:animate-none";
const LINE = `${PULSE} r-primitives-skeleton-text rounded-sm`;

/** The root per shape: a column of lines for text, the bar itself otherwise. */
const ROOT = {
  text: "flex w-full flex-col",
  block: `${PULSE} h-control rounded-md`,
  circle: `${PULSE} size-control rounded-full`,
} as const;

/** Text lines; the last of several is shorter, as real text runs out. */
function Lines({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <span key={i} className={cn(LINE, count > 1 && i === count - 1 && "w-3/5")} />
  ));
}

/**
 * Placeholder for content that is loading, drawn in the primary ink at low
 * alpha: a surface rung would read as a hole on a dark theme's raised card,
 * while ink-at-alpha reads as "something will be here" on any surface. The pulse stops under reduced motion (`motion-reduce`):
 * it is decoration, and a loop cannot ride the duration tokens, which collapse
 * to 0.01ms there and would turn it into a strobe. Under forced colors, where a
 * wash paints nothing, it is a dashed GrayText outline instead.
 */
export function Skeleton({ shape = "text", lines = 1, label, className, ...props }: SkeletonProps) {
  const announces = Boolean(label);
  const isText = shape === "text";
  return (
    <span
      role={announces ? "status" : undefined}
      aria-hidden={announces ? undefined : true}
      className={cn(ROOT[shape], className)}
      {...props}
    >
      {isText && <Lines count={Math.max(1, Math.floor(lines))} />}
      {announces && <span className="sr-only">{label}</span>}
    </span>
  );
}
