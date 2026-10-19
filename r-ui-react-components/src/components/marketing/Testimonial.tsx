"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { Rating } from "../form";
import { Avatar } from "../primitives";

/**
 * - `card`: a bordered surface for a grid or a carousel; the attribution sits at
 *   its foot, so a row of cards (stretched by their track) aligns them.
 * - `pull`: a large, centred pull-quote on the display scale, no box.
 * - `compact`: small type, an icon-sized avatar and one attribution line, for a
 *   sidebar or beside a sign-up form.
 */
export type TestimonialVariant = "card" | "pull" | "compact";

export interface TestimonialLabels {
  /** The read-only rating's name ("Rated 4.5 out of 5"). */
  rating: (value: number, max: number) => string;
  /** The attribution line under the name, from the role and the company. */
  affiliation: (role: string, company: string) => string;
}

export const DEFAULT_TESTIMONIAL_LABELS: TestimonialLabels = {
  rating: (value, max) => `Rated ${value} out of ${max}`,
  affiliation: (role, company) => `${role}, ${company}`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Testimonial: TestimonialLabels;
  }
}

export type TestimonialProps = {
  /**
   * What they said. A string becomes one paragraph; for several, pass `<p>`
   * elements. The language's quotation marks are drawn around it (`quotes`
   * follows `lang`), so leave them out of the text.
   */
  quote: ReactNode;
  /** Who said it. */
  name: string;
  role?: string;
  company?: string;
  /**
   * The person's photo URL. Omitted: their initials (an `Avatar`); `false`: no
   * avatar. Decorative either way: the name is written beside it.
   */
  avatar?: string | false;
  /** The company's logo, carrying its own accessible name (an `<img alt>`, a labelled `svg`). */
  logo?: ReactNode;
  /** A score shown with a read-only `Rating`, named by `labels.rating`. */
  rating?: number;
  /** @default 5 */
  ratingMax?: number;
  /**
   * The work the quote comes from (a case study, a review site), as a `<cite>`.
   * A person's name is not a work, so it is not one.
   */
  source?: ReactNode;
  /** The source's URL, as the blockquote's `cite` attribute. */
  sourceUrl?: string;
  variant?: TestimonialVariant;
  labels?: LabelsProp<TestimonialLabels>;
  classNames?: SlotClassNames<"header" | "quote" | "caption" | "avatar" | "name" | "affiliation" | "source">;
} & Omit<ComponentPropsWithRef<"figure">, "children">;

const ROOT: Record<TestimonialVariant, string> = {
  card: "flex flex-col gap-r3 rounded-lg border border-border bg-surface-0 p-r2",
  pull: "flex flex-col items-center gap-r2 text-center",
  compact: "flex flex-col gap-r4",
};

const QUOTE: Record<TestimonialVariant, string> = {
  card: "text-prose-2 text-fg-primary",
  pull: "text-balance text-display-3 text-fg-primary",
  compact: "text-prose-3 text-fg-primary",
};

/**
 * A customer's words, attributed: a `<figure>` holding a `<blockquote>` and a
 * `<figcaption>` with the avatar, name, role and company, and the source as a
 * `<cite>`. Optional logo and read-only `Rating` above the quote.
 *
 * The root is a size container, so the pull-quote's display type sizes to the
 * testimonial's own width; give it a track in a flex row. For a grid of them use
 * `Grid` (`as="ul"`, one `<li>` each); in a `Carousel`, one per slide.
 */
export function Testimonial({
  quote,
  name,
  role,
  company,
  avatar,
  logo,
  rating,
  ratingMax = 5,
  source,
  sourceUrl,
  variant = "card",
  labels: labelsProp,
  classNames,
  className,
  ...props
}: TestimonialProps) {
  const labels = useLabels("Testimonial", DEFAULT_TESTIMONIAL_LABELS, labelsProp);
  const compact = variant === "compact";
  const affiliation = role && company ? labels.affiliation(role, company) : role || company;
  const paragraphs = typeof quote === "string" || typeof quote === "number" ? <p>{quote}</p> : quote;

  return (
    <figure
      data-variant={variant}
      data-print="avoid-break"
      className={cn("r-marketing-testimonial @container min-w-0", ROOT[variant], className)}
      {...props}
    >
      {(logo != null || rating !== undefined) && (
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center gap-x-r3 gap-y-r5",
            variant === "pull" ? "justify-center" : "justify-between",
            classNames?.header,
          )}
        >
          {rating !== undefined && (
            <Rating readOnly value={rating} max={ratingMax} aria-label={labels.rating(rating, ratingMax)} />
          )}
          {logo != null && <div className="flex min-w-0 max-w-full items-center text-fg-secondary">{logo}</div>}
        </div>
      )}
      <blockquote
        cite={sourceUrl}
        className={cn(
          "r-marketing-testimonial-quote flex min-w-0 max-w-full flex-col gap-r5 [overflow-wrap:anywhere]",
          variant === "pull" && "max-w-measure",
          QUOTE[variant],
          classNames?.quote,
        )}
      >
        {paragraphs}
      </blockquote>
      <figcaption
        className={cn(
          "flex min-w-0 max-w-full items-center gap-r4",
          variant === "card" && "mt-auto",
          variant === "pull" && "justify-center text-start",
          compact ? "text-body-3" : "text-body-2",
          classNames?.caption,
        )}
      >
        {avatar !== false && (
          <Avatar
            src={avatar}
            name={name}
            alt=""
            size={compact ? "icon" : "control"}
            className={classNames?.avatar}
          />
        )}
        <span className={cn("flex min-w-0 flex-col", compact && "flex-row flex-wrap gap-x-r5")}>
          <span className={cn("[overflow-wrap:anywhere] font-medium text-fg-primary", classNames?.name)}>{name}</span>
          {affiliation && (
            <span className={cn("[overflow-wrap:anywhere] text-fg-secondary", classNames?.affiliation)}>{affiliation}</span>
          )}
          {source != null && (
            <cite className={cn("[overflow-wrap:anywhere] not-italic text-fg-muted", classNames?.source)}>{source}</cite>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
