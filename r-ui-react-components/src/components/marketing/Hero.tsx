import { type ComponentPropsWithRef, type ReactNode, useId } from "react";

import { cn, type SlotClassNames } from "../../util/style";
import { Container, Section } from "../layout";

export type HeroLayout = "stacked" | "split";

/**
 * - `plain`: on the canvas.
 * - `band`: the raised band (`--C-SURFACE-1`), edged with hairlines, as `Section variant="band"`.
 */
export type HeroVariant = "plain" | "band";

export type HeroHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type HeroProps = {
  /** The heading, on the fluid display scale in the display face. Required: it names the hero. */
  title: ReactNode;
  /** A quiet line above the title (UI scale): a category, or a link to news. */
  eyebrow?: ReactNode;
  /** One or two sentences under the title, on the prose scale. Phrasing content (it is a `<p>`). */
  lead?: ReactNode;
  /** The calls to action, usually one primary and one secondary `Button`. They wrap. */
  actions?: ReactNode;
  /** The one confident visual: an image, an illustration, a product card. */
  media?: ReactNode;
  /** Social proof under everything: customer names, a rating, a figure. */
  proof?: ReactNode;
  /**
   * - `stacked` (default): centred, the media under the text.
   * - `split`: text on the start side and media on the end side when the HERO
   *   is wide (`@4xl`, a 56rem container), stacked when it is narrow, whatever
   *   the viewport.
   */
  layout?: HeroLayout;
  variant?: HeroVariant;
  /** The title's heading level for the page outline (default 1). The look is the same at every level. */
  headingLevel?: HeroHeadingLevel;
  /** Anything else for the text column, after the actions (a sign-up form, a note). */
  children?: ReactNode;
  classNames?: SlotClassNames<"container" | "text" | "eyebrow" | "title" | "lead" | "actions" | "media" | "proof">;
} & Omit<ComponentPropsWithRef<"section">, "title" | "children">;

/**
 * The opening of a marketing page: eyebrow, display title, lead, actions, an
 * optional visual and a proof row. A `<section>` named by its title.
 *
 * The hero is a size container, so `split` decides by the HERO's width and its
 * display type, lead and section rhythm (all `cqi`-fluid) size to the column it
 * sits in. The text keeps the UI scale where it is UI: the eyebrow and every
 * control in `actions` stay at UI size and `--CONTROL-H`.
 *
 * **Edge to edge.** Like every band, the hero spans its parent. Inside an app
 * shell that pads its main region, put the page's bands in one root that cancels
 * exactly that padding with negative margins (the band pattern), and the hero,
 * its band fill included, runs to the shell's edges.
 */
export function Hero({
  title,
  eyebrow,
  lead,
  actions,
  media,
  proof,
  layout = "stacked",
  variant = "plain",
  headingLevel = 1,
  children,
  classNames,
  className,
  ...props
}: HeroProps) {
  const titleId = `${useId()}-title`;
  const Heading = `h${headingLevel}` as const;
  const stacked = layout === "stacked";

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
          <div className={cn("flex min-w-0 flex-col", stacked ? "items-center text-center" : "items-start", classNames?.text)}>
            {eyebrow && (
              <div className={cn("mb-r3 min-w-0 max-w-full [overflow-wrap:anywhere] text-body-2 font-medium text-fg-muted", classNames?.eyebrow)}>
                {eyebrow}
              </div>
            )}
            <Heading
              id={titleId}
              className={cn("min-w-0 max-w-full [overflow-wrap:anywhere] text-balance text-display-1 text-fg-primary", classNames?.title)}
            >
              {title}
            </Heading>
            {lead && (
              <p
                className={cn(
                  "mt-[var(--PROSE-FLOW)] min-w-0 max-w-measure [overflow-wrap:anywhere] text-pretty text-prose-1 text-fg-secondary",
                  classNames?.lead,
                )}
              >
                {lead}
              </p>
            )}
            {actions && (
              <div
                className={cn(
                  "mt-section-3 flex min-w-0 max-w-full flex-wrap items-center gap-r4 *:max-w-full",
                  stacked && "justify-center",
                  classNames?.actions,
                )}
              >
                {actions}
              </div>
            )}
            {children}
          </div>
          {media && <div className={cn("w-full min-w-0", stacked && "mt-section-2", classNames?.media)}>{media}</div>}
        </div>
        {proof && (
          <div className={cn("mt-section-2 min-w-0", stacked && "flex flex-col items-center text-center", classNames?.proof)}>
            {proof}
          </div>
        )}
      </Container>
    </Section>
  );
}
