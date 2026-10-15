"use client";

import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import {
  BUTTON_BASE,
  BUTTON_PRESSED,
  BUTTON_VARIANT,
  type ButtonVariant,
  guardClick,
  isAriaDisabled,
} from "./button-styles";
import { Spinner } from "./Spinner";

export type ButtonProps = {
  variant?: ButtonVariant;
  /**
   * Busy: `aria-busy`, a centred spinner over the (still measured, still named)
   * content so the width never jumps, and activation is ignored. The button
   * stays focusable, so focus is not dropped to <body> mid-submit.
   */
  loading?: boolean;
  /** Decorative glyph before the label, sized to `--ICON`. */
  iconStart?: ReactNode;
  /** Decorative glyph after the label, sized to `--ICON`. */
  iconEnd?: ReactNode;
  classNames?: SlotClassNames<"label" | "icon" | "spinner">;
  ref?: Ref<HTMLButtonElement>;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * The action button. Height is `h-control` (density, raised to the hit floor
 * on coarse pointers); text is UI scale wherever it sits, prose included.
 *
 * States: rest, hover, active, focus-visible (the base ring), disabled
 * (`disabled`, or `aria-disabled` to stay focusable), loading, and pressed
 * (`aria-pressed` makes it a toggle and paints the selection pair, as IconButton).
 */
export function Button({
  variant = "primary",
  loading = false,
  iconStart,
  iconEnd,
  classNames,
  className,
  children,
  onClick,
  type = "button",
  ...props
}: ButtonProps) {
  const inert = loading || isAriaDisabled(props["aria-disabled"]);

  return (
    <button
      // A bare <button> is type="submit": a Cancel rendered before the real
      // submit would become the form's default action.
      type={type}
      className={cn(
        BUTTON_BASE,
        "h-control max-w-full gap-r5 rounded-md px-r3 text-body-1 font-medium",
        BUTTON_VARIANT[variant],
        BUTTON_PRESSED,
        className,
      )}
      {...props}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={guardClick(inert, onClick)}
    >
      <span className={cn("inline-flex min-w-0 items-center gap-r5", loading && "opacity-0")}>
        {iconStart && (
          <span className={cn("r-primitives-icon-slot", classNames?.icon)} aria-hidden>
            {iconStart}
          </span>
        )}
        {children != null && children !== false && (
          <span className={cn("min-w-0 truncate", classNames?.label)}>{children}</span>
        )}
        {iconEnd && (
          <span className={cn("r-primitives-icon-slot", classNames?.icon)} aria-hidden>
            {iconEnd}
          </span>
        )}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner className={classNames?.spinner} />
        </span>
      )}
    </button>
  );
}
