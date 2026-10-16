"use client";
import {
  type ButtonHTMLAttributes,
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type Ref,
  useContext,
  useId,
  useRef,
} from "react";

import { useRovingFocusWithin } from "../../hooks/use-roving-focus";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { useField, useFieldControl, useFieldValue } from "../form";
import { DropdownMenu } from "../overlays";
import { Button, IconButton } from "../primitives";

import { MenuFormContext, ToolbarContext, type ToolbarOrientation, useSharedValue } from "./toolbar-context";
import { SPACED_CLASSES } from "./toolbar-styles";

interface ToggleGroupBaseProps
  extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "role" | "children"> {
  /** Inside a Toolbar, the toolbar's; elsewhere horizontal. */
  orientation?: ToolbarOrientation;
  /** Submitted as one hidden input per pressed value. Inside a Field, the Field's name by default. */
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** A single-choice group must have a choice (`aria-required`). */
  required?: boolean;
  children?: ReactNode;
}

/** One choice: a radio group of toggles (text alignment). The choice can move, never clear. */
export interface ToggleGroupSingleProps extends ToggleGroupBaseProps {
  type: "single";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/** Any number of independent toggles (bold, italic, underline). */
export interface ToggleGroupMultipleProps extends ToggleGroupBaseProps {
  type: "multiple";
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: string[]) => void;
}

export type ToggleGroupProps = ToggleGroupSingleProps | ToggleGroupMultipleProps;

/** The value as a single group holds it (one string) or a multiple one does (a list). */
type Wire = string | readonly string[] | undefined;

const toList = (value: unknown): string[] =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value.map(String) : [String(value)];

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

interface GroupState {
  single: boolean;
  pressed: readonly string[];
  press: (value: string) => void;
  disabled: boolean;
}

const GroupContext = createContext<GroupState | null>(null);

/**
 * The group's value, from the caller (controlled), the form (inside a bound
 * Field), the toolbar (uncontrolled inside a Toolbar, so the bar and the
 * overflow menu agree) or its own state, in that order.
 */
function useGroupValue(props: ToggleGroupProps): { pressed: string[]; press: (value: string) => void; name: string | undefined } {
  const single = props.type === "single";
  const emit = (next: Wire) => {
    if (props.type === "single") {
      if (typeof next === "string") props.onValueChange?.(next);
    } else {
      props.onValueChange?.(toList(next));
    }
  };
  const initial: Wire = props.defaultValue ?? (single ? undefined : []);
  const [own, setOwn, fieldName] = useFieldValue<Wire>({
    value: props.value,
    defaultValue: initial,
    onChange: emit,
    fromForm: (raw) => (single ? (raw === undefined || raw === null ? undefined : String(raw)) : toList(raw)),
    isEqual: (a, b) => sameList(toList(a), toList(b)),
  });
  const field = useField();
  const bound = props.value === undefined && field?.binding !== undefined;
  const shared = useSharedValue<Wire>(initial);
  const fromToolbar = shared !== undefined && props.value === undefined && !bound;
  const pressed = toList(fromToolbar ? shared.value : own);

  const commit = (list: string[]) => {
    const next: Wire = single ? list[0] : list;
    if (!fromToolbar) return setOwn(next);
    if (sameList(list, pressed)) return;
    shared.set(next);
    emit(next);
  };
  const press = (value: string) => {
    // A radio stays checked when pressed again: a single choice moves, it never clears.
    if (single) commit([value]);
    else commit(pressed.includes(value) ? pressed.filter((v) => v !== value) : [...pressed, value]);
  };
  return { pressed, press, name: props.name ?? fieldName };
}

/**
 * Toggles that share one job (WAI-ARIA APG toolbar example).
 *
 * - `type="multiple"`: independent toggle buttons (`aria-pressed`) in a
 *   `role="group"`: bold, italic, underline.
 * - `type="single"`: a `radiogroup` of `role="radio"` buttons (`aria-checked`):
 *   alignment. APG models a one-of-many choice in a toolbar as radios, so the
 *   choice is announced as one of n and can move but never clear.
 *
 * Name it with `aria-label` (or a `Field.Label`). Pressed and checked items
 * paint the selection pair, as a pressed `IconButton` does.
 *
 * Keyboard: standalone, the group is one tab stop with arrows, Home and End
 * between items (mirrored right to left; natively disabled items passed over).
 * A single group's stop is its checked item and the arrows check as they
 * move (APG radio group). Inside a `Toolbar` the toolbar's roving focus owns
 * the arrows and every item is one of its stops: arrows only move, Space or
 * Enter presses (APG toolbar).
 *
 * Inside a bound `Field` it is a form control: the form holds the value (a
 * string for single, a list for multiple), `name` submits each pressed value.
 *
 * There is no standalone Toggle: one pressed button is `IconButton` or `Button`
 * with `aria-pressed`.
 */
function ToggleGroupRoot(props: ToggleGroupProps) {
  return useContext(MenuFormContext) ? <ToggleGroupMenu {...props} /> : <ToggleGroupBar {...props} />;
}

