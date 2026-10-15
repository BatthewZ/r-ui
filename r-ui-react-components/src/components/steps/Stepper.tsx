"use client";
import { Check, Minus, X } from "lucide-react";
import { type ComponentPropsWithRef, createContext, type ElementType, type ReactNode, useContext, useId } from "react";

import { elementChildren } from "../../util/children";
import { useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { safeUrl } from "../../util/url";
import { type LabelsProp, mergeLabels } from "../../util/labels";

export type StepperOrientation = "horizontal" | "vertical";
/** Where a step sits relative to the current one. */
export type StepPosition = "complete" | "current" | "upcoming";
/** What happened to a step, over its position: it has errors, or it was skipped. */
export type StepStatus = "error" | "skipped";

/** Every string the Stepper says, for localisation. */
export interface StepperLabels {
  /** The list's name when the caller gives no `label`. */
  progress: string;
  complete: string;
  current: string;
  upcoming: string;
  error: string;
  skipped: string;
  optional: string;
  /** "Step 2 of 5": the collapsed form's lead, and a wizard heading's prefix. */
  position: (step: number, total: number) => string;
}

export const DEFAULT_STEPPER_LABELS: StepperLabels = {
  progress: "Progress",
  complete: "Completed",
  current: "Current step",
  upcoming: "Not started",
  error: "Needs attention",
  skipped: "Skipped",
  optional: "Optional",
  position: (step, total) => `Step ${step} of ${total}`,
};

/*
 * A container query cannot count, so the width the full row needs is stepped by
 * the number of steps (about 9rem each, labels wrapping). Below it the row
 * collapses to "Step 2 of 5 · Name". Literal strings so Tailwind sees each variant.
 */
const COLLAPSE: ReadonlyArray<{ upTo: number; list: string; compact: string }> = [
  { upTo: 2, list: "@max-sm:hidden", compact: "@max-sm:grid" },
  { upTo: 3, list: "@max-lg:hidden", compact: "@max-lg:grid" },
  { upTo: 4, list: "@max-2xl:hidden", compact: "@max-2xl:grid" },
  { upTo: 5, list: "@max-3xl:hidden", compact: "@max-3xl:grid" },
  { upTo: Number.POSITIVE_INFINITY, list: "@max-4xl:hidden", compact: "@max-4xl:grid" },
];

/*
 * The marker's look per state, as utilities so forced colours keep them: the
 * complete fill opts out of repainting with its on-ink, rings become system
 * colours. Width and style live in styles.css (`data-ring`): current and error
 * are a double-weight ring, skipped is dashed. Each state also has its own
 * glyph, so none relies on colour.
 */
const MARKER_TONE: Record<StepPosition | StepStatus, string> = {
  complete: "border-transparent bg-primary text-fg-on-primary",
  current: "border-accent text-fg-accent",
  upcoming: "border-border-strong text-fg-muted",
  error: "border-status-error text-fg-error",
  skipped: "border-border-strong text-fg-muted",
};

const LABEL_TONE: Record<StepPosition, string> = {
  complete: "text-fg-primary",
  current: "font-semibold text-fg-primary",
  upcoming: "text-fg-secondary",
};

/** The collapsed form's progress bar, one segment per step. Decorative: the text says it. */
const SEGMENT_TONE: Record<StepPosition | StepStatus, string> = {
  complete: "bg-primary",
  current: "bg-accent",
  upcoming: "bg-fg-muted/25",
  error: "bg-status-error",
  skipped: "bg-fg-muted/25",
};

interface StepContextValue {
  index: number;
  last: boolean;
  current: number;
  orientation: StepperOrientation;
  onStepSelect: ((index: number) => void) | undefined;
  labels: StepperLabels;
}

const StepContext = createContext<StepContextValue | null>(null);

const positionOf = (index: number, current: number): StepPosition =>
  index < current ? "complete" : index === current ? "current" : "upcoming";

export interface StepperProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  /** The current step's index. `>=` the step count means every step is complete. */
  current: number;
  /** `horizontal` (default) collapses to "Step 2 of 5 · Name" when its own container is narrow. */
  orientation?: StepperOrientation;
  /** The list's name (the `nav` landmark's when steps can be selected). Default `labels.progress`. */
  label?: string;
  /**
   * Makes steps selectable: by default every step before the current one
   * (complete, skipped or in error) renders as a button that calls this.
   * Upcoming steps are never selectable unless a step says `selectable`.
   */
  onStepSelect?: (index: number) => void;
  labels?: LabelsProp<StepperLabels>;
  classNames?: SlotClassNames<"list" | "compact">;
  /** `Stepper.Step` elements, as direct children. */
  children?: ReactNode;
}

