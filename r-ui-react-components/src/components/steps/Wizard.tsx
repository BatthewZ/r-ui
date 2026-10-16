"use client";
import {
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useStoreSnapshot } from "../../hooks/use-store-snapshot";
import { elementChildren } from "../../util/children";
import { reportUncaught } from "../../util/report-uncaught";
import { cn, type SlotClassNames } from "../../util/style";
import { type FieldValidatorResult, Form, FormActions, type FormApi } from "../form";
import { Button } from "../primitives";

import { DEFAULT_STEPPER_LABELS, Stepper, type StepperLabels, type StepperOrientation, type StepStatus } from "./Stepper";
import { type LabelsProp, useLabels } from "../../util/locale";

/** Errors by path (as `setErrors` takes them); nothing, or only empty messages, lets the step pass. */
export type WizardStepErrors = Record<string, FieldValidatorResult>;

export interface WizardStepValidatorContext<TValues> {
  /** Every value in the form. */
  values: TValues;
  /** Aborted when the user leaves the step (Back, a step in the Stepper) or the Wizard unmounts. */
  signal: AbortSignal;
}

export interface WizardStepProps<TValues = unknown> {
  /** The step's name: its Stepper label and its heading. */
  label: ReactNode;
  /** A line under the label in the Stepper. */
  description?: ReactNode;
  /**
   * The form paths this step owns (`email`, `members`): only their errors block
   * Next, and Next reveals them. A step without fields never blocks.
   */
  fields?: readonly string[];
  /** Offers "Skip" and says "Optional" in the Stepper. */
  optional?: boolean;
  /**
   * A check of the whole step once its fields pass, typically async ("are these
   * people already members?"). Returns errors by path, shown like server errors
   * (they clear when that value changes); Next waits for it, busy.
   */
  validate?: (
    context: WizardStepValidatorContext<TValues>,
  ) => WizardStepErrors | void | Promise<WizardStepErrors | void>;
  /** The step's content: its Fields. Rendered only while the step is current. */
  children?: ReactNode;
}

/** One step of a `Wizard`. A direct child of it; the Wizard renders the current one. */
function WizardStep<TValues = unknown>({ children }: WizardStepProps<TValues>) {
  return <>{children}</>;
}

/** Every string the Wizard says (its Stepper's included), for localisation. */
export interface WizardLabels extends StepperLabels {
  back: string;
  next: string;
  skip: string;
  /** The last step's primary action ("Create rule"). */
  finish: string;
}

export const DEFAULT_WIZARD_LABELS: WizardLabels = {
  ...DEFAULT_STEPPER_LABELS,
  back: "Back",
  next: "Next",
  skip: "Skip",
  finish: "Finish",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Wizard: WizardLabels;
  }
}

export type WizardHeadingLevel = 2 | 3 | 4 | 5 | 6;

export interface WizardProps<TValues, TOutput> extends Omit<ComponentPropsWithRef<"div">, "children" | "onSubmit"> {
  /**
   * The form the steps fill (`useForm`). The Wizard renders its `Form`: Next
   * (and Enter in a field) checks the current step, the last step submits the
   * whole form. Without one the steps are plain content and Finish calls `onComplete`.
   */
  form?: FormApi<TValues, TOutput>;
  /** The current step's index (controlled). */
  step?: number;
  defaultStep?: number;
  onStepChange?: (step: number) => void;
  /** Finish was pressed (plain steps), or the form's `onSubmit` succeeded. */
  onComplete?: () => void;
  orientation?: StepperOrientation;
  /** The Stepper's name. Default `labels.progress`. */
  label?: string;
  /** The step heading's level. Default 2. */
  headingLevel?: WizardHeadingLevel;
  labels?: LabelsProp<WizardLabels>;
  classNames?: SlotClassNames<"stepper" | "panel" | "heading" | "actions">;
  /** `Wizard.Step` elements, as direct children. */
  children?: ReactNode;
}

/**
 * A multi-step flow over one form: a `Stepper`, the current step's content
 * under its heading, and Back / Skip / Next in a `FormActions` row. Each step
 * names the fields it owns; Next validates only those (plus the step's own
 * `validate`) and, when one fails, focuses the first invalid field. Back keeps
 * every value. The last step submits the whole form; an error left on an
 * earlier step takes the user back there. Every step change moves focus to the
 * new step's heading, which reads "Step 2 of 5: Name".
 */
