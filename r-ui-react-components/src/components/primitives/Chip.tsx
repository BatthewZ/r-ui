"use client";
import { X } from "lucide-react";
import type { ComponentPropsWithRef, KeyboardEvent, Ref } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";

/** Every string the chip says, for localisation. */
export interface ChipLabels {
  /** The remove button's name, from the chip's text. */
  remove: (label: string) => string;
}

export const DEFAULT_CHIP_LABELS: ChipLabels = {
  remove: (label) => `Remove ${label}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Chip: ChipLabels;
  }
}

export type ChipProps = {
  /** The text: one line, truncated, the whole of it in `title`. */
  children: string;
  /** Adds a remove button after the text; Backspace or Delete on it removes too. */
  onRemove?: () => void;
  /** Keeps the remove button in place but refuses it (a disabled field's chips). */
  disabled?: boolean;
  /** `li` for a chip in a list (a field's choices, a filter row); `span` otherwise. */
  as?: "span" | "li";
  labels?: LabelsProp<ChipLabels>;
  classNames?: SlotClassNames<"label" | "remove">;
} & Omit<ComponentPropsWithRef<"span">, "children">;

/**
 * A value shown as a token: a chosen option, a tag, an applied filter. One
 * line high, so a row of chips wraps a whole line at a time: a chip is
 * `--CONTROL-H` less twice (`--R-SIZE-6` + the border), which is what a chip
 * field's padding leaves, and rows set that same distance apart keep a coarse
 * remove button's hit area off the next row. The remove button is square and
 * the chip's full height (`hit-area` lifts it to the floor on coarse input),
 * named "Remove <text>", and hidden in print.
 */
export function Chip({
  children,
  onRemove,
  disabled = false,
  as = "span",
  labels: labelsProp,
  className,
  classNames,
  ref,
  ...props
}: ChipProps) {
  const labels = useLabels("Chip", DEFAULT_CHIP_LABELS, labelsProp);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Backspace" && event.key !== "Delete") return;
    event.preventDefault();
    onRemove?.();
  };
  const content = (
    <>
      <span className={cn("min-w-0 truncate", classNames?.label)} title={children}>
        {children}
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={labels.remove(children)}
          disabled={disabled}
          onClick={onRemove}
          onKeyDown={onKeyDown}
          data-print="hide"
          className={cn("r-primitives-chip-remove hit-area", classNames?.remove)}
        >
          <X aria-hidden />
        </button>
      )}
    </>
  );
  const shared = { className: cn("r-primitives-chip", className), ...props };
  // The ref is typed for a span; an li is an HTMLElement too.
  return as === "li" ? (
    <li ref={ref as Ref<HTMLLIElement>} {...shared}>
      {content}
    </li>
  ) : (
    <span ref={ref} {...shared}>
      {content}
    </span>
  );
}
