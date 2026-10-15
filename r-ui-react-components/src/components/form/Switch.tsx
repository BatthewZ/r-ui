"use client";
import { type ChangeEvent, type ComponentPropsWithRef, type ReactNode } from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";

export interface SwitchProps
  extends Omit<ComponentPropsWithRef<"input">, "type" | "checked" | "defaultChecked" | "children" | "size" | "role"> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** The visible label. Without one, pass `aria-label`. */
  children?: ReactNode;
  /** `className` styles the root `<label>`; other props and `ref` address the `<input>`. */
  classNames?: SlotClassNames<"track" | "thumb" | "label">;
}

/**
 * An on/off setting that applies immediately. A native checkbox with
 * `role="switch"`, so it submits like one (`name`/`value`, nothing when off)
 * and toggles on Space. Same API as `Checkbox`, minus `indeterminate`.
 */
export function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  onChange,
  invalid: invalidProp,
  children,
  className,
  classNames,
  id: idProp,
  required: requiredProp,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  ...props
}: SwitchProps) {
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

  return (
    <label
      className={cn("r-form-check", className)}
      data-disabled={field.disabled ? "" : undefined}
      data-readonly={field.readOnly ? "" : undefined}
    >
      <span className={cn("r-form-switch", children == null && "hit-area")}>
        <input
          type="checkbox"
          role="switch"
          id={field.id}
          name={fieldName}
          required={field.required}
          disabled={field.disabled}
          aria-readonly={field.readOnly || undefined}
          {...field.ariaProps}
          checked={isChecked}
          onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => {
            if (!field.readOnly) setChecked(event.target.checked);
          })}
          className={cn("r-form-switch-track", classNames?.track)}
          {...props}
        />
        <span aria-hidden className={cn("r-form-switch-thumb", classNames?.thumb)} />
      </span>
      {children != null && <span className={cn("r-form-check-label", classNames?.label)}>{children}</span>}
    </label>
  );
}
