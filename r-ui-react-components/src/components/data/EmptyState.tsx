import type { HTMLAttributes, ReactNode, Ref } from "react";

import { cn, type SlotClassNames } from "../../util/style";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** A decorative icon (lucide), drawn large and muted. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links: what the reader can do about it. */
  actions?: ReactNode;
  /** `error` tints the icon with the error mark: "this failed", not "this is empty". */
  tone?: "neutral" | "error";
  /** Render the title as a heading at this level. Default: a paragraph, so an empty table cell adds nothing to the outline. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  classNames?: SlotClassNames<"icon" | "title" | "description" | "actions">;
  ref?: Ref<HTMLDivElement>;
}

/**
 * "Nothing here yet" or "this failed": an icon, a title, one line of
 * explanation, and the way out. Quiet by design; it sits where data would.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  tone = "neutral",
  headingLevel,
  className,
  classNames,
  ref,
  ...rest
}: EmptyStateProps) {
  const Title = headingLevel ? (`h${headingLevel}` as const) : "p";
  return (
    <div
      ref={ref}
      data-tone={tone}
      className={cn("flex flex-col items-center gap-r4 px-r2 py-r1 text-center", className)}
      {...rest}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            "mb-r6 inline-grid place-items-center rounded-full bg-surface-2 p-r4 [&>svg]:size-[calc(var(--ICON)*1.5)]",
            tone === "error" ? "bg-status-error-bg text-status-error" : "text-fg-secondary",
            classNames?.icon,
          )}
        >
          {icon}
        </span>
      )}
      <Title className={cn("text-h5 text-fg-primary", classNames?.title)}>{title}</Title>
      {description && (
        <p className={cn("max-w-measure text-body-2 text-fg-secondary", classNames?.description)}>{description}</p>
      )}
      {actions && (
        <div className={cn("mt-r5 flex flex-wrap justify-center gap-r4", classNames?.actions)}>{actions}</div>
      )}
    </div>
  );
}
