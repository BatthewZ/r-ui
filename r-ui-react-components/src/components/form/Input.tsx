"use client";
import { type ComponentPropsWithRef, type MouseEvent, type ReactNode, useRef } from "react";

import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldInputProps } from "./Field";

export interface InputProps extends Omit<ComponentPropsWithRef<"input">, "type" | "size"> {
  /** Text-like types only. Numbers: `NumberInput`. Search: `SearchInput`. */
  type?: "text" | "email" | "password" | "search" | "tel" | "url";
  invalid?: boolean;
  /** Leading adornment: an icon, a prefix ("https://"), a unit. */
  start?: ReactNode;
  /** Trailing adornment: a unit ("ms"), an icon, or a small button. */
  end?: ReactNode;
  /**
   * `className` styles the frame (the visible box, so `w-*` lands there); every
   * other prop, and `ref`, address the `<input>`.
   */
  classNames?: SlotClassNames<"input" | "start" | "end">;
}

const INTERACTIVE = "input, textarea, select, button, a, [tabindex]";

/**
 * A press on a text frame's padding or on a decorative adornment focuses its
 * input, as if the whole box were the input; interactive adornments keep
 * theirs. Returns whether the frame took the press.
 */
export function focusInputFromFrame(
  event: MouseEvent<HTMLElement>,
  input: HTMLInputElement | null,
  disabled: boolean | undefined,
): boolean {
  // Only interactive elements INSIDE the frame count: an ancestor with a
  // tabindex (a focusable <main>, a dialog) must not swallow the press.
  const interactive = event.target instanceof Element ? event.target.closest(INTERACTIVE) : null;
  if (disabled || (interactive && event.currentTarget.contains(interactive))) return false;
  event.preventDefault();
  input?.focus();
  return true;
}

/** On a button beside the input: the press must not take focus from it. */
export function keepFocus(event: MouseEvent) {
  event.preventDefault();
}

/** Text field with optional start and end adornments. Height `h-control`. */
export function Input({
  type = "text",
  invalid: invalidProp,
  start,
  end,
  className,
  classNames,
  ref,
  id: idProp,
  required: requiredProp,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  ...props
}: InputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  // In a Field bound to a Form, the form owns the value (unless the caller passed one).
  const nativeProps = useFieldInputProps(props);

  return (
    <div
      className={cn("r-form-frame r-form-text-frame flex h-control w-full min-w-0 items-center gap-r4 px-r3", className)}
      data-invalid={field.invalid ? "" : undefined}
      data-disabled={field.disabled ? "" : undefined}
      data-readonly={field.readOnly ? "" : undefined}
      onMouseDown={(event) => focusInputFromFrame(event, inputRef.current, field.disabled)}
    >
      {start != null && <span className={cn("r-form-adornment", classNames?.start)}>{start}</span>}
      <input
        ref={mergeRefs(ref, inputRef)}
        type={type}
        id={field.id}
        required={field.required}
        disabled={field.disabled}
        readOnly={field.readOnly}
        {...field.ariaProps}
        className={cn(
          "r-form-input min-w-0 flex-1 self-stretch bg-transparent text-body-1 text-fg-primary",
          classNames?.input,
        )}
        {...nativeProps}
      />
      {end != null && <span className={cn("r-form-adornment", classNames?.end)}>{end}</span>}
    </div>
  );
}
