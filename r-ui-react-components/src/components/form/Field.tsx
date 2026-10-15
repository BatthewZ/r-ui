"use client";
import {
  type ChangeEvent,
  type ComponentPropsWithRef,
  createContext,
  type FocusEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState, type UseControllableStateParams } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { ErrorLine } from "../../util/error-line";
import { cn, type SlotClassNames } from "../../util/style";

import { useStoreSnapshot } from "../../hooks/use-store-snapshot";
import { useFormStore } from "./form-state-context";
import { canonicalPath } from "./form-state-path";
import type { FieldStateSnapshot, FieldValidator } from "./form-state-store";

// One id each: the control and the label. Any number each: descriptions,
// errors (a control may show its own beside the form's), and `outlet`s, the
// Field.Errors that will show the form's message for this field.
type SingleSlot = "control" | "label";
type ListSlot = "description" | "error" | "outlet";
type Slot = SingleSlot | ListSlot;
const isListSlot = (slot: Slot): slot is ListSlot => slot !== "control" && slot !== "label";

type Mounted = Partial<Record<SingleSlot, string>> & Record<ListSlot, readonly string[]>;
const NOTHING_MOUNTED: Mounted = { description: [], error: [], outlet: [] };

/** A Field's link to its `Form`: the field's state, and the way to change its value. */
export interface FieldBinding extends FieldStateSnapshot {
  /** The canonical path (`conditions[0].metric`); also the control's native `name`. */
  name: string;
  setValue: (value: unknown) => void;
}