function ToggleGroupBar(props: ToggleGroupProps) {
  const {
    type,
    value: _value,
    defaultValue: _defaultValue,
    onValueChange: _onValueChange,
    orientation: orientationProp,
    name: _name,
    disabled: disabledProp,
    invalid: invalidProp,
    required: requiredProp,
    id: idProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
    "aria-labelledby": labelledByProp,
    className,
    children,
    onKeyDown,
    ref,
    ...rest
  } = props;
  const single = type === "single";
  const toolbar = useContext(ToolbarContext);
  const orientation = orientationProp ?? toolbar?.orientation ?? "horizontal";
  const rootRef = useRef<HTMLDivElement>(null);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });
  const disabled = field.disabled === true;
  const { pressed, press, name } = useGroupValue(props);
  const roving = useRovingFocusWithin(rootRef, {
    orientation,
    enabled: toolbar === null,
    preferredStop: single ? (items) => items.find((item) => item.getAttribute("aria-checked") === "true") : undefined,
    // A click checks it, through the item's own guard (an aria-disabled radio refuses).
    onNavigate: single ? (item) => item.click() : undefined,
  });

  return (
    <GroupContext value={{ single, pressed, press, disabled }}>
      <div
        role={single ? "radiogroup" : "group"}
        id={field.id}
        aria-labelledby={labelledByProp ?? field.labelId}
        aria-required={(single && field.required) || undefined}
        aria-disabled={disabled || undefined}
        {...field.ariaProps}
        data-invalid={field.invalid ? "" : undefined}
        data-disabled={disabled ? "" : undefined}
        data-orientation={orientation}
        className={cn(
          "r-toolbar-toggle-group inline-flex max-w-full items-center",
          SPACED_CLASSES,
          // Standalone, a row too long for its box wraps; a toolbar unit is max-content and never does.
          orientation === "vertical" ? "flex-col" : "flex-wrap",
          className,
        )}
        {...rest}
        ref={mergeRefs(ref, rootRef)}
        onKeyDown={composeEventHandlers(onKeyDown, roving.onKeyDown)}
      >
        {children}
        {name !== undefined && !disabled && pressed.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
      </div>
    </GroupContext>
  );
}

/** The group as the overflow menu lists it: a labelled set of radio or checkbox items. */
function ToggleGroupMenu(props: ToggleGroupProps) {
  const { pressed, press } = useGroupValue(props);
  const single = props.type === "single";
  const labelId = useId();
  const label = props["aria-label"];
  const labelledBy = label ? labelId : props["aria-labelledby"];
  const disabled = props.disabled === true;
  return (
    <GroupContext value={{ single, pressed, press, disabled }}>
      {label && <DropdownMenu.Label id={labelId}>{label}</DropdownMenu.Label>}
      {single ? (
        <DropdownMenu.RadioGroup aria-labelledby={labelledBy} value={pressed[0]} onValueChange={press}>
          {props.children}
        </DropdownMenu.RadioGroup>
      ) : (
        <div role="group" aria-labelledby={labelledBy} className="flex flex-col">
          {props.children}
        </div>
      )}
    </GroupContext>
  );
}

type ToggleGroupItemContent =
  /** Icon only: `label` names it (and is its tooltip), as on `IconButton`. */
  | { icon: ReactNode; label: string; children?: undefined }
  /** Text, with an optional leading icon. */
  | { children: ReactNode; icon?: ReactNode; label?: undefined };

export type ToggleGroupItemProps = {
  /** What the item contributes to the group's value. */
  value: string;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
} & ToggleGroupItemContent &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value" | "children" | "role" | "type" | "aria-pressed" | "aria-checked" | "aria-label">;

/**
 * One toggle. Icon-only items take `label` (required by type: the icon says
 * nothing). `className` styles the button; other props address it. In the
 * toolbar's overflow menu it becomes a checkbox or radio menu item.
 */
function ToggleGroupItem({ value, icon, label, children, disabled: disabledProp, className, onClick, ...rest }: ToggleGroupItemProps) {
  const group = useContext(GroupContext);
  const inMenu = useContext(MenuFormContext);
  if (!group) throw new Error("<ToggleGroup.Item> must be rendered inside a <ToggleGroup>.");
  const on = group.pressed.includes(value);
  const disabled = disabledProp ?? group.disabled;

  if (inMenu) {
    const text = children ?? label;
    return group.single ? (
      <DropdownMenu.RadioItem value={value} disabled={disabled}>
        {text}
      </DropdownMenu.RadioItem>
    ) : (
      <DropdownMenu.CheckboxItem checked={on} onCheckedChange={() => group.press(value)} disabled={disabled}>
        {text}
      </DropdownMenu.CheckboxItem>
    );
  }

  const state = group.single ? { role: "radio", "aria-checked": on } : { "aria-pressed": on };
  const handleClick = composeEventHandlers(onClick, () => group.press(value));
  const classes = cn(group.single && "aria-checked:bg-selection aria-checked:text-fg-on-selection", className);
  if (children === undefined) {
    return (
      <IconButton {...rest} {...state} label={label ?? ""} icon={icon} disabled={disabled} className={classes} onClick={handleClick} />
    );
  }
  return (
    <Button {...rest} {...state} variant="ghost" iconStart={icon} disabled={disabled} className={classes} onClick={handleClick}>
      {children}
    </Button>
  );
}

export const ToggleGroup = Object.assign(ToggleGroupRoot, { Item: ToggleGroupItem });
