"use client";

import { type ComponentPropsWithRef, useState } from "react";

import { safeUrl } from "../../util/url";
import { cn, type SlotClassNames } from "../../util/style";

export type AvatarProps = {
  /** Image URL. A refused scheme (see `safeUrl`) or a load error falls back to initials. */
  src?: string | null;
  /** The person or thing. Gives the initials and, unless `alt` is set, the accessible name. */
  name?: string;
  /** Accessible name override. `""` makes the avatar decorative (when a visible name sits beside it). */
  alt?: string;
  /**
   * The one size prop, because one density needs two sizes: `control` (default)
   * matches buttons and inputs (a header, a list row); `icon` sits inline in a
   * line of text or a dense table cell. Any other size: `className="size-…"`;
   * the initials scale with the box.
   */
  size?: "control" | "icon";
  classNames?: SlotClassNames<"image" | "initials">;
} & Omit<ComponentPropsWithRef<"span">, "children">;

/** First character, not first UTF-16 unit, so an astral initial is not a lone surrogate. */
const firstChar = (word: string) => Array.from(word)[0] ?? "";

function initialsOf(name: string, max = 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const picked = words.length === 1 || max === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return picked.map((w) => firstChar(w ?? "")).join("").toLocaleUpperCase();
}

/**
 * A round image with an initials fallback on rung 2 (neutral: an avatar is
 * identity, not status, so it takes no hue). An inset hairline keeps a white
 * photo or the fallback from melting into the surface.
 *
 * The box is a size container: the initials are `cqi`-sized, so they fit any
 * size the caller gives it. At `icon` size only one initial is shown.
 */
export function Avatar({ src, name, alt, size = "control", classNames, className, ...props }: AvatarProps) {
  // Keyed by the URL that failed, so a replaced `src` gets a fresh attempt.
  const [failed, setFailed] = useState<string | null>(null);
  const url = src ? safeUrl(src) : "";
  const showImage = url !== "" && failed !== url;
  const label = (alt ?? name ?? "").trim();
  const initials = name ? initialsOf(name, size === "icon" ? 1 : 2) : "";

  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={cn(
        "r-primitives-avatar relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-surface-2 align-middle font-medium text-fg-secondary",
        size === "icon" ? "size-icon" : "size-control",
        className,
      )}
      {...props}
    >
      {showImage ? (
        <img
          src={url}
          alt=""
          onError={() => setFailed(url)}
          className={cn("size-full object-cover", classNames?.image)}
        />
      ) : (
        <span
          aria-hidden
          data-single={Array.from(initials).length === 1 || undefined}
          className={cn("r-primitives-avatar-initials", classNames?.initials)}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
