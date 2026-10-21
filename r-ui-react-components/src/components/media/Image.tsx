"use client";

import { ImageOff } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactEventHandler,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";

/**
 * The box's shape, width to height. `intrinsic` is the file's own (`width` /
 * `height`); `fill` takes the size of the box it sits in (a lightbox stage, a
 * media slot that sets its own ratio) and has no ratio of its own.
 */
export type ImageRatio = "intrinsic" | "fill" | "wide" | "classic" | "square" | "portrait";

/** How the picture meets a box of another shape: `cover` crops, `contain` letterboxes. */
export type ImageFit = "cover" | "contain";

/** The corner radius, from the contract's radius scale. */
export type ImageRadius = "none" | "sm" | "md" | "lg" | "xl";

/** What the box shows: no address yet, loading, the picture, or the fallback. */
export type ImageState = "pending" | "loading" | "loaded" | "error";

// Literal class names, so Tailwind's scanner sees every utility.
const RATIO: Record<Exclude<ImageRatio, "intrinsic">, string> = {
  fill: "size-full aspect-auto",
  wide: "aspect-video",
  classic: "aspect-4/3",
  square: "aspect-square",
  portrait: "aspect-3/4",
};

const RADIUS: Record<ImageRadius, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

const FIT: Record<ImageFit, string> = { cover: "object-cover", contain: "object-contain" };

export type ImageProps = {
  /**
   * The file. `null` while its address is still on the way (a signed URL being
   * fetched, an upload being processed): the box holds its size and placeholder,
   * busy, and nothing is requested. Not an error. An empty or blank address is
   * one: the fallback shows and nothing is requested.
   */
  src: string | null;
  /**
   * What the picture shows, read in its place. `""` marks it decorative (the text
   * around it already says it): it is then hidden from assistive tech, and its
   * error state shows only the glyph. Required, so the choice is always made.
   */
  alt: string;
  /** The file's intrinsic width in pixels. With `height` it reserves the box before a byte arrives (no layout shift), sets the `intrinsic` ratio and caps the box's width, as on a plain `<img>`. */
  width: number;
  /** The file's intrinsic height in pixels. */
  height: number;
  srcSet?: string;
  sizes?: string;
  /** Default `intrinsic`. */
  ratio?: ImageRatio;
  /** Default `cover`. */
  fit?: ImageFit;
  /** Default `md`. */
  radius?: ImageRadius;
  /**
   * Above the fold and the page's main picture (a hero, the image a lightbox
   * opens on): loads at once with `fetchpriority="high"`. Default: lazy, and
   * decoded off the main thread.
   */
  priority?: boolean;
  /** A tiny preview of the picture (an 8 to 32px wide data URL), scaled up and blurred until the picture arrives, then cross-faded away. */
  placeholder?: string;
  /**
   * A colour that fills the box until the picture arrives: the picture's dominant
   * colour from your image pipeline, or a token (`var(--C-SURFACE-2)`). Default: a
   * quiet ink wash. Under `placeholder` when both are given.
   */
  placeholderColor?: string;
  onLoad?: ReactEventHandler<HTMLImageElement>;
  onError?: ReactEventHandler<HTMLImageElement>;
  classNames?: SlotClassNames<"image" | "placeholder" | "fallback">;
} & Omit<ComponentPropsWithRef<"span">, "children" | "onLoad" | "onError">;

/**
 * A picture in a box whose size is fixed before it loads: no layout shift, a
 * placeholder while it travels, a cross-fade when it arrives, and a fallback that
 * keeps its words when it fails.
 *
 * - **Size first.** The box takes its shape from `ratio` (the file's own by
 *   default) and its width from its container, capped at the file's width like a
 *   plain `<img>` (`className="w-full"` lets it grow). The picture fills it by
 *   `fit`; the box clips it to `radius`. Unlike an `<img>`, that width is also its
 *   min-content size, so in a track sized by its content (a grid's `auto` column,
 *   a figure laid out as a grid) pass `w-full` or give the track a zero minimum.
 * - **Blur-up.** Until the picture has loaded the box shows `placeholderColor`
 *   and, over it, `placeholder` scaled up and blurred. The picture then fades in
 *   over `--DURATION-SLOW` and the placeholder out, so under reduced motion (the
 *   token collapses) the swap is immediate.
 * - **Lazy by default**, `decoding="async"`, with `srcSet` / `sizes` passed
 *   through; `priority` loads at once with high fetch priority.
 * - **Failure** replaces the picture with a muted glyph and the `alt` text (the
 *   glyph alone when decorative), still named by `alt` for assistive tech. A new
 *   `src` gets its own try.
 * - **States** are on the root as `data-state`: `pending` (`src` is `null`),
 *   `loading`, `loaded`, `error` (also an empty `src`).
 * - **Forced colours** drop the placeholder's fill, so the box draws an outline
 *   there instead.
 *
 * The root is a `<span>` (block), so the picture can sit inside a link or a
 * button (a thumbnail that opens a `Lightbox`).
 */