interface FieldContextValue {
  /** The id the control renders with: the caller's, once registered, else the generated one. */
  controlId: string;
  /** Ids of the parts that actually rendered. An IDREF is only ever one of these. */
  labelId: string | undefined;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
  disabled: boolean;
  readOnly: boolean;
  orientation: "vertical" | "horizontal";
  /** The Field's `name` as a canonical path: the control's native `name`. */
  name: string | undefined;
  /** Present when the Field has a `name` inside a `Form`: the form owns the control's value. */
  binding: FieldBinding | undefined;
  ids: Record<SingleSlot, string>;
  register: (slot: Slot, id: string) => () => void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** The surrounding Field, or `null` outside one. */
export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

const hasContent = (node: ReactNode) => node !== undefined && node !== null && node !== false && node !== "";

/**
 * Registers the id a part rendered with, for as long as it is mounted. The
 * element that owns an id is the one that publishes it, so a reference never
 * points at a part that rendered nothing or took the caller's own id.
 */
function useRegister(slot: Slot, id: string | undefined, active: boolean) {
  const field = useField();
  const register = field?.register;
  useEffect(() => {
    if (!register || !active || id === undefined) return;
    return register(slot, id);
  }, [register, slot, id, active]);
}

/**
 * For a control that renders a message of its own (a date field's "not a
 * date"): registers the element's id with the surrounding Field while `shown`,
 * so the Field is invalid (for an error) and describes its control with it,
 * beside any `Field.Description` / `Field.Error`. No-op outside a Field, where
 * the control names the message in its own `aria-describedby`.
 */
export function useFieldMessage(kind: "description" | "error", id: string, shown: boolean): void {
  useRegister(kind, id, shown);
}

export interface FieldControlProps {
  id?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
}

export interface FieldControlState {
  id: string | undefined;
  invalid: boolean;
  required: boolean | undefined;
  disabled: boolean | undefined;
  readOnly: boolean | undefined;
  /** Id of the Field's mounted label, for controls a `<label for>` cannot name (groups). */
  labelId: string | undefined;
  /** True when a Field label (or any caller name) names the control. */
  inField: boolean;
  ariaProps: {
    "aria-describedby": string | undefined;
    "aria-invalid": FieldControlProps["aria-invalid"];
  };
}

/**
 * Resolves a control's id, ARIA wiring and states from its own props and the
 * surrounding Field. Per key: the control's own prop wins where the caller set
 * one; the Field fills the rest. `aria-describedby` is the union of both.
 */
export function useFieldControl(props: FieldControlProps): FieldControlState {
  const field = useField();
  const invalid = props.invalid ?? field?.invalid ?? false;
  // A caller's own id is published to the Field, so Field.Label's `for` follows it.
  useRegister("control", props.id, props.id !== undefined);
  // Union, once each: a control that registers its own message with the Field
  // may also name it itself (it must, to work outside a Field).
  const describedBy =
    [...new Set(`${props["aria-describedby"] ?? ""} ${field?.describedBy ?? ""}`.split(" ").filter(Boolean))].join(" ") ||
    undefined;
  return {
    id: props.id ?? field?.controlId,
    invalid,
    required: props.required ?? (field?.required || undefined),
    disabled: props.disabled ?? (field?.disabled || undefined),
    readOnly: props.readOnly ?? (field?.readOnly || undefined),
    labelId: field?.labelId,
    inField: field?.labelId !== undefined,
    ariaProps: {
      "aria-describedby": describedBy,
      "aria-invalid": invalid ? true : props["aria-invalid"],
    },
  };
}

export interface UseFieldValueParams<T> extends UseControllableStateParams<T> {
  /** Reads the form's value at the Field's path as this control's value (e.g. `undefined` → `false`). */
  fromForm: (value: unknown) => T;
}

/**
 * A value-based control's state: `useControllableState`, plus the form. Inside
 * a Field bound to a `Form`, and with no `value` from the caller, the form owns
 * the value and the setter writes to it (the caller's `onChange` still runs).
 * The third item is the native `name` to render (the caller's `name` wins).
 */
export function useFieldValue<T>({
  fromForm,
  ...params
}: UseFieldValueParams<T>): [T, (next: T | ((prev: T) => T)) => void, string | undefined] {
  const field = useField();
  const binding = params.value === undefined ? field?.binding : undefined;
  const [own, setOwn] = useControllableState(params);
  const latest = useRef({ binding, fromForm, onChange: params.onChange, isEqual: params.isEqual });
  latest.current = { binding, fromForm, onChange: params.onChange, isEqual: params.isEqual };
  const setBound = useCallback((next: T | ((prev: T) => T)) => {
    const { binding: bound, fromForm: read, onChange, isEqual } = latest.current;
    if (!bound) return;
    const current = read(bound.value);
    const resolved = typeof next === "function" ? (next as (prev: T) => T)(current) : next;
    if ((isEqual ?? Object.is)(resolved, current)) return;
    bound.setValue(resolved);
    onChange?.(resolved);
  }, []);
  return binding ? [fromForm(binding.value), setBound, field?.name] : [own, setOwn, field?.name];
}

type NativeValue = string | number | readonly string[];

export interface FieldInputProps {
  name?: string;
  value?: NativeValue;
  defaultValue?: NativeValue;
  // Method syntax: an `<input>`'s, `<textarea>`'s or `<select>`'s handler all fit.
  onChange?(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void;
}

/**
 * A native text control's props (`<input>`, `<textarea>`, `<select>`), bound to
 * the form when the surrounding Field is and the caller passed no `value`: the
 * form's value as text, and `onChange` writing back (after the caller's). Also
 * fills the native `name` from the Field. A control whose `value` the caller
 * (or a composite such as a date picker, with its own hidden input) passes is
 * left exactly as given.
 */
export function useFieldInputProps<P extends FieldInputProps>(props: P): P {
  const field = useField();
  if (props.value !== undefined) return props;
  const binding = field?.binding;
  const name = props.name ?? field?.name;
  if (!binding) return name === props.name ? props : { ...props, name };
  return {
    ...props,
    name,
    value: binding.value === undefined || binding.value === null ? "" : String(binding.value),
    // The form holds the value; a `defaultValue` beside `value` is a React error.
    defaultValue: undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      props.onChange?.(event);
      binding.setValue(event.target.value);
    },
  };
}

const FOCUSABLE = "input:not([type=hidden]), select, textarea, button, [tabindex]:not([tabindex='-1']), [contenteditable='true']";

/** Where focus goes for this Field: its control, or the checked (else first) option of a group control. */
function focusTarget(root: HTMLElement | null, controlId: string): HTMLElement | null {
  if (!root) return null;
  const control = root.ownerDocument.getElementById(controlId);
  const scope = control && root.contains(control) ? control : root;
  if (scope !== root && scope.matches(FOCUSABLE)) return scope;
  return (
    scope.querySelector<HTMLElement>("input:checked:not(:disabled)") ??
    [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => !el.matches(":disabled")) ??
    null
  );
}

/** An element's text as read aloud: without its `aria-hidden` parts (the required star). */
function spokenText(id: string | undefined): string | undefined {
  const element = id ? document.getElementById(id) : null;
  if (!element) return undefined;
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent?.trim() || undefined;
}

export interface FieldProps extends ComponentPropsWithRef<"div"> {
  /**
   * The value's path in the surrounding `Form` (`email`, `conditions[0].metric`).
   * Binds the control inside to the form: its value, error, touched and pending
   * state. Outside a `Form` it is only the control's native `name`.
   */
  name?: string;
  /**
   * A check of this field alone, typically async ("is this name taken?"). It
   * runs on the form's validation triggers once the schema accepts the value,
   * gets an `AbortSignal` that a newer check aborts, and returns a message or
   * nothing. Only inside a `Form`.
   */
  validate?: FieldValidator;
  /**
   * Marks the control invalid. Defaults to whether a `Field.Error` with content
   * is mounted (or the form has an error for this field), so
   * `<Field.Error>{errors.email}</Field.Error>` is the whole wiring.
   */
  invalid?: boolean;
  /** Sets `required` on the control and shows the label's marker. */
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  /**
   * `horizontal` puts the label beside the control once the Field's OWN width
   * reaches the container `md` step, and stacks below it. Never the viewport.
   */
  orientation?: "vertical" | "horizontal";
  classNames?: SlotClassNames<"layout">;
}

function FieldRoot({
  name,
  validate,
  invalid,
  required = false,
  disabled = false,
  readOnly = false,
  orientation = "vertical",
  className,
  classNames,
  children,
  ref,
  onBlur,
  ...props
}: FieldProps) {
  const base = useId();
  const ids = useMemo<Record<SingleSlot, string>>(() => ({ control: `${base}control`, label: `${base}label` }), [base]);
  const [mounted, setMounted] = useState<Mounted>(NOTHING_MOUNTED);

  const register = useCallback((slot: Slot, id: string) => {
    if (isListSlot(slot)) {
      const list = slot;
      setMounted((prev) => (prev[list].includes(id) ? prev : { ...prev, [list]: [...prev[list], id] }));
      return () =>
        setMounted((prev) => (prev[list].includes(id) ? { ...prev, [list]: prev[list].filter((x) => x !== id) } : prev));
    }
    const single = slot;
    setMounted((prev) => (prev[single] === id ? prev : { ...prev, [single]: id }));
    return () =>
      setMounted((prev) => {
        if (prev[single] !== id) return prev;
        const next = { ...prev };
        delete next[single];
        return next;
      });
  }, []);

  // Form binding: only with a `name`, inside a `Form`.
  const store = useFormStore();
  const path = name === undefined ? undefined : canonicalPath(name);
  const snapshot = useStoreSnapshot(store, (bound) => (path === undefined ? undefined : bound.getFieldSnapshot(path)));
  const setValue = useCallback(
    (value: unknown) => {
      if (store && path !== undefined) store.change(path, value);
    },
    [store, path],
  );
  const binding = useMemo<FieldBinding | undefined>(
    () => (snapshot && path !== undefined ? { ...snapshot, name: path, setValue } : undefined),
    [snapshot, path, setValue],
  );

  const controlId = mounted.control ?? ids.control;
  const rootRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ controlId, labelId: mounted.label, validate });
  latest.current = { controlId, labelId: mounted.label, validate };
  const checks = validate !== undefined;
  useEffect(() => {
    if (!store || path === undefined) return;
    return store.registerField(path, {
      getElement: () => focusTarget(rootRef.current, latest.current.controlId),
      getLabel: () => spokenText(latest.current.labelId),
      validate: checks ? (value, context) => latest.current.validate?.(value, context) : undefined,
    });
  }, [store, path, checks]);

  // Focus leaving the whole Field (not moving between its parts, or into a
  // panel rendered in place inside it) is the field's blur.
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!store || path === undefined) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    store.blur(path);
  };

  const formError = binding?.error;
  const resolvedInvalid = invalid ?? (mounted.error.length > 0 || formError !== undefined);
  // The outlets count in the same render the form's message appears, so focus
  // moved to the control right after a failed submit already reads it.
  const errorIds = formError === undefined ? mounted.error : [...mounted.error, ...mounted.outlet];
  const describedBy = [...new Set([...mounted.description, ...errorIds])].join(" ") || undefined;

  const context = useMemo<FieldContextValue>(
    () => ({
      controlId,
      labelId: mounted.label,
      describedBy,
      invalid: resolvedInvalid,
      required,
      disabled,
      readOnly,
      orientation,
      name: path,
      binding,
      ids,
      register,
    }),
    [controlId, mounted.label, ids, describedBy, resolvedInvalid, required, disabled, readOnly, orientation, path, binding, register],
  );

  return (
    <FieldContext value={context}>
      {/* The root is the size container; the layout grid inside queries it
          (an element cannot query its own width). */}
      <div
        ref={mergeRefs(ref, rootRef)}
        className={cn("@container min-w-0", className)}
        data-disabled={disabled ? "" : undefined}
        data-invalid={resolvedInvalid ? "" : undefined}
        data-validating={binding?.validating ? "" : undefined}
        onBlur={composeEventHandlers(onBlur, handleBlur)}
        {...props}
      >
        <div
          data-orientation={orientation}
          className={cn(
            // One column that may shrink below its content: an `auto` track would size to
            // a wide control (a segmented control) and push it out of a narrow field.
            "grid min-w-0 grid-cols-[minmax(0,1fr)] gap-r5",
            orientation === "horizontal" &&
              "@md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] @md:gap-x-r2 @md:[&>:not([data-field-label])]:col-start-2",
            // The label is centred in a control-height row; a check row or a
            // radio list is one text line tall, so drop its first line to meet it.
            // A radio list's rows already pad themselves to the hit floor.
            orientation === "horizontal" &&
              "@md:[&>.r-form-check]:pt-[calc((var(--CONTROL-H)-var(--BodyText-1-line-height))/2)]",
            orientation === "horizontal" &&
              "@md:[&>[role=radiogroup]]:pt-[calc((var(--CONTROL-H)-max(var(--HIT-MIN),var(--BodyText-1-line-height)))/2)]",
            classNames?.layout,
          )}
        >
          {children}
        </div>
      </div>
    </FieldContext>
  );
}

