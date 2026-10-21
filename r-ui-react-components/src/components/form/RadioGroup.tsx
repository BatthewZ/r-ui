"use client";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  type RefCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";

import { useFieldControl, useFieldValue } from "./Field";

interface RadioGroupContextValue {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

/**
 * A radio group's value (also SegmentedControl's): `undefined` until one is
 * chosen. In a Field bound to a Form, the form owns it (unless the caller passed one).
 */
export function useRadioValue(
  value: string | undefined,
  defaultValue: string | undefined,
  onValueChange: ((value: string) => void) | undefined,
) {
  return useFieldValue<string | undefined>({
    value,
    defaultValue,
    onChange: (next) => {
      if (next !== undefined) onValueChange?.(next);
    },
    fromForm: (raw) => (raw === undefined || raw === null ? undefined : String(raw)),
  });
}

/**
 * A radio group's shared `name` (also SegmentedControl's), and the ref its
 * `radiogroup` element takes: the caller's name, else the Field's while the
 * radios belong to a form, else one generated for this group. A form scopes its
 * radio groups by name; with no form, every same-named radio on the page is one
 * group (checking one clears the other, the arrows cross between them).
 */
export function useRadioGroupName(
  name: string | undefined,
  fieldName: string | undefined,
  ref: Ref<HTMLDivElement> | undefined,
): [string, RefCallback<HTMLDivElement>] {
  const generatedName = useId();
  const groupRef = useRef<HTMLDivElement>(null);
  const [formless, setFormless] = useState(false);
  useLayoutEffect(() => {
    const radio = groupRef.current?.querySelector<HTMLInputElement>('input[type="radio"]');
    setFormless(radio != null && radio.form === null);
  });
  const mergedRef = useMemo(() => mergeRefs(ref, groupRef), [ref]);
  return [name ?? (fieldName !== undefined && !formless ? fieldName : generatedName), mergedRef];
}

export interface RadioGroupProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "role"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * The radios' shared `name`, for form submission. Omitted: the Field's name
   * while the radios belong to a form, else one generated for this group, so two
   * same-named groups outside a form never merge into one browser group.
   */
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
  ref,
  ...props
}: RadioGroupProps) {
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const [current, setValue, fieldName] = useRadioValue(value, defaultValue, onValueChange);
  const [groupName, groupRef] = useRadioGroupName(name, fieldName, ref);

  return (
    <RadioGroupContext
      value={{
        name: groupName,
        value: current,
        setValue,
        disabled: field.disabled === true,
        readOnly: field.readOnly === true,
        required: field.required === true,
      }}
    >
      <div
        ref={groupRef}
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