export function Image({
  src,
  alt,
  width,
  height,
  srcSet,
  sizes,
  ratio = "intrinsic",
  fit = "cover",
  radius = "md",
  priority = false,
  placeholder,
  placeholderColor,
  onLoad,
  onError,
  classNames,
  className,
  style,
  ...props
}: ImageProps) {
  // The outcome is stored with the src it belongs to, so a new src starts loading again.
  const [settled, setSettled] = useState<{ src: string; state: "loaded" | "error" } | null>(null);
  // Anything but a non-blank string (untyped data may send `undefined`) has nothing to
  // load, and a blank `src` would resolve to the page's own URL and request it.
  const address = typeof src === "string" && src.trim() !== "" ? src : null;
  const state: ImageState =
    src === null ? "pending" : address === null ? "error" : settled?.src === address ? settled.state : "loading";
  const imageRef = useRef<HTMLImageElement>(null);

  // A picture already in the cache (or loaded before hydration) may have fired
  // `load` before React listened; read its state once it is in the DOM.
  useLayoutEffect(() => {
    const img = imageRef.current;
    if (address !== null && img?.complete && img.naturalWidth > 0) setSettled({ src: address, state: "loaded" });
  }, [address]);

  const decorative = alt === "";
  const wash = placeholderColor ? { backgroundColor: placeholderColor } : undefined;
  const sizing = {
    "--r-media-image-w": width,
    "--r-media-image-h": height,
    ...style,
  } as CSSProperties;

  return (
    <span
      data-state={state}
      aria-busy={state === "pending" || state === "loading" ? true : undefined}
      style={sizing}
      className={cn(
        "r-media-image relative block overflow-clip",
        ratio !== "intrinsic" && RATIO[ratio],
        RADIUS[radius],
        className,
      )}
      {...props}
    >
      {state !== "error" && (
        // Stays under the picture while it fades in, then fades out itself (styles.css).
        <span aria-hidden className={cn("r-media-image-placeholder absolute inset-0", classNames?.placeholder)} style={wash}>
          {placeholder && <img src={placeholder} alt="" className="r-media-image-blur size-full object-cover" />}
        </span>
      )}
      {state === "pending" && !decorative && (
        // Nothing to request yet: the box still answers for the picture it will hold.
        <span role="img" aria-label={alt} className="absolute inset-0" />
      )}
      {address !== null && state !== "error" && (
        <img
          ref={imageRef}
          src={address}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          onLoad={composeEventHandlers(onLoad, () => setSettled({ src: address, state: "loaded" }), { checkDefaultPrevented: false })}
          onError={composeEventHandlers(onError, () => setSettled({ src: address, state: "error" }), { checkDefaultPrevented: false })}
          className={cn("r-media-image-picture absolute inset-0 size-full", FIT[fit], classNames?.image)}
        />
      )}
      {state === "error" && (
        <span
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : alt}
          aria-hidden={decorative || undefined}
          className={cn(
            "r-media-image-fallback absolute inset-0 flex flex-col items-center justify-center gap-r5 p-r4 text-center text-body-3 text-fg-muted",
            classNames?.fallback,
          )}
        >
          <ImageOff aria-hidden className="size-icon shrink-0" />
          {!decorative && (
            <span aria-hidden className="line-clamp-3 min-w-0 max-w-full [overflow-wrap:anywhere]">
              {alt}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
