import { type ComponentPropsWithRef, type ReactNode, useId } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { Container, Section, type SectionVariant } from "../layout";
import type { HeroHeadingLevel, HeroLayout } from "./Hero";

export type CallToActionProps = {
  /** The heading, on the display scale. Required: it names the band. */
  title: ReactNode;
  /** A sentence or two under the title, on the prose scale. Phrasing content (it is a `<p>`). */
  body?: ReactNode;
  /** The calls to action, usually one primary and one secondary `Button`. They wrap. */
  actions?: ReactNode;
  /**
   * - `stacked` (default): centred, the actions under the text.
   * - `split`: text on the start side, actions on the end side when the BAND is
   *   wide (`@4xl`, a 56rem container), stacked when it is narrow.
   */
  layout?: HeroLayout;
  /** Default `band`: the raised band with hairlines, as `Section variant="band"`. */
  variant?: SectionVariant;
  /** The title's heading level (default 2). The look is the same at every level. */
  headingLevel?: HeroHeadingLevel;
  /** Anything else in the actions column, after the actions (an `EmailCapture`). */
  children?: ReactNode;
  classNames?: SlotClassNames<"container" | "text" | "title" | "body" | "actions">;
} & Omit<ComponentPropsWithRef<"section">, "title" | "children">;

/**
 * The closing call to action of a marketing page: a band with a display title,
 * a line of prose and one or two actions (or a sign-up form). A `<section>`
 * named by its title, and a size container, so `split` and its fluid type
 * follow the band's own width.
 *
 * **Edge to edge.** Like every band it spans its parent. Inside an app shell
 * that pads its main region, put the page's bands in one root that cancels
 * exactly that padding with negative margins (the band pattern), and the band's
 * fill and hairlines run to the shell's edges.
 */
export function CallToAction({
  title,
  body,
  actions,
  layout = "stacked",
  variant = "band",
  headingLevel = 2,
  children,
  classNames,
  className,
  ...props
}: CallToActionProps) {
  const titleId = `${useId()}-title`;
  const Heading = `h${headingLevel}` as const;
  const stacked = layout === "stacked";
  const hasActions = actions != null || children != null;

  return (
    <Section
      aria-labelledby={titleId}
      data-layout={layout}
      variant={variant}
      className={cn("@container", className)}
      {...props}
    >
      <Container className={classNames?.container}>
        <div className={stacked ? "flex flex-col items-center" : "grid items-center gap-section-2 @4xl:grid-cols-2"}>
          <div className={cn("flex min-w-0 max-w-full flex-col", stacked ? "items-center text-center" : "items-start", classNames?.text)}>
            <Heading
              id={titleId}
              className={cn("min-w-0 max-w-full [overflow-wrap:anywhere] text-balance text-display-2 text-fg-primary", classNames?.title)}
            >
              {title}
            </Heading>
            {body != null && (
              <p
                className={cn(
                  "mt-[var(--PROSE-FLOW)] min-w-0 max-w-measure [overflow-wrap:anywhere] text-pretty text-prose-1 text-fg-secondary",
                  classNames?.body,
                )}
              >
                {body}
              </p>
            )}
          </div>
          {hasActions && (
            <div
              className={cn(
                "grid w-full min-w-0 gap-r3",
                stacked ? "mt-section-3 max-w-measure" : "@4xl:justify-items-end",
                classNames?.actions,
              )}
            >
              {actions != null && (
                <div className={cn("flex min-w-0 max-w-full flex-wrap items-center gap-r4 *:max-w-full", stacked && "justify-center")}>
                  {actions}
                </div>
              )}
              {/* Stretched, never centred: a form inside is a size container with no width of its own. */}
              {children != null && <div className="w-full min-w-0 text-start">{children}</div>}
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
