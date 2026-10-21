"use client";

import { ImageOff } from "lucide-react";
import { type ComponentPropsWithRef, type ElementType, type ReactNode } from "react";

import { useLinkElement } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { safeUrl } from "../../util/url";
import { Image, type ImageRatio } from "../media";
import { Skeleton } from "../primitives";

/** The media box's shape, width to height: `Image`'s fixed ratios. */
export type MediaRatio = Exclude<ImageRatio, "intrinsic" | "fill">;

const RATIO: Record<MediaRatio, string> = {
  wide: "aspect-video",
  classic: "aspect-4/3",
  square: "aspect-square",
  portrait: "aspect-3/4",
};

/** The card's picture, drawn by `Image` (its loading, placeholder and failure states). */
export interface MediaCardImage {
  /** `null` while the address is still on the way: the box shows the pending placeholder. */
  src: string | null;
  /** What the image shows; `""` when it is decoration the title already says. */
  alt: string;
  /** The file's intrinsic size. */
  width: number;
  height: number;
  srcSet?: string;
  sizes?: string;
  /** A tiny blurred preview shown until the picture arrives (`Image`'s `placeholder`). */
  placeholder?: string;
  /** A fill until the picture arrives (`Image`'s `placeholderColor`). */
  placeholderColor?: string;
}

export type MediaCardProps = {
  /**
   * Where the card leads. The whole card is this one link. Without one (or when
   * `safeUrl` refuses it) the card is no link and the title is text.
   */
  href?: string;
  /** The card's name, and the link's. */
  title: ReactNode;
  /** The title's heading level in the page outline (default `h3`). */
  titleAs?: "h2" | "h3" | "h4" | "h5" | "h6";
  /** Lazy-loaded, through `Image` (a failure shows its glyph and `alt`). Without one the media box shows a quiet placeholder. */
  image?: MediaCardImage;
  /** Default `wide` (16:9). */
  ratio?: MediaRatio;
  /** A short line under the description: author, date, reading time. */
  meta?: ReactNode;
  description?: ReactNode;
  /** A `Badge`, pinned to the media box's start corner. Part of the card's text, not a control. */
  badge?: ReactNode;
  /** Secondary controls (save, share). Each stays its own tab stop and its own press target, above the card link. */
  actions?: ReactNode;
  /** Renders the link (default: the router's link for an internal `href`, else `<a>`). */
  linkAs?: ElementType;
  classNames?: SlotClassNames<"media" | "image" | "body" | "title" | "link" | "description" | "footer" | "meta" | "actions">;
} & Omit<ComponentPropsWithRef<"article">, "title">;

const CARD =
  "r-marketing-media-card relative flex min-w-0 flex-col rounded-lg border border-border bg-surface-0 text-fg-primary hover:border-border-strong";

/**
 * A card for an article, a case study or a video: media, title, description,
 * meta, and optionally a badge and secondary actions.
 *
 * **One link target.** The title's link stretches over the whole card with a
 * pseudo-element, so a press anywhere on the card follows it and assistive tech
 * meets one link named by the title (not a link wrapping a paragraph, a badge and
 * buttons). Its focus ring draws around the whole card. `actions` render after
 * the link and above it, so each one is its own tab stop and takes its own
 * presses. Text under the stretched link cannot be selected by dragging; that is
 * the pattern's price.
 *
 * Hover lifts the card by `--MOTION-DISTANCE-SM` over `--DURATION-NORMAL`, both
 * motion tokens, so reduced motion keeps it still. The edge firms too, so the
 * hover reads without movement.
 */
function MediaCardRoot({
  href,
  title,
  titleAs: Heading = "h3",
  image,
  ratio = "wide",
  meta,
  description,
  badge,
  actions,
  linkAs,
  classNames,
  className,
  ...props
}: MediaCardProps) {
  const safeHref = href === undefined ? "" : safeUrl(href);
  const Link = useLinkElement(linkAs, safeHref);
  const hasFooter = Boolean(meta || actions);

  return (
    <article data-print="avoid-break" className={cn(CARD, className)} {...props}>
      <MediaBox ratio={ratio} image={image} badge={badge} classNames={classNames} />
      <div className={cn("flex min-w-0 flex-col gap-r4 p-r2", classNames?.body)}>
        <Heading className={cn("min-w-0 break-words text-pretty text-display-4 text-fg-primary", classNames?.title)}>
          {safeHref ? (
            <Link href={safeHref} className={cn("r-marketing-stretched-link", classNames?.link)}>
              {title}
            </Link>
          ) : (
            title
          )}
        </Heading>
        {description && (
          <p className={cn("min-w-0 break-words text-pretty text-prose-3 text-fg-secondary", classNames?.description)}>
            {description}
          </p>
        )}
      </div>
      {hasFooter && (
        <div
          className={cn(
            "r-marketing-media-card-footer mt-auto flex min-w-0 flex-wrap items-center justify-between gap-x-r3 gap-y-r5 px-r2 pb-r2",
            classNames?.footer,
          )}
        >
          {meta && <div className={cn("min-w-0 break-words text-body-3 text-fg-muted", classNames?.meta)}>{meta}</div>}
          {actions && (
            <div className={cn("r-marketing-media-card-actions ms-auto flex min-w-0 max-w-full flex-wrap items-center gap-r6", classNames?.actions)}>
              {actions}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function MediaBox({
  ratio,
  image,
  badge,
  classNames,
}: Pick<MediaCardProps, "image" | "badge" | "classNames"> & { ratio: MediaRatio }) {
  return (
    <div className={cn("r-marketing-media-card-media relative w-full", RATIO[ratio], classNames?.media)}>
      {image ? (
        <Image {...image} ratio="fill" radius="none" classNames={{ image: classNames?.image }} />
      ) : (
        <span className="r-marketing-media-card-placeholder flex size-full items-center justify-center text-fg-muted" aria-hidden>
          <ImageOff className="size-icon" />
        </span>
      )}
      {badge && <div className="absolute start-r4 top-r4 max-w-[calc(100%-2*var(--R-SIZE-4))]">{badge}</div>}
    </div>
  );
}

export type MediaCardSkeletonProps = {
  ratio?: MediaRatio;
  /** Makes this skeleton the loading status (`role="status"` with this text). Give ONE per loading region. */
  label?: string;
} & Omit<ComponentPropsWithRef<"div">, "children">;

/** The card's loading state, the same frame and rhythm with placeholder bars. */
function MediaCardSkeleton({ ratio = "wide", label, className, ...props }: MediaCardSkeletonProps) {
  return (
    <div className={cn(CARD, className)} aria-busy={label ? true : undefined} {...props}>
      <div className={cn("r-marketing-media-card-media w-full", RATIO[ratio])}>
        <Skeleton shape="block" label={label} className="size-full rounded-none" />
      </div>
      <div className="flex flex-col gap-r4 p-r2">
        <Skeleton className="text-display-4" />
        <Skeleton className="text-prose-3" lines={2} />
        <Skeleton className="w-2/5 text-body-3" />
      </div>
    </div>
  );
}

/** `MediaCard`, plus `MediaCard.Skeleton` for its loading state. */
export const MediaCard = Object.assign(MediaCardRoot, { Skeleton: MediaCardSkeleton });
