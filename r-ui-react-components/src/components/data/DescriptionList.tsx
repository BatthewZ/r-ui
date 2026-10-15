import type { HTMLAttributes, ReactNode, Ref } from "react";

import { cn, type SlotClassNames } from "../../util/style";

export interface DescriptionListProps extends HTMLAttributes<HTMLDListElement> {
  /** `divided` draws a hairline between items; `plain` separates by space alone. */
  variant?: "plain" | "divided";
  ref?: Ref<HTMLDListElement>;
}

/**
 * Term / value pairs ("Region: eu-west"). A size container: in a narrow box
 * each term sits above its value; from 24rem of its OWN width the terms take
 * a column and values line up beside them.
 */
function DescriptionListRoot({ variant = "plain", className, ref, ...rest }: DescriptionListProps) {
  return (
    <dl
      ref={ref}
      data-variant={variant}
      className={cn("@container/dl flex min-w-0 flex-col", variant === "plain" && "gap-r4", className)}
      {...rest}
    />
  );
}

export interface DescriptionListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  term: ReactNode;
  /** The value. Missing data should read "—" (`MISSING`), never blank. */
  children: ReactNode;
  classNames?: SlotClassNames<"term" | "details">;
  ref?: Ref<HTMLDivElement>;
}

function DescriptionListItem({ term, children, className, classNames, ref, ...rest }: DescriptionListItemProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-1 gap-x-r3 gap-y-r6 text-body-2",
        "@sm/dl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] @sm/dl:items-baseline",
        // A divided list's items carry their own rhythm and the hairline between.
        "[[data-variant=divided]>&]:border-b [[data-variant=divided]>&]:border-border [[data-variant=divided]>&]:py-r4 [[data-variant=divided]>&:last-child]:border-b-0",
        className,
      )}
      {...rest}
    >
      <dt className={cn("min-w-0 text-fg-secondary [overflow-wrap:anywhere]", classNames?.term)}>{term}</dt>
      <dd className={cn("min-w-0 text-fg-primary [overflow-wrap:anywhere]", classNames?.details)}>{children}</dd>
    </div>
  );
}

/** `DescriptionList` with `DescriptionList.Item term="…">value</…>`. */
export const DescriptionList = Object.assign(DescriptionListRoot, { Item: DescriptionListItem });
