"use client";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { cn } from "../../util/style";

import { useFieldControl } from "./Field";
import { useRadioGroupName, useRadioValue } from "./RadioGroup";

interface SegmentedContextValue {
  name: string;
  value: string | undefined;
  setValue: (value: string) => void;
  disabled: boolean;
  readOnly: boolean;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

export interface SegmentedControlProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "role"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /**
   * The radios' shared `name`, for form submission. Omitted: the Field's name
   * while the radios belong to a form, else one generated for this control, so
   * two same-named controls outside a form never merge into one browser group.
   */
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
}

/**
 * A single choice among a few short, mutually exclusive views ("Day / Week /
 * Month"). Radio-group semantics on native radios: one tab stop (the selected
 * segment), arrow keys move and select, Home/End and RTL are the browser's.
 * Name it with `aria-label` or a `Field.Label`. Stretch it with `className="w-full"`.
 */
function SegmentedControlRoot({
  value,
  defaultValue,
  onValueChange,
  name,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  invalid: invalidProp,
  className,
  children,
  id: idProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  "aria-labelledby": labelledByProp,
  ref,
  ...props
}: SegmentedControlProps) {
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const [current, setValue, fieldName] = useRadioValue(value, defaultValue, onValueChange);
  const [groupName, groupRef] = useRadioGroupName(name, fieldName, ref);

  return (
    <SegmentedContext
      value={{
        name: groupName,
        value: current,
        setValue,
        disabled: field.disabled === true,
        readOnly: field.readOnly === true,
      }}
    >
      <div
        ref={groupRef}
        role="radiogroup"
        id={field.id}
        aria-labelledby={labelledByProp ?? field.labelId}
        aria-readonly={field.readOnly || undefined}
        aria-disabled={field.disabled || undefined}
        {...field.ariaProps}
        data-invalid={field.invalid ? "" : undefined}
        data-disabled={field.disabled ? "" : undefined}
        className={cn("r-form-segmented", className)}
        {...props}
      >
        {children}
      </div>
    </SegmentedContext>
  );
}

export interface SegmentedControlItemProps
  extends Omit<
    ComponentPropsWithRef<"input">,
    "type" | "value" | "checked" | "defaultChecked" | "name" | "children" | "size"
  > {
  value: string;
  disabled?: boolean;
  /** A leading icon, `size-icon`. An icon-only segment takes `aria-label`. */
  icon?: ReactNode;
  children?: ReactNode;
}

/** One segment. `className` styles the segment; other props and `ref` address its radio. */
function SegmentedControlItem({
  value,
  disabled: disabledProp,
  icon,
  children,
  className,
  onChange,
  ...props
}: SegmentedControlItemProps) {
  const group = useContext(SegmentedContext);
  if (!group) throw new Error("<SegmentedControl.Item> must be rendered inside a <SegmentedControl>.");
  const disabled = disabledProp ?? group.disabled;
  const selected = group.value === value;

  return (
    <label
      // The frame's padding is inside its `--CONTROL-H`; the hit area reaches over it, so
      // a press anywhere in the frame above or below a segment picks that segment.
      className={cn("r-form-segment hit-area forced-colors:data-selected:bg-selection", className)}
      data-selected={selected ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
    >
      <input
        type="radio"
        name={group.name}
        value={value}
        checked={selected}
        disabled={disabled}
        onChange={composeEventHandlers(onChange, (event: ChangeEvent<HTMLInputElement>) => {
          if (event.target.checked && !group.readOnly) group.setValue(value);
        })}
        className="sr-only"
        {...props}
      />
      {icon != null && (
        <span aria-hidden className="r-form-adornment">
          {icon}
        </span>
      )}
      {children != null && (
        <span className="truncate" title={typeof children === "string" ? children : undefined}>
          {children}
        </span>
      )}
    </label>
  );
}

export const SegmentedControl = Object.assign(SegmentedControlRoot, { Item: SegmentedControlItem });
