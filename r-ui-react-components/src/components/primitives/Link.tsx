"use client";

import { ExternalLink } from "lucide-react";
import { type AnchorHTMLAttributes, type ReactNode, type Ref, useId } from "react";

import { safeUrl } from "../../util/url";
import { cn, type SlotClassNames } from "../../util/style";

export type LinkProps = {
  /**
   * `accent` (default): accent text-safe ink. `inherit`: the surrounding ink,
   * for links in muted footers or table cells where accent would shout; the
   * decoration still marks it as a link.
   */
  variant?: "accent" | "inherit";
  /**
   * Leaves the site: draws an external-link glyph and, with `target="_blank"`,
   * says so to assistive tech. Defaults to true when `target="_blank"`.
   */
  external?: boolean;
  /**
   * Spoken as the description of a new-tab link, in the caller's language.
   * A description rather than part of the name: name computation joins inline
   * text without a space ("Docs(opens…)"), and the name stays the visible text.
   */
  newTabLabel?: string;
  classNames?: SlotClassNames<"icon">;
  ref?: Ref<HTMLAnchorElement>;
} & AnchorHTMLAttributes<HTMLAnchorElement>;

const INK = { accent: "text-fg-accent", inherit: "text-inherit" } as const;

/**
 * An inline text link. Its decoration is the theme's link lever
 * (`--LINK-DECORATION`: underline, or none for a brand that marks links by
 * colour alone); hover always underlines, so the affordance appears under the
 * pointer in every theme. It inherits its type size, so it sits in prose or a
 * table cell alike.
 *
 * `href` passes through `safeUrl`: a refused scheme (`javascript:` …) renders
 * the children as plain text, not a dead or dangerous link.
 */
export function Link({
  variant = "accent",
  external,
  newTabLabel = "(opens in a new tab)",
  href,
  target,
  rel,
  classNames,
  className,
  children,
  "aria-describedby": describedBy,
  ...props
}: LinkProps) {
  const hintId = useId();
  const safeHref = href === undefined ? undefined : safeUrl(href);
  const newTab = target === "_blank";
  const showExternal = external ?? newTab;

  if (safeHref === "") return <span className={className}>{children}</span>;

  // A new tab must not get `window.opener`; keep whatever else the caller set.
  const relValue = newTab
    ? Array.from(new Set([...(rel ?? "").split(/\s+/).filter(Boolean), "noopener", "noreferrer"])).join(" ")
    : rel;

  const glyph: ReactNode = showExternal && (
    <ExternalLink aria-hidden className={cn("ms-r6 inline size-icon align-text-bottom", classNames?.icon)} />
  );

  const hint = newTab && newTabLabel ? newTabLabel : "";

  return (
    <>
      <a
        href={safeHref}
        aria-describedby={[describedBy, hint && hintId].filter(Boolean).join(" ") || undefined}
        target={target}
        rel={relValue}
        className={cn(
          "r-primitives-link break-words rounded-sm decoration-from-font underline-offset-[0.18em] hover:underline",
          INK[variant],
          className,
        )}
        {...props}
      >
        {children}
        {glyph}
      </a>
      {hint && (
        // `hidden` still serves aria-describedby, and takes no box in the caller's layout.
        <span id={hintId} hidden>
          {hint}
        </span>
      )}
    </>
  );
}
