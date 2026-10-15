"use client";
import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithRef, KeyboardEvent, MouseEvent } from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldInputProps } from "./Field";

export interface SelectProps extends Omit<ComponentPropsWithRef<"select">, "size" | "multiple"> {
  invalid?: boolean;
  /**
   * A first, unselectable option shown while the value is `""`. With
   * `required`, leaving it selected fails native validation.
   */
  placeholder?: string;
  /**
   * Native `<select>` has no read-only state. This one refuses to open or step
   * by keyboard and carries `aria-readonly`; the value still submits.
   */
  readOnly?: boolean;
  /** `className` styles the wrapper (width lands there); props and `ref` address the `<select>`. */
  classNames?: SlotClassNames<"select" | "icon">;
}

// Keys that open or step a closed native select. Tab and modifiers pass.
const OPENING_KEYS = new Set([" ", "Enter", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"]);

/**
 * A styled native `<select>`. Native on purpose: the platform picker is the
 * best one on touch, and the a11y is the browser's. Options are children.
 */
export function Select({
  invalid: invalidProp,
  placeholder,
  readOnly: readOnlyProp,
  className,
  classNames,
  children,
  id: idProp,
  required: requiredProp,
  disabled: disabledProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  onMouseDown,
  onKeyDown,
  defaultValue,
  ...props
}: SelectProps) {
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const readOnly = field.readOnly === true;
  // In a Field bound to a Form, the form owns the value (unless the caller passed one).
  const { defaultValue: initialValue, ...nativeProps } = useFieldInputProps({ ...props, defaultValue });

  return (
    <div className={cn("relative flex w-full min-w-0", className)}>
      <select
        id={field.id}
        required={field.required}
        disabled={field.disabled}
        aria-readonly={readOnly || undefined}
        {...field.ariaProps}
        data-invalid={field.invalid ? "" : undefined}
        data-disabled={field.disabled ? "" : undefined}
        data-readonly={readOnly ? "" : undefined}
        onMouseDown={composeEventHandlers(onMouseDown, (event: MouseEvent<HTMLSelectElement>) => {
          if (readOnly) event.preventDefault();
        })}
        onKeyDown={composeEventHandlers(onKeyDown, (event: KeyboardEvent<HTMLSelectElement>) => {
          if (readOnly && OPENING_KEYS.has(event.key)) event.preventDefault();
        })}
        className={cn(
          "r-form-frame r-form-select h-control w-full min-w-0 appearance-none truncate ps-r3 pe-[calc(var(--R-SIZE-3)*2+var(--ICON))] text-body-1",
          classNames?.select,
        )}
        // Without a value, a browser selects the first ENABLED option, skipping
        // the placeholder; start on it explicitly.
        defaultValue={
          initialValue === undefined && nativeProps.value === undefined && placeholder !== undefined ? "" : initialValue
        }
        {...nativeProps}
      >
        {placeholder !== undefined && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute end-r3 top-1/2 size-icon -translate-y-1/2 text-fg-muted",
          field.disabled && "opacity-disabled",
          classNames?.icon,
        )}
      />
    </div>
  );
}
