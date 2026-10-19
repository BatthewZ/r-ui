import { type ComponentPropsWithRef, createContext, type ReactNode, useContext } from "react";

import { elementChildren } from "../../util/children";
import { cn, type SlotClassNames } from "../../util/style";
import type { FeatureHeadingLevel } from "./FeatureGrid";

/** Which side a row's media sits on when the rows are wide. */
export type FeatureRowMediaSide = "start" | "end";

/**
 * - `alternate` (default): end, start, end… from the first row.
 * - `start` / `end`: every row on that side.
 */
export type FeatureRowsMediaSide = "alternate" | FeatureRowMediaSide;

interface RowContextValue {
  mediaSide: FeatureRowMediaSide;
  stackedMedia: "first" | "last";
  headingLevel: FeatureHeadingLevel;
}

const RowContext = createContext<RowContextValue | null>(null);

export type FeatureRowsProps = {
  /** Where each row's media sits once the rows are wide (a 48rem container). Default `alternate`. */
  mediaSide?: FeatureRowsMediaSide;
  /** Whether the media shows above (`first`, default) or below the text once the rows stack. */
  stackedMedia?: "first" | "last";
  /** Every row title's heading level (default 3). */
  headingLevel?: FeatureHeadingLevel;
  /** `FeatureRows.Row` elements, as direct children. */
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"div">, "children">;

/**
 * Feature rows: each a text column (eyebrow, title, body, actions) beside a
 * media column, the media alternating sides from row to row. The root is the
 * size container: the rows sit side by side from a 48rem container and stack
 * below it, whatever the viewport.
 *
 * **Reading order is the DOM order.** Every row is text then media in the
 * document, whichever side the media is drawn on and whether it shows above
 * the text once stacked; only the grid placement moves (CSS), so the tab and
 * reading order never zig-zag. Columns follow the writing direction (RTL).
 */
function FeatureRowsRoot({
  mediaSide = "alternate",
  stackedMedia = "first",
  headingLevel = 3,
  className,
  children,
  ...props
}: FeatureRowsProps) {
  const rows = elementChildren<FeatureRowProps>(children);
  return (
    <div className={cn("@container flex min-w-0 flex-col gap-section-1", className)} {...props}>
      {rows.map((row, index) => (
        <RowContext
          key={row.key ?? index}
          value={{
            mediaSide: mediaSide === "alternate" ? (index % 2 === 0 ? "end" : "start") : mediaSide,
            stackedMedia,
            headingLevel,
          }}
        >
          {row}
        </RowContext>
      ))}
    </div>
  );
}

export type FeatureRowProps = {
  title: ReactNode;
  /** A quiet line above the title (UI scale). */
  eyebrow?: ReactNode;
  /** The visual: an image, a product shot, an illustration. */
  media?: ReactNode;
  /** Links or buttons under the body. They wrap. */
  actions?: ReactNode;
  /** Overrides the rows' side for this row. */
  mediaSide?: FeatureRowMediaSide;
  /** The body, on the prose scale: a paragraph or a few. */
  children?: ReactNode;
  classNames?: SlotClassNames<"text" | "eyebrow" | "title" | "body" | "actions" | "media">;
} & Omit<ComponentPropsWithRef<"div">, "title" | "children">;

/** One row of `FeatureRows`. Text first in the DOM, the media placed beside it by the grid. */
function FeatureRow({
  title,
  eyebrow,
  media,
  actions,
  mediaSide: sideProp,
  children,
  className,
  classNames,
  ...props
}: FeatureRowProps) {
  const context = useContext(RowContext);
  if (!context) throw new Error("FeatureRows.Row must be a direct child of FeatureRows.");
  const side = sideProp ?? context.mediaSide;
  const Heading = `h${context.headingLevel}` as const;
  const start = side === "start";

  return (
    <div
      data-media-side={side}
      data-stacked-media={context.stackedMedia}
      className={cn("grid min-w-0 items-center gap-y-section-3 @3xl:grid-cols-2 @3xl:gap-x-section-2", className)}
      {...props}
    >
      <div data-part="text" className={cn("flex min-w-0 flex-col items-start", start && "@3xl:col-start-2", classNames?.text)}>
        {eyebrow != null && (
          <div className={cn("mb-r4 min-w-0 max-w-full break-words text-body-2 font-medium text-fg-muted", classNames?.eyebrow)}>
            {eyebrow}
          </div>
        )}
        <Heading
          className={cn("min-w-0 max-w-full break-words text-balance text-display-3 text-fg-primary", classNames?.title)}
        >
          {title}
        </Heading>
        {children != null && (
          <div
            className={cn(
              "mt-[var(--PROSE-FLOW)] min-w-0 max-w-measure break-words text-pretty text-prose-2 text-fg-secondary",
              classNames?.body,
            )}
          >
            {children}
          </div>
        )}
        {actions != null && (
          <div className={cn("mt-section-3 flex min-w-0 max-w-full flex-wrap items-center gap-r4 *:max-w-full", classNames?.actions)}>
            {actions}
          </div>
        )}
      </div>
      {media != null && (
        <div
          data-part="media"
          className={cn(
            "w-full min-w-0",
            context.stackedMedia === "first" && "order-first @3xl:order-none",
            start && "@3xl:col-start-1 @3xl:row-start-1",
            classNames?.media,
          )}
        >
          {media}
        </div>
      )}
    </div>
  );
}

/** `FeatureRows` with its `FeatureRows.Row`. */
export const FeatureRows = Object.assign(FeatureRowsRoot, { Row: FeatureRow });