export interface FieldLabelProps extends ComponentPropsWithRef<"label"> {
  /** Overrides the Field's `required` for the marker only. */
  required?: boolean;
}

function FieldLabel({ className, id: idProp, required, children, ...props }: FieldLabelProps) {
  const field = useField();
  const id = idProp ?? field?.ids.label;
  useRegister("label", id, true);
  const showMarker = required ?? field?.required ?? false;
  const horizontal = field?.orientation === "horizontal";
  return (
    <label
      id={id}
      htmlFor={field?.controlId}
      data-field-label=""
      className={cn(
        "justify-self-start text-body-1 font-medium text-fg-primary",
        field?.disabled && "opacity-disabled",
        horizontal && "@md:flex @md:min-h-control @md:items-center @md:self-start",
        className,
      )}
      {...props}
    >
      {children}
      {/* The control carries `required`, which is what assistive tech reads; the
          star is the sighted twin, so it stays out of the accessible name. */}
      {showMarker && (
        <span aria-hidden className="ms-r6 text-fg-muted">
          *
        </span>
      )}
    </label>
  );
}

export type FieldDescriptionProps = ComponentPropsWithRef<"p">;

function FieldDescription({ className, id: idProp, children, ...props }: FieldDescriptionProps) {
  const field = useField();
  const generated = useId();
  const id = idProp ?? generated;
  const shown = hasContent(children);
  useRegister("description", id, shown);
  if (!shown) return null;
  return (
    <p
      id={id}
      className={cn("text-body-2 text-fg-muted", field?.disabled && "opacity-disabled", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export interface FieldErrorProps extends ComponentPropsWithRef<"p"> {
  /** The leading status icon. `null` removes it. */
  icon?: ReactNode;
}

/**
 * Renders nothing without content, and then neither marks the Field invalid
 * nor appears in `aria-describedby`. Not a live region: an inline message that
 * re-announces on every keystroke is noise. Move focus to the first invalid
 * control on submit; this message is then read as its description.
 *
 * Its own children win; without any, in a Field bound to a `Form`, it shows
 * the form's message for the field.
 */
function FieldError({ className, id: idProp, icon, children, ...props }: FieldErrorProps) {
  const field = useField();
  const generated = useId();
  const id = idProp ?? generated;
  const content = hasContent(children) ? children : field?.binding?.error;
  const shown = hasContent(content);
  useRegister("error", id, shown);
  useRegister("outlet", id, field?.binding !== undefined);
  if (!shown) return null;
  return (
    <ErrorLine id={id} icon={icon} className={className} {...props}>
      {content}
    </ErrorLine>
  );
}

/**
 * A labelled form control. Wires the control's `id`, `aria-describedby`,
 * `aria-invalid`, `required`, `disabled` and `readOnly` through context, from
 * the parts that actually rendered. With a `name` inside a `Form`, it also
 * binds the control's value and shows the form's error for it.
 *
 * ```tsx
 * <Field required>
 *   <Field.Label>Email</Field.Label>
 *   <Input type="email" />
 *   <Field.Description>We never share it.</Field.Description>
 *   <Field.Error>{errors.email}</Field.Error>
 * </Field>
 * ```
 */
export const Field = Object.assign(FieldRoot, {
  Label: FieldLabel,
  Description: FieldDescription,
  Error: FieldError,
});