function WizardRoot<TValues, TOutput>({
  form,
  step,
  defaultStep = 0,
  onStepChange,
  onComplete,
  orientation = "horizontal",
  label,
  headingLevel = 2,
  labels,
  className,
  classNames,
  children,
  ...props
}: WizardProps<TValues, TOutput>) {
  const steps = elementChildren<WizardStepProps>(children);
  const total = steps.length;
  const words = useLabels("Wizard", DEFAULT_WIZARD_LABELS, labels);
  const [current, setCurrent] = useControllableState({
    value: step,
    defaultValue: defaultStep,
    onChange: onStepChange,
  });
  const index = Math.min(Math.max(current, 0), total - 1);
  const active = steps[index];
  const last = index === total - 1;

  const [skipped, setSkipped] = useState<ReadonlySet<number>>(() => new Set());
  const [checking, setChecking] = useState(false);
  const checkRef = useRef<AbortController | null>(null);
  /** Paths whose step `validate` set errors, by step: cleared before that step asks again. */
  const stepErrorPaths = useRef(new Map<number, string[]>());

  // Which steps have an error on show (a failed Next, a failed submit): their markers say so.
  const store = form?.store;
  const showsError = (s: ReactElement<WizardStepProps>) => Boolean(s.props.fields?.length && store?.hasErrorWithin(s.props.fields));
  // A string, so an unchanged answer is the same snapshot.
  const errorSteps = useStoreSnapshot(store, () => steps.map((s) => (showsError(s) ? "1" : "0")).join("")) ?? "";

  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  // What focus does once the new step has committed: its heading, or its first invalid field.
  const focusOnArrival = useRef<"heading" | "error">("heading");
  const shown = useRef(index);
  useEffect(() => {
    if (shown.current === index) return;
    shown.current = index;
    const target = focusOnArrival.current;
    focusOnArrival.current = "heading";
    if (target === "error" && store?.focusFirstError(steps[index]?.props.fields ?? [])) return;
    headingRef.current?.focus();
  });

  // After a failed Next: focus the first invalid field once its error has rendered.
  const [errorFocus, setErrorFocus] = useState<{ paths: readonly string[] } | null>(null);
  useEffect(() => {
    if (errorFocus) store?.focusFirstError(errorFocus.paths);
  }, [errorFocus, store]);

  const cancelCheck = useCallback(() => {
    checkRef.current?.abort();
    checkRef.current = null;
    setChecking(false);
  }, []);
  useEffect(() => () => checkRef.current?.abort(), []);

  const goTo = (next: number, focus: "heading" | "error" = "heading") => {
    cancelCheck();
    focusOnArrival.current = focus;
    setCurrent(next);
  };

  const markSkipped = (at: number, value: boolean) =>
    setSkipped((prev) => {
      if (prev.has(at) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(at);
      else next.delete(at);
      return next;
    });

  /** Validates the current step; resolves to whether it may be left forwards. */
  const checkStep = async (): Promise<boolean> => {
    const { fields = [], validate } = active?.props ?? {};
    if (!form || (fields.length === 0 && !validate)) return true;
    const controller = new AbortController();
    checkRef.current?.abort();
    checkRef.current = controller;
    setChecking(true);
    const at = index;
    try {
      let ok = fields.length === 0 || (await form.validatePaths(fields));
      let focusPaths: readonly string[] = fields;
      if (ok && validate && !controller.signal.aborted) {
        const previous = stepErrorPaths.current.get(at) ?? [];
        if (previous.length) form.setErrors(Object.fromEntries(previous.map((path) => [path, null])));
        let errors: WizardStepErrors | void;
        try {
          errors = await validate({ values: form.getValues(), signal: controller.signal });
        } catch (error) {
          // A check that rejects because it was aborted is expected.
          if (controller.signal.aborted) return false;
          throw error;
        }
        if (controller.signal.aborted) return false;
        const failed = Object.entries(errors ?? {}).filter(([, message]) => Boolean(message));
        if (failed.length) {
          const failedPaths = failed.map(([path]) => path);
          stepErrorPaths.current.set(at, failedPaths);
          form.setErrors(Object.fromEntries(failed));
          focusPaths = [...fields, ...failedPaths];
          ok = false;
        }
      }
      if (controller.signal.aborted) return false;
      if (!ok) setErrorFocus({ paths: focusPaths });
      return ok;
    } finally {
      if (checkRef.current === controller) {
        checkRef.current = null;
        setChecking(false);
      }
    }
  };

  const next = async (): Promise<boolean> => {
    if (checking || last) return false;
    if (!(await checkStep())) return false;
    markSkipped(index, false);
    goTo(index + 1);
    return true;
  };

  const skip = () => {
    markSkipped(index, true);
    goTo(index + 1);
  };

  const finish = async (): Promise<boolean> => {
    if (!form) {
      onComplete?.();
      return true;
    }
    if (!(await form.submit())) {
      // The first step, in order, with an error on show; if it is an earlier one, go there.
      const target = steps.findIndex(showsError);
      if (target !== -1 && target !== index) goTo(target, "error");
      return false;
    }
    onComplete?.();
    return true;
  };

  // The Form runs this on a native submit: Next on every step but the last.
  const submitRef = useRef<() => Promise<boolean>>(async () => false);
  submitRef.current = last ? finish : next;
  const wizardForm = useMemo(() => (form ? { ...form, submit: () => submitRef.current() } : undefined), [form]);

  const Heading = `h${headingLevel}` as const;
  const panel = active && (
    <section
      key={index}
      aria-labelledby={headingId}
      className={cn("grid min-w-0 animate-fade-in gap-r3", classNames?.panel)}
    >
      <Heading
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className={cn("min-w-0 break-words text-h4", classNames?.heading)}
      >
        <span className="sr-only">{words.position(index + 1, total)}: </span>
        {active.props.label}
      </Heading>
      {active}
    </section>
  );

  // FormActions keeps a press from taking focus from the field (a blur-time
  // error would shift the row under the pointer); focus moves on purpose
  // afterwards (the next heading, or the first invalid field).
  const actions = (
    <FormActions className={classNames?.actions}>
      {index > 0 && (
        <Button
          type="button"
          variant="secondary"
          className="@sm:me-auto"
          onClick={() => goTo(index - 1)}
        >
          {words.back}
        </Button>
      )}
      {active?.props.optional && !last && (
        <Button type="button" variant="ghost" onClick={skip}>
          {words.skip}
        </Button>
      )}
      {last ? (
        form ? (
          <FormActions.Submit>{words.finish}</FormActions.Submit>
        ) : (
          <Button type="button" onClick={() => void finish()}>
            {words.finish}
          </Button>
        )
      ) : (
        <Button
          type={form ? "submit" : "button"}
          loading={checking}
          onClick={form ? undefined : () => void next().catch(reportUncaught)}
        >
          {words.next}
        </Button>
      )}
    </FormActions>
  );

  return (
    <div className={cn("@container min-w-0", className)} {...props}>
      <div
        className={cn(
          "grid min-w-0 gap-r2",
          // Vertical: the Stepper beside the step once the Wizard is wide enough.
          orientation === "vertical" &&
            "@2xl:grid-cols-[var(--COLUMN-SM)_minmax(0,1fr)] @2xl:items-start @2xl:gap-x-r1",
        )}
      >
        <Stepper
          current={index}
          orientation={orientation}
          label={label}
          labels={words}
          onStepSelect={(at) => goTo(at)}
          className={classNames?.stepper}
        >
          {steps.map((s, at) => {
            const status: StepStatus | undefined =
              errorSteps[at] === "1" ? "error" : skipped.has(at) && at !== index ? "skipped" : undefined;
            return (
              <Stepper.Step
                key={s.key ?? at}
                label={s.props.label}
                description={s.props.description}
                optional={s.props.optional}
                status={status}
              />
            );
          })}
        </Stepper>
        {wizardForm ? (
          <Form form={wizardForm} className="grid min-w-0 gap-r2">
            {panel}
            {actions}
          </Form>
        ) : (
          <div className="grid min-w-0 gap-r2">
            {panel}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export const Wizard = Object.assign(WizardRoot, { Step: WizardStep });
