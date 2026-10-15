"use client";
import { Check, Minus } from "lucide-react";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ReactNode,
  useLayoutEffect,
  useRef,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";

export interface CheckboxProps
  extends Omit<ComponentPropsWithRef<"input">, "type" | "checked" | "defaultChecked" | "children" | "size"> {
  checked?: boolean;
  defaultChecked?: boolean;
  /**
   * The "some of these" state. Visual and ARIA (`mixed`) only: it does not
   * change `checked`. A click clears it in the DOM and reports the next
   * `checked`; the caller decides what the group becomes.
   */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** The visible label. Without one, pass `aria-label`. */
  children?: ReactNode;
  /** `className` styles the root `<label>`; other props and `ref` address the `<input>`. */
  classNames?: SlotClassNames<"box" | "input" | "label">;
}

/**
 * A checkbox with its label. A native `<input type="checkbox">` drawn with
 * `appearance: none`: the platform keeps keyboard, form and a11y semantics. The
 * box stays small; `--HIT-MIN` comes from a pseudo-element, and the whole label
 * is clickable.
 */
export function Checkbox({
  checked,
  defaultChecked = false,
  indeterminate = false,
  onCheckedChange,
  onChange,
  invalid: invalidProp,
  children,
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
}: CheckboxProps) {
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
  // In a Field bound to a Form, the form owns `checked` (unless the caller passed it).
  const [isChecked, setChecked, fieldName] = useFieldValue({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
    fromForm: (value) => value === true,
  });

  // `indeterminate` is a DOM property with no attribute, and a click clears it,
  // so it is re-applied after every render rather than only when it changes.
  useLayoutEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  });

  return (
    <label
      className={cn("r-form-check", className)}
      data-disabled={field.disabled ? "" : undefined}
      data-readonly={field.readOnly ? "" : undefined}
    >
      <span className={cn("r-form-check-box", children == null && "hit-area", classNames?.box)}>
        <input
          ref={mergeRefs(ref, inputRef)}
          type="checkbox"
          id={field.id}
          name={fieldName}
          required={field.required}
          disabled={field.disabled}
          aria-readonly={field.readOnly || undefined}
          {...field.ariaProps}
          checked={isChecked}
          // A read-only box is focusable and announced, never toggled: the change
          // is dropped and React restores the controlled `checked`. (Not
          // preventDefault on click: the browser's revert then races React's.)
          onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => {
            if (!field.readOnly) setChecked(event.target.checked);
          })}
          className={cn("r-form-check-input", classNames?.input)}
          {...props}
        />
        <Check aria-hidden strokeWidth={3} className="r-form-check-mark r-form-check-mark-on" />
        <Minus aria-hidden strokeWidth={3} className="r-form-check-mark r-form-check-mark-mixed" />
      </span>
      {children != null && <span className={cn("r-form-check-label", classNames?.label)}>{children}</span>}
    </label>
  );
}
