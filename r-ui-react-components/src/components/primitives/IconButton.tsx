"use client";

import type { ButtonHTMLAttributes, MouseEvent, ReactNode, Ref } from "react";

import { cn } from "../../util/style";
import { BUTTON_BASE, BUTTON_VARIANT } from "./button-styles";

export type IconButtonProps = {
  /** The accessible name (`aria-label`) and the native `title` hint. Required: the icon says nothing. */
  label: string;
  /** The glyph, sized to `--ICON`. Rendered `aria-hidden`; `label` names the button. */
  icon: ReactNode;
  variant?: "secondary" | "ghost" | "primary";
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

/**
 * An icon-only button: visually a compact square (the icon plus `r4` on each
 * side, so it follows density), while `.hit-area` gives it an invisible hit area
 * of at least `--HIT-MIN` (24px fine, 44px coarse) without growing the visual.
 *
 * `aria-pressed` turns it into a toggle and paints the selection pair.
 */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  className,
  onClick,
  type = "button",
  ...props
}: IconButtonProps) {
  const ariaDisabled = props["aria-disabled"] === true || props["aria-disabled"] === "true";

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (ariaDisabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        BUTTON_BASE,
        "hit-area r-primitives-icon-button rounded-md",
        variant !== "ghost" && "size-control",
        BUTTON_VARIANT[variant],
        "aria-pressed:bg-selection aria-pressed:text-fg-on-selection",
        className,
      )}
      {...props}
      onClick={handleClick}
    >
      <span className="r-primitives-icon-slot" aria-hidden>
        {icon}
      </span>
    </button>
  );
}
