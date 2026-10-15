import type { ComponentPropsWithRef } from "react";

import { cn } from "../../util/style";

export type SpinnerProps = {
  /**
   * Makes this spinner the status for what it waits on: `role="status"` plus
   * this text, visually hidden, in the caller's language. Without it the
   * spinner is decoration (`aria-hidden`): N spinners would otherwise be N live
   * regions, each already holding "Loading" when inserted, which screen
   * readers do not announce anyway.
   */
  label?: string;
} & Omit<ComponentPropsWithRef<"span">, "children">;

/**
 * An indeterminate activity ring in `currentColor`, `size-icon` by default
 * (`className` resizes it).
 *
 * Keeps turning under reduced motion, on purpose: it is an in-place rotation
 * that signals "still working", and a frozen arc reads as "stuck". It cannot
 * ride the duration tokens: they collapse to 0.01ms there, which turns an
 * infinite animation into a strobe.
 */
export function Spinner({ label, className, ...props }: SpinnerProps) {
  const announces = Boolean(label);
  return (
    <span
      role={announces ? "status" : undefined}
      aria-hidden={announces ? undefined : true}
      className={cn("inline-flex size-icon shrink-0", className)}
      {...props}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-full animate-spin" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {announces && <span className="sr-only">{label}</span>}
    </span>
  );
}