/**
 * Progress through an ordered set of steps: an ordered list where each step
 * has a marker, a label and an optional description. Its state (complete,
 * current, upcoming, error, skipped, optional) is carried by the marker's shape
 * and glyph, a word, and `aria-current="step"`, never by colour alone. With
 * `onStepSelect` the list is a `nav` and the steps before the current one are
 * buttons (or links, with `href`).
 */
function StepperRoot({
  current,
  orientation = "horizontal",
  label: labelProp,
  onStepSelect,
  labels: labelsProp,
  className,
  classNames,
  children,
  ...props
}: StepperProps) {
  const steps = elementChildren<StepperStepProps>(children);
  const total = steps.length;
  const words= mergeLabels(DEFAULT_STEPPER_LABELS, labelsProp);
  const label = labelProp ?? words.progress;
  const collapse = orientation === "horizontal" ? COLLAPSE.find((c) => total <= c.upTo) : undefined;
  const interactive = onStepSelect !== undefined;

  const list = (
    <ol
      aria-label={interactive ? undefined : label}
      data-orientation={orientation}
      className={cn(
        "r-steps-list flex min-w-0",
        orientation === "horizontal" ? "items-start gap-r4" : "flex-col",
        collapse?.list,
        classNames?.list,
      )}
    >
      {steps.map((step, index) => (
        <StepContext
          key={step.key ?? index}
          value={{ index, last: index === total - 1, current, orientation, onStepSelect, labels: words }}
        >
          {step}
        </StepContext>
      ))}
    </ol>
  );

  const shown = Math.min(Math.max(current, 0), total - 1);
  const active = steps[shown]?.props;
  const activeState: StepPosition | StepStatus | undefined =
    active?.status ?? (current >= total ? "complete" : undefined);
  const activeMeta = [
    activeState ? words[activeState] : undefined,
    active?.optional ? words.optional : undefined,
  ].filter(Boolean);
  const compact = collapse && active && (
    <div data-compact="" className={cn("hidden min-w-0 gap-r5", collapse.compact, classNames?.compact)}>
      <p className="min-w-0 break-words text-body-1 text-fg-secondary">
        <span className="font-semibold text-fg-primary">{words.position(shown + 1, total)}</span>
        <span aria-hidden> · </span>
        <span className="sr-only">: </span>
        <span className="text-fg-primary">{active.label}</span>
        {activeMeta.length > 0 && (
          <span className={cn(activeState === "error" && "text-fg-error")}>
            <span aria-hidden> · </span>
            <span className="sr-only">, </span>
            {activeMeta.join(", ")}
          </span>
        )}
      </p>
      <div aria-hidden className="flex gap-r6">
        {steps.map((step, index) => (
          <span
            key={step.key ?? index}
            className={cn(
              "r-steps-segment h-r6 min-w-0 flex-1 rounded-full",
              SEGMENT_TONE[step.props.status ?? positionOf(index, current)],
            )}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className={cn("r-steps-stepper @container min-w-0", className)} data-orientation={orientation} {...props}>
      {interactive ? (
        <nav aria-label={label}>
          {list}
          {compact}
        </nav>
      ) : (
        <>
          {list}
          {compact}
        </>
      )}
    </div>
  );
}

export interface StepperStepProps extends Omit<ComponentPropsWithRef<"li">, "children"> {
  label: ReactNode;
  description?: ReactNode;
  /** `error` (it has problems to fix) or `skipped`; shown over its position. */
  status?: StepStatus;
  /** Says "Optional" beside the label. */
  optional?: boolean;
  /** Overrides whether the step can be selected (default: a step before the current one). */
  selectable?: boolean;
  /** Renders a selectable step as a link (through the router config) instead of a button. */
  href?: string;
  classNames?: SlotClassNames<"target" | "marker" | "label" | "meta" | "description" | "connector">;
}

function StepperStep({
  label,
  description,
  status,
  optional = false,
  selectable,
  href,
  className,
  classNames,
  ...props
}: StepperStepProps) {
  const context = useContext(StepContext);
  if (!context) throw new Error("Stepper.Step must be a direct child of a Stepper.");
  const { index, last, current, orientation, onStepSelect, labels } = context;
  const id = useId();
  // A refused href ("") means a button: React drops `href=""`, leaving an `<a>` no keyboard reaches.
  const safeHref = href === undefined ? undefined : safeUrl(href) || undefined;
  const Link: ElementType = useLinkElement(undefined, safeHref, "button");

  const position = positionOf(index, current);
  const state = status ?? position;
  const canSelect = onStepSelect !== undefined && (selectable ?? position === "complete");
  const ring = position === "current" || status === "error" ? "double" : status === "skipped" ? "dashed" : "single";
  const glyph =
    status === "error" ? (
      <X aria-hidden className="size-icon" />
    ) : status === "skipped" ? (
      <Minus aria-hidden className="size-icon" />
    ) : position === "complete" ? (
      <Check aria-hidden className="size-icon" />
    ) : (
      index + 1
    );
  // The current step says so through `aria-current`; a status is said by the visible meta line.
  const hiddenWord = status === undefined && position !== "current" ? labels[position] : undefined;
  const meta = [status ? labels[status] : undefined, optional ? labels.optional : undefined].filter(Boolean);
  const labelId = `${id}label`;
  const metaId = `${id}meta`;
  const descriptionId = `${id}description`;

  const body = (
    <>
      <span
        aria-hidden
        data-ring={ring}
        className={cn(
          "r-steps-marker inline-flex size-(--r-steps-marker) shrink-0 items-center justify-center rounded-full text-body-2 font-medium",
          MARKER_TONE[state],
          classNames?.marker,
        )}
      >
        {glyph}
      </span>
      <span className="r-steps-text grid min-w-0 gap-r6">
        <span id={labelId} className={cn("break-words text-body-1", LABEL_TONE[position], classNames?.label)}>
          {label}
          {hiddenWord && <span className="sr-only">, {hiddenWord}</span>}
        </span>
        {meta.length > 0 && (
          <span
            id={metaId}
            className={cn("text-body-3", status === "error" ? "text-fg-error" : "text-fg-muted", classNames?.meta)}
          >
            {meta.join(" · ")}
          </span>
        )}
        {description && (
          <span id={descriptionId} className={cn("break-words text-body-3 text-fg-muted", classNames?.description)}>
            {description}
          </span>
        )}
      </span>
    </>
  );

  const targetClass = cn(
    "flex min-w-0 items-start gap-r4 rounded-md p-(--r-steps-pad) text-start",
    canSelect && "min-h-hit cursor-pointer transition-colors hover:bg-fg-primary/8 active:bg-fg-primary/12",
    classNames?.target,
  );

  return (
    <li
      className={cn(
        "r-steps-step min-w-0",
        orientation === "horizontal" ? "flex flex-1 items-start gap-r4 last:flex-initial" : "relative pb-r4 last:pb-0",
        className,
      )}
      data-position={position}
      data-status={status}
      aria-current={position === "current" ? "step" : undefined}
      {...props}
    >
      {canSelect ? (
        <Link
          {...(Link === "button" ? { type: "button" } : { href: safeHref })}
          className={targetClass}
          aria-labelledby={meta.length > 0 ? `${labelId} ${metaId}` : labelId}
          aria-describedby={description ? descriptionId : undefined}
          onClick={() => onStepSelect(index)}
        >
          {body}
        </Link>
      ) : (
        <div className={targetClass}>{body}</div>
      )}
      {!last && <span aria-hidden className={cn("r-steps-connector", classNames?.connector)} />}
    </li>
  );
}

export const Stepper = Object.assign(StepperRoot, { Step: StepperStep });
