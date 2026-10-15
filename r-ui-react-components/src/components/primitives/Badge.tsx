import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { joinToneTables, MARK_TEXT, type Tone, TONE_BORDER, TONE_SOLID, TONE_SUBTLE_BG, TONE_TEXT } from "../../util/tone";

export type BadgeVariant = "subtle" | "solid" | "outline";

export type BadgeProps = {
  tone?: Tone;
  variant?: BadgeVariant;
  /** Optional decorative glyph before the text, sized to `--ICON`. */
  icon?: ReactNode;
  classNames?: SlotClassNames<"icon">;
} & ComponentPropsWithRef<"span">;

/**
 * Every pair here is one the contrast contract guarantees:
 * - subtle: the tone's subtle bg with its text-safe ink (>= 4.5:1 on that bg);
 *   neutral is secondary ink on rung 2, accent the selection pair.
 * - solid: the tone's mark/fill with its own on-pair. Neutral solid is the
 *   tooltip pair (inverse on primary ink), not the primary ACTION fill.
 * - outline: no fill; a mark-coloured edge (>= 3:1 on surfaces) and text-safe
 *   ink (>= 4.5:1 on surfaces). A fill is never used as ink on a surface.
 */
const SUBTLE: Record<Tone, string> = {
  ...joinToneTables(TONE_SUBTLE_BG, TONE_TEXT),
  neutral: "bg-surface-2 text-fg-secondary",
  accent: "bg-selection text-fg-on-selection",
};

const OUTLINE = joinToneTables(TONE_BORDER, TONE_TEXT);

const VARIANT: Record<BadgeVariant, Record<Tone, string>> = { subtle: SUBTLE, solid: TONE_SOLID, outline: OUTLINE };

/**
 * A short, non-interactive label: a count, a category, a state. Text is the
 * meaning; colour only reinforces it. Every variant draws a `--BORDER-WIDTH`
 * border (transparent unless outlined) so all three are the same size side by side.
 */
export function Badge({ tone = "neutral", variant = "subtle", icon, classNames, className, children, ...props }: BadgeProps) {
  // The glyph takes the tone's mark where the badge sits on a surface or the
  // tone's own subtle bg; on a fill (and on the selection pair) it inherits the ink.
  const markIcon = variant === "outline" || (variant === "subtle" && tone !== "accent");
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-r6 whitespace-nowrap rounded-sm border border-transparent px-r5 text-body-3 font-medium",
        VARIANT[variant][tone],
        className,
      )}
      {...props}
    >
      {icon && (
        <span className={cn("r-primitives-icon-slot", markIcon && MARK_TEXT[tone], classNames?.icon)} aria-hidden>
          {icon}
        </span>
      )}
      <span className="min-w-0 truncate" title={typeof children === "string" ? children : undefined}>
        {children}
      </span>
    </span>
  );
}
