"use client";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useId,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl } from "./Field";

interface RadioGroupContextValue {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "role"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** The radios' shared `name`, for form submission. Generated when omitted. */
  name?: string;
  orientation?: "vertical" | "horizontal";
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** On the group: ARIA allows `aria-invalid` on `radiogroup`, not on `radio`. */
  invalid?: boolean;
}

/**
 * One choice from a short, visible list. Native radios sharing a `name`, so
 * the browser owns the keyboard model (Tab into the checked radio, arrows move
 * and select). Inside a `Field`, `Field.Label` names the group.
 */
export function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  name,
  orientation = "vertical",
  disabled: disabledProp,
  readOnly: readOnlyProp,
  required: requiredProp,
  invalid: invalidProp,
  className,
  children,
  id: idProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  "aria-labelledby": labelledByProp,
  ...props
}: RadioGroupProps) {
  const generatedName = useId();
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const [current, setValue] = useControllableState<string | undefined>({
    value,
    defaultValue,
    onChange: (next) => {
      if (next !== undefined) onValueChange?.(next);
    },
  });

  return (
    <RadioGroupContext
      value={{
        name: name ?? generatedName,
        value: current,
        setValue,
        disabled: field.disabled === true,
        readOnly: field.readOnly === true,
        required: field.required === true,
      }}
    >
      <div
        role="radiogroup"
        id={field.id}
        // A `<label for>` cannot name a group; the Field's label does it by id.
        aria-labelledby={labelledByProp ?? field.labelId}
        aria-required={field.required || undefined}
        aria-readonly={field.readOnly || undefined}
        aria-disabled={field.disabled || undefined}
        {...field.ariaProps}
        data-orientation={orientation}
        className={cn(
          "flex justify-self-start",
          orientation === "vertical" ? "flex-col gap-r4" : "flex-row flex-wrap gap-x-r2 gap-y-r4",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext>
  );
}

export interface RadioProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    "type" | "value" | "checked" | "defaultChecked" | "name" | "children" | "size"
  > {
  value: string;
  disabled?: boolean;
  /** The visible label. Without one, pass `aria-label`. */
  children?: ReactNode;
  /** `className` styles the root `<label>`; other props and `ref` address the `<input>`. */
  classNames?: SlotClassNames<"box" | "input" | "label">;
}

/** One option of a `RadioGroup`. */
export function Radio({
  value,
  disabled: disabledProp,
  children,
  className,
  classNames,
  onChange,
  ...props
}: RadioProps) {
  const group = useContext(RadioGroupContext);
  if (!group) throw new Error("<Radio> must be rendered inside a <RadioGroup>.");
  const disabled = disabledProp ?? group.disabled;

  return (
    <label
      className={cn("r-form-check", className)}
      data-disabled={disabled ? "" : undefined}
      data-readonly={group.readOnly ? "" : undefined}
    >
      <span className={cn("r-form-check-box", children == null && "hit-area", classNames?.box)}>
        <input
          type="radio"
          name={group.name}
          value={value}
          checked={group.value === value}
          disabled={disabled}
          required={group.required}
          onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => {
            if (event.target.checked && !group.readOnly) group.setValue(value);
          })}
          className={cn("r-form-radio-input", classNames?.input)}
          {...props}
        />
        <span aria-hidden className="r-form-radio-dot" />
      </span>
      {children != null && <span className={cn("r-form-check-label", classNames?.label)}>{children}</span>}
    </label>
  );
}
