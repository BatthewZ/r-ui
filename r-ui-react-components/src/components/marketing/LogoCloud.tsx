"use client";

import { Pause, Play } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import { elementChildren } from "../../util/children";
import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "../primitives";

export interface LogoCloudLabels {
  /** The list's name when there is no `title`. */
  list: string;
  /** The marquee's pause toggle; it reads "pressed" while paused. */
  pause: string;
}

export const DEFAULT_LOGO_CLOUD_LABELS: LogoCloudLabels = {
  list: "Customers",
  pause: "Pause moving logos",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    LogoCloud: LogoCloudLabels;
  }
}

/** CSS pixels per second: slow enough to read a name as it passes. */
const DEFAULT_SPEED = 32;

export type LogoCloudProps = {
  /** A quiet line above the logos that also names their list: "Trusted by teams at". */
  title?: ReactNode;
  /**
   * Off by default: the logos wrap, centred. `true` (32px a second) or a speed in
   * CSS pixels per second scrolls them in one continuous row instead, with a
   * pause toggle (WCAG 2.2.2). It holds still while the pointer is over the logos
   * or focus is in them, and never moves under reduced motion (the logos wrap).
   */
  marquee?: boolean | number;
  /** Each logo takes its own colours under the pointer. Default: monochrome at all times. */
  colorOnHover?: boolean;
  labels?: LabelsProp<LogoCloudLabels>;
  classNames?: SlotClassNames<"title" | "list" | "logo" | "viewport" | "toggle">;
  /**
   * The logos, each an element: an `<img alt="Acme">`, an `<svg role="img"
   * aria-label="Acme">` drawn in `currentColor`, or a link around one. Each is put
   * in a list item.
   */
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"div">, "children" | "title">;

/** How many copies of the logo set make one loop (at least the viewport's width), and one copy's width. */
interface Fit {
  copies: number;
  width: number;
}

/**
 * A quiet row of customer logos. Monochrome by default: an image is drawn through
 * `--r-marketing-logo-cloud-filter` (default `grayscale(1)`, plus `invert(1)` on a
 * dark scheme, read from `--SCHEME-DARK`, since a logo file is drawn for a light
 * page), and an inline SVG drawn in `currentColor` takes the secondary text ink. Logos are
 * `--SECTION-3` tall, so they follow the display scale, not density.
 *
 * `marquee` loops the row. Screen readers get the one list; the copies that make
 * the loop seamless are `aria-hidden` and `inert`. Keyboard focus on a logo link
 * holds the row and brings that logo into view; nothing moves under it until focus
 * leaves. There is no scrollbar: the row clips.
 */
export function LogoCloud({
  title,
  marquee = false,
  colorOnHover = false,
  labels: labelsProp,
  classNames,
  className,
  children,
  ...props
}: LogoCloudProps) {
  const labels = useLabels("LogoCloud", DEFAULT_LOGO_CLOUD_LABELS, labelsProp);
  const titleId = `${useId()}-title`;
  const reducedMotion = usePrefersReducedMotion();
  const logos = elementChildren(children);
  const speed = marquee === true ? DEFAULT_SPEED : typeof marquee === "number" && marquee > 0 ? marquee : 0;
  const moving = speed > 0 && !reducedMotion && logos.length > 0;
  const [paused, setPaused] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState<Fit>({ copies: 1, width: 0 });

  useEffect(() => {
    const viewport = viewportRef.current;
    const set = setRef.current;
    if (!moving || !viewport || !set || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      // The set's box includes its trailing gap, so copies abut at the same pitch.
      const width = set.getBoundingClientRect().width;
      const copies = width > 0 ? Math.max(1, Math.ceil(viewport.clientWidth / width)) : 1;
      setFit((prev) => (prev.copies === copies && Math.abs(prev.width - width) < 0.5 ? prev : { copies, width }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(set);
    return () => observer.disconnect();
  }, [moving]);

  if (logos.length === 0) return null;

  const name = title ? { "aria-labelledby": titleId } : { "aria-label": labels.list };
  const items = logos.map((logo: ReactElement, i) => (
    <li key={logo.key ?? i} className={cn("r-marketing-logo-cloud-logo", classNames?.logo)}>
      {logo}
    </li>
  ));

  /**
   * Keyboard focus landed on a logo: wind the (held) loop until that logo is
   * inside the viewport's content box, as a scroller brings a focused child into
   * view. A pointer press is left alone: the logo is already under the pointer.
   */
  const onViewportFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!target.matches(":focus-visible")) return;
    // A frame later, once `:focus-within` has held the animation.
    requestAnimationFrame(() => reveal(target));
  };

  const reveal = (target: Element) => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || typeof track.getAnimations !== "function") return;
    const animation = track.getAnimations()[0];
    const duration = Number(animation?.effect?.getComputedTiming().duration);
    const loop = track.getBoundingClientRect().width / 2;
    if (!animation || !(duration > 0) || !(loop > 0)) return;
    const style = getComputedStyle(viewport);
    const rtl = style.direction === "rtl";
    const box = viewport.getBoundingClientRect();
    const start = rtl ? box.right - Number.parseFloat(style.paddingRight) : box.left + Number.parseFloat(style.paddingLeft);
    const end = rtl ? box.left + Number.parseFloat(style.paddingLeft) : box.right - Number.parseFloat(style.paddingRight);
    const r = (target.closest("li") ?? target).getBoundingClientRect();
    // How far the logo reaches past each edge, in reading order (> 0: hidden there).
    const before = rtl ? r.right - start : start - r.left;
    const after = rtl ? end - r.left : r.right - end;
    // Distance to wind the loop on (> 0) or back (< 0); never past the logo's start.
    const shift = before > 0 ? -before : after > 0 ? Math.min(after, -before) : 0;
    if (shift === 0) return;
    const now = Number(animation.currentTime ?? 0) % duration;
    animation.currentTime = Math.min(duration, Math.max(0, now + (shift / loop) * duration));
  };

  return (
    <div
      data-color-on-hover={colorOnHover || undefined}
      data-marquee={moving ? (paused ? "paused" : "running") : undefined}
      className={cn("r-marketing-logo-cloud @container flex min-w-0 flex-col gap-r3", className)}
      {...props}
    >
      {title && (
        <p id={titleId} className={cn("min-w-0 [overflow-wrap:anywhere] text-center text-body-2 font-medium text-fg-muted", classNames?.title)}>
          {title}
        </p>
      )}
      {moving ? (
        <div className="flex min-w-0 items-center gap-r4">
          <div ref={viewportRef} onFocus={onViewportFocus} className={cn("r-marketing-logo-cloud-viewport min-w-0 flex-1", classNames?.viewport)}>
            <div
              ref={trackRef}
              className="r-marketing-logo-cloud-track"
              style={
                fit.width > 0
                  ? ({ "--r-marketing-logo-cloud-duration": `${(fit.copies * fit.width) / speed}s` } as CSSProperties)
                  : undefined
              }
            >
              <ul ref={setRef} {...name} className={cn("r-marketing-logo-cloud-set", classNames?.list)}>
                {items}
              </ul>
              {/* One loop is `copies` sets; the track holds two loops and moves by one. */}
              {Array.from({ length: fit.copies * 2 - 1 }, (_, i) => (
                <ul key={i} aria-hidden inert data-print="hide" className={cn("r-marketing-logo-cloud-set", classNames?.list)}>
                  {items}
                </ul>
              ))}
            </div>
          </div>
          <IconButton
            label={labels.pause}
            icon={paused ? <Play /> : <Pause />}
            aria-pressed={paused}
            onClick={() => setPaused((was) => !was)}
            data-print="hide"
            className={cn("shrink-0", classNames?.toggle)}
          />
        </div>
      ) : (
        <ul {...name} className={cn("flex flex-wrap items-center justify-center gap-x-section-2 gap-y-section-3", classNames?.list)}>
          {items}
        </ul>
      )}
    </div>
  );
}
