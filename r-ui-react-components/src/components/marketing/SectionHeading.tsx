import type { ComponentPropsWithRef, ReactNode } from "react";

import { cn, type SlotClassNames } from "../../util/style";

export type SectionHeadingLevel = 2 | 3 | 4 | 5 | 6;

export type SectionHeadingProps = {
  /** The heading, on the fluid display scale. */
  title: ReactNode;
  /** A quiet line above it (UI scale): what the section is about. */
  eyebrow?: ReactNode;
  /** One or two sentences under it, on the prose scale. Phrasing content (it is a `<p>`). */
  lead?: ReactNode;
  /** @default 2 */
  headingLevel?: SectionHeadingLevel;
  /** `center` for a section whose content is centred under it. @default "start" */
  align?: "start" | "center";
  /** The heading's id, for the section's `aria-labelledby`. */
  titleId?: string;
  classNames?: SlotClassNames<"eyebrow" | "title" | "lead">;
} & Omit<ComponentPropsWithRef<"header">, "title" | "children">;

/**
 * The heading group that opens a marketing section after the hero: an eyebrow
 * at UI scale, a display heading and an optional lead, spaced on the rhythm
 * `Hero` uses (the lead one prose-flow step below the heading). Start what
 * follows `mt-section-3` (a grid, a list) or `mt-section-2` (rows, a carousel)
 * below it.
 *
 * The heading is balanced rather than capped: `--MEASURE` is in `ch` of the
 * element's own font, so on display type it would cap nothing; the lead is
 * capped at the reading measure.
 */
export function SectionHeading({
  title,
  eyebrow,
  lead,
  headingLevel = 2,
  align = "start",
  titleId,
  classNames,
  className,
  ...props
}: SectionHeadingProps) {
  const Heading = `h${headingLevel}` as const;
  const centred = align === "center";
  return (
    <header className={cn("flex min-w-0 flex-col", centred ? "items-center text-center" : "items-start", className)} {...props}>
      {eyebrow != null && (
        <div className={cn("mb-r4 min-w-0 max-w-full break-words text-body-2 font-medium text-fg-muted", classNames?.eyebrow)}>
          {eyebrow}
        </div>
      )}
      <Heading
        id={titleId}
        className={cn("min-w-0 max-w-full [overflow-wrap:anywhere] text-balance text-display-2 text-fg-primary", classNames?.title)}
      >
        {title}
      </Heading>
      {lead != null && (
        <p
          className={cn(
            "mt-[var(--PROSE-FLOW)] min-w-0 max-w-measure [overflow-wrap:anywhere] text-pretty text-prose-1 text-fg-secondary",
            classNames?.lead,
          )}
        >
          {lead}
        </p>
      )}
    </header>
  );
}
