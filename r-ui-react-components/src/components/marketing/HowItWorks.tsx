import { type ComponentPropsWithRef, createContext, type ReactNode, useContext } from "react";

import { elementChildren } from "../../util/children";
import { cn, type SlotClassNames } from "../../util/style";
import type { FeatureHeadingLevel } from "./FeatureGrid";

/**
 * - `auto` (default): a row of steps once the list's OWN container fits them
 *   (about 12rem a step), a column below that.
 * - `horizontal` / `vertical`: always that form.
 */
export type HowItWorksOrientation = "auto" | "horizontal" | "vertical";

/*
 * A container query cannot count, so the width at which the row fits is a
 * literal container variant chosen by the step count (about 12rem a step). The
 * variant only sets the list's orientation toggle; the layout reads it
 * (styles.css). Literal strings so Tailwind sees each variant.
 */
const AUTO_ROW: ReadonlyArray<{ upTo: number; className: string }> = [
  { upTo: 2, className: "@sm:[--r-marketing-how-h:1]" },
  { upTo: 3, className: "@xl:[--r-marketing-how-h:1]" },
  { upTo: 4, className: "@3xl:[--r-marketing-how-h:1]" },
  { upTo: 5, className: "@4xl:[--r-marketing-how-h:1]" },
  { upTo: Number.POSITIVE_INFINITY, className: "@5xl:[--r-marketing-how-h:1]" },
];

interface StepContextValue {
  index: number;
  last: boolean;
  headingLevel: FeatureHeadingLevel;
}

const StepContext = createContext<StepContextValue | null>(null);

export type HowItWorksProps = {
  orientation?: HowItWorksOrientation;
  /** Every step title's heading level (default 3). */
  headingLevel?: FeatureHeadingLevel;
  /** The list's accessible name, when no heading right before it names the steps. */
  label?: string;
  /** `HowItWorks.Step` elements, as direct children. */
  children?: ReactNode;
  classNames?: SlotClassNames<"list">;
} & Omit<ComponentPropsWithRef<"div">, "children">;

/**
 * Numbered steps explaining a process: an ordered list (`<ol>`), each step a
 * numbered marker, a title, a description and optional media. It speaks the
 * Stepper's visual language (its marker ring, glyph size and density-driven
 * marker size come from the steps group's classes), but it is not progress:
 * no step is current and nothing is selectable.
 *
 * The root is the size container: the steps run in a row joined by a line once
 * the container fits them, and in a column joined by a vertical line below
 * that, whatever the viewport. The number is drawn (decorative); the list's
 * own order is what assistive tech reads.
 */
function HowItWorksRoot({
  orientation = "auto",
  headingLevel = 3,
  label,
  className,
  classNames,
  children,
  ...props
}: HowItWorksProps) {
  const steps = elementChildren<HowItWorksStepProps>(children);
  const total = steps.length;
  const row =
    orientation === "horizontal"
      ? "[--r-marketing-how-h:1]"
      : orientation === "auto"
        ? AUTO_ROW.find((tier) => total <= tier.upTo)?.className
        : undefined;

  return (
    <div className={cn("r-steps-stepper @container min-w-0", className)} {...props}>
      <ol
        aria-label={label}
        data-orientation={orientation}
        data-steps={total}
        className={cn("r-marketing-how-list", row, classNames?.list)}
      >
        {steps.map((step, index) => (
          <StepContext key={step.key ?? index} value={{ index, last: index === total - 1, headingLevel }}>
            {step}
          </StepContext>
        ))}
      </ol>
    </div>
  );
}

export type HowItWorksStepProps = {
  title: ReactNode;
  /** The description, on the prose scale. */
  children?: ReactNode;
  /** An image or illustration for the step, under its text. */
  media?: ReactNode;
  classNames?: SlotClassNames<"marker" | "body" | "title" | "description" | "media" | "connector">;
} & Omit<ComponentPropsWithRef<"li">, "title" | "children">;

function HowItWorksStep({ title, media, children, className, classNames, ...props }: HowItWorksStepProps) {
  const context = useContext(StepContext);
  if (!context) throw new Error("HowItWorks.Step must be a direct child of HowItWorks.");
  const { index, last, headingLevel } = context;
  const Heading = `h${headingLevel}` as const;

  return (
    <li data-print="avoid-break" className={cn("r-marketing-how-step", className)} {...props}>
      <span
        aria-hidden
        data-ring="single"
        className={cn(
          "r-steps-marker inline-flex size-(--r-steps-marker) shrink-0 items-center justify-center rounded-full border-border-strong text-body-2 font-medium text-fg-primary",
          classNames?.marker,
        )}
      >
        {index + 1}
      </span>
      <div className={cn("r-marketing-how-body", classNames?.body)}>
        <Heading className={cn("r-marketing-how-title break-words text-pretty text-display-4 text-fg-primary", classNames?.title)}>
          {title}
        </Heading>
        {children != null && (
          <div className={cn("mt-r4 break-words text-pretty text-prose-3 text-fg-secondary", classNames?.description)}>
            {children}
          </div>
        )}
        {media != null && <div className={cn("mt-r3 min-w-0", classNames?.media)}>{media}</div>}
      </div>
      {!last && <span aria-hidden className={cn("r-marketing-how-connector", classNames?.connector)} />}
    </li>
  );
}

/** `HowItWorks` with its `HowItWorks.Step`. */
export const HowItWorks = Object.assign(HowItWorksRoot, { Step: HowItWorksStep });
