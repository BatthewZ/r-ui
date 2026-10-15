import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { MARK_TEXT, type Tone, ToneGlyph } from "../../util/tone";

export type StatusLabelProps = {
  tone?: Tone;
  /** Replaces the tone's default glyph (decorative; the label names the state). */
  icon?: ReactNode;
  /** The visible label. Required: the words are the status; colour and glyph only reinforce them. */
  children: ReactNode;
  classNames?: SlotClassNames<"icon" | "label">;
} & Omit<ComponentPropsWithRef<"span">, "children">;

/**
 * A status as mark + glyph + words: the glyph is drawn in the tone's mark
 * colour (>= 3:1 on every surface), the label in primary ink, so the row stays
 * ~neutral and readable while three channels carry the state. Use it in table
 * cells, list rows and headers; use `Badge` when the status needs a chip.
 */
export function StatusLabel({ tone = "neutral", icon, classNames, className, children, ...props }: StatusLabelProps) {
  return (
    <span className={cn("inline-flex min-w-0 max-w-full items-center gap-r5 text-body-2 text-fg-primary", className)} {...props}>
      <span className={cn("r-primitives-icon-slot", MARK_TEXT[tone], classNames?.icon)} aria-hidden>
        {icon ?? <ToneGlyph tone={tone} />}
      </span>
      <span className={cn("min-w-0 truncate", classNames?.label)} title={typeof children === "string" ? children : undefined}>
        {children}
      </span>
    </span>
  );
}
