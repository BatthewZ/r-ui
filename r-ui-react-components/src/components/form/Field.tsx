"use client";
import { CircleAlert } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import { cn, type SlotClassNames } from "../../util/style";

type Slot = "control" | "label" | "description" | "error";

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
  ids: Record<Slot, string>;
  register: (slot: Slot, id: string) => () => void;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** The surrounding Field, or `null` outside one. */
export function useField(): FieldContextValue | null {
  return useContext(FieldContext);
}

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
  const describedBy =
    [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined;
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

export interface FieldProps extends ComponentPropsWithRef<"div"> {
  /**
   * Marks the control invalid. Defaults to whether a `Field.Error` with content
   * is mounted, so `<Field.Error>{errors.email}</Field.Error>` is the whole wiring.
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
  invalid,
  required = false,
  disabled = false,
  readOnly = false,
  orientation = "vertical",
  className,
  classNames,
  children,
  ...props
}: FieldProps) {
  const base = useId();
  const ids = useMemo<Record<Slot, string>>(
    () => ({
      control: `${base}control`,
      label: `${base}label`,
      description: `${base}description`,
      error: `${base}error`,
    }),
    [base],
  );
  const [mounted, setMounted] = useState<Partial<Record<Slot, string>>>({});

  const register = useCallback((slot: Slot, id: string) => {
    setMounted((prev) => (prev[slot] === id ? prev : { ...prev, [slot]: id }));
    return () =>
      setMounted((prev) => {
        if (prev[slot] !== id) return prev;
        const next = { ...prev };
        delete next[slot];
        return next;
      });
  }, []);

  const resolvedInvalid = invalid ?? mounted.error !== undefined;
  const describedBy =
    [mounted.description, mounted.error].filter(Boolean).join(" ") || undefined;

  const context = useMemo<FieldContextValue>(
    () => ({
      controlId: mounted.control ?? ids.control,
      labelId: mounted.label,
      describedBy,
      invalid: resolvedInvalid,
      required,
      disabled,
      readOnly,
      orientation,
      ids,
      register,
    }),
    [mounted.control, mounted.label, ids, describedBy, resolvedInvalid, required, disabled, readOnly, orientation, register],
  );

  return (
    <FieldContext value={context}>
      {/* The root is the size container; the layout grid inside queries it
          (an element cannot query its own width). */}
      <div
        className={cn("@container min-w-0", className)}
        data-disabled={disabled ? "" : undefined}
        data-invalid={resolvedInvalid ? "" : undefined}
        {...props}
      >
        <div
          data-orientation={orientation}
          className={cn(
            "grid min-w-0 gap-r5",
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
  const id = idProp ?? field?.ids.description;
  const hasContent = children !== undefined && children !== null && children !== false && children !== "";
  useRegister("description", id, hasContent);
  if (!hasContent) return null;
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
 */
function FieldError({ className, id: idProp, icon, children, ...props }: FieldErrorProps) {
  const field = useField();
  const id = idProp ?? field?.ids.error;
  const hasContent = children !== undefined && children !== null && children !== false && children !== "";
  useRegister("error", id, hasContent);
  if (!hasContent) return null;
  return (
    <p id={id} className={cn("flex items-start gap-r5 text-body-2 text-fg-error", className)} {...props}>
      {icon === undefined ? (
        <span className="flex h-(--BodyText-2-line-height) shrink-0 items-center">
          <CircleAlert aria-hidden className="size-icon text-status-error" />
        </span>
      ) : (
        icon
      )}
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/**
 * A labelled form control. Wires the control's `id`, `aria-describedby`,
 * `aria-invalid`, `required`, `disabled` and `readOnly` through context, from
 * the parts that actually rendered.
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
