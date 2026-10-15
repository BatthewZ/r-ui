"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { usePrefersReducedMotion } from "../../hooks/use-reduced-motion";
import { elementChildren } from "../../util/children";
import { isRtl } from "../../util/direction";
import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "../primitives";
import { type LabelsProp, mergeLabels } from "../../util/labels";

/** The most slides side by side, reached only when the CAROUSEL is wide enough for each to keep a readable width. */
export type CarouselPerView = 1 | 2 | 3 | 4;

/**
 * Slides per view by the carousel's own width (container queries on the root),
 * never the viewport's: one, then two from 36rem (`@xl`), three from 56rem
 * (`@4xl`), four from 72rem (`@6xl`), so a slide never drops far below
 * `--COLUMN-MD` plus the peek. Literal class strings, so the build sees them.
 */
const PER_VIEW: Record<CarouselPerView, string> = {
  1: "[--r-marketing-carousel-per:1]",
  2: "[--r-marketing-carousel-per:1] @xl:[--r-marketing-carousel-per:2]",
  3: "[--r-marketing-carousel-per:1] @xl:[--r-marketing-carousel-per:2] @4xl:[--r-marketing-carousel-per:3]",
  4: "[--r-marketing-carousel-per:1] @xl:[--r-marketing-carousel-per:2] @4xl:[--r-marketing-carousel-per:3] @6xl:[--r-marketing-carousel-per:4]",
};

export interface CarouselLabels {
  prev: string;
  next: string;
  /** The rotation toggle while rotating. */
  pause: string;
  /** The rotation toggle while stopped. */
  play: string;
  /** A slide's name, 1-based ("3 of 8"). */
  slide: (index: number, total: number) => string;
  /** The status line for the slides in view, 1-based ("Slide 3 of 8" / "Slides 3–5 of 8"). */
  status: (first: number, last: number, total: number) => string;
  /** The track's name (it is a focusable scroller). */
  slides: string;
  /** The dots' tablist name. */
  dots: string;
}

export const DEFAULT_CAROUSEL_LABELS: CarouselLabels = {
  prev: "Previous slide",
  next: "Next slide",
  pause: "Pause slide show",
  play: "Play slide show",
  slide: (index, total) => `${index} of ${total}`,
  status: (first, last, total) => (first === last ? `Slide ${first} of ${total}` : `Slides ${first}–${last} of ${total}`),
  slides: "Slides",
  dots: "Choose a slide",
};

export type CarouselProps = {
  /** The carousel's accessible name (it is a region). Required: "Customer stories", "From the journal". */
  label: string;
  /** Default 1. */
  perView?: CarouselPerView;
  /**
   * `true` makes the indicator a tablist of dots, one per slide, and each slide its
   * tab panel. Only for slides that are tab-like: one per view, each a whole,
   * comparable thing. Otherwise the indicator is a status line, "Slide 3 of 8".
   */
  dots?: boolean;
  /**
   * Off by default. `true` (every 6s) or a number of milliseconds rotates the
   * slides, and adds a pause / play control (WCAG 2.2.2). Rotation pauses while
   * the pointer is over the carousel or focus is in it, and never starts under
   * reduced motion (the play control still can).
   */
  autoplay?: boolean | number;
  labels?: LabelsProp<CarouselLabels>;
  classNames?: SlotClassNames<"track" | "controls" | "status" | "dots" | "prev" | "next" | "toggle">;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<"section">, "children">;

const DEFAULT_INTERVAL = 6000;
/** Pointer and focus events cannot be cancelled, so a caller's `preventDefault()` must not skip ours. */
const UNCANCELABLE = { checkDefaultPrevented: false };


/** One slide. Write them as the carousel's direct children. */
export type CarouselSlideProps = ComponentPropsWithRef<"div">;

function CarouselSlide(props: CarouselSlideProps) {
  // The carousel renders each slide's element itself (it needs the index); this
  // is only the marker type and the props bag.
  return <div {...props} />;
}

type Direction = 1 | -1;

/**
 * The inline-start edge in reading order, and the sign of "forward" in
 * `scrollLeft`. `scrollLeft` runs negative under `dir="rtl"`.
 */
function geometry(track: HTMLElement) {
  const style = getComputedStyle(track);
  const rtl = style.direction === "rtl";
  const box = track.getBoundingClientRect();
  // The start edge of the content area: snapping aligns slides to it (`scroll-padding`).
  const pad = Number.parseFloat(rtl ? style.scrollPaddingRight : style.scrollPaddingLeft) || 0;
  const start = rtl ? box.right - pad : box.left + pad;
  /** How far `el`'s start edge is past the track's start edge, in reading order. */
  const offset = (el: Element) => {
    const r = el.getBoundingClientRect();
    return rtl ? start - r.right : r.left - start;
  };
  return { rtl, box, offset };
}

/**
 * A row of slides on a native scroll-snap track: touch swipe, trackpad and
 * shift-wheel scrolling come from the browser, and so does reaching every slide
 * without the controls (Tab into a slide scrolls it into view; the focused track
 * scrolls by arrow key). Previous / next move by one slide; part of the next slide
 * peeks in at the end so the row reads as scrollable.
 *
 * Keyboard: with the track focused, ArrowLeft / ArrowRight move one slide (mirrored
 * under `dir="rtl"`), Home / End go to the ends. Arrows pressed inside a slide's own
 * control are left alone. With `dots`, the dots are a tablist (arrows between them).
 *
 * No autoplay unless asked; when asked, it follows WCAG 2.2.2 (see `autoplay`).
 */
function CarouselRoot({
  label,
  perView = 1,
  dots = false,
  autoplay = false,
  labels: labelsProp,
  classNames,
  className,
  children,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: CarouselProps) {
  const labels = mergeLabels(DEFAULT_CAROUSEL_LABELS, labelsProp);
  const baseId = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const slides = elementChildren(children, CarouselSlide);
  const total = slides.length;

  // The slides in view, 0-based, and whether the track can move each way.
  const [range, setRange] = useState({ first: 0, last: 0 });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(total > 1);
  // The dot last chosen while its (smooth) scroll is still on the way: keys
  // step from it, and it shows as selected, until the track settles.
  const [target, setTarget] = useState<number | null>(null);

  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { box, offset } = geometry(track);
    const els = [...track.children];
    let first = -1;
    let last = -1;
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      // In view when at least half of it is inside the track.
      const visible = Math.min(r.right, box.right) - Math.max(r.left, box.left);
      if (r.width > 0 && visible >= r.width / 2) {
        if (first < 0) first = i;
        last = i;
      }
    });
    if (first < 0) {
      // No layout (jsdom) or nothing half in view: the slide nearest the start.
      const near = els.map((el) => Math.abs(offset(el)));
      first = last = Math.max(0, near.indexOf(Math.min(...near)));
    }
    setRange((prev) => (prev.first === first && prev.last === last ? prev : { first, last }));
    const scrolled = Math.abs(track.scrollLeft);
    const room = track.scrollWidth - track.clientWidth;
    setCanPrev(scrolled > 1);
    setCanNext(room - scrolled > 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    measure();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const onScrollEnd = () => {
      measure();
      setTarget(null);
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("scrollend", onScrollEnd);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onScroll);
    observer?.observe(track);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("scrollend", onScrollEnd);
      observer?.disconnect();
    };
  }, [measure, total]);

  const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";

  /** Scrolls so slide `index` starts at the track's start edge (the browser clamps at the end). */
  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const el = track?.children[index];
      if (!track || !el) return;
      const { rtl, offset } = geometry(track);
      const delta = offset(el);
      track.scrollBy({ left: rtl ? -delta : delta, behavior });
    },
    [behavior],
  );

  // Where `scrollend` is not supported: the scroll has arrived once it is measured there.
  if (target !== null && range.first === target) setTarget(null);

  const choose = useCallback(
    (index: number) => {
      setTarget(index);
      goTo(index);
    },
    [goTo],
  );

  /** One slide forward or back from the slides in view; forward from the end wraps when `wrap`. */
  const step = useCallback(
    (direction: Direction, wrap = false) => {
      const track = trackRef.current;
      if (!track) return;
      const { offset } = geometry(track);
      const offsets = [...track.children].map(offset);
      const atEnd = Math.abs(track.scrollLeft) >= track.scrollWidth - track.clientWidth - 1;
      if (direction === 1) {
        const next = offsets.findIndex((o) => o > 1);
        goTo(wrap && (atEnd || next < 0) ? 0 : next < 0 ? offsets.length - 1 : next);
      } else {
        let prev = -1;
        offsets.forEach((o, i) => {
          if (o < -1) prev = i;
        });
        goTo(Math.max(0, prev));
      }
    },
    [goTo],
  );

  const onTrackKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Arrows inside a slide's own control (an input, a slider) stay theirs.
    if (event.target !== event.currentTarget) return;
    const rtl = isRtl(event.currentTarget);
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward) step(1);
    else if (event.key === back) step(-1);
    else if (event.key === "Home") goTo(0);
    else if (event.key === "End") goTo(total - 1);
    else return;
    event.preventDefault();
  };

  // ── Rotation ───────────────────────────────────────────────────────────────
  const interval = autoplay === true ? DEFAULT_INTERVAL : typeof autoplay === "number" ? autoplay : 0;
  const rotates = interval > 0 && total > 1;
  // `playing` is the user's choice (the toggle); hover and focus only suspend it.
  // Reduced motion starts it stopped; an explicit press of play still runs it.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const playing = rotates && (chosen ?? !reducedMotion);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const running = playing && !hovered && !focused;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => step(1, true), interval);
    return () => window.clearInterval(timer);
  }, [running, interval, step]);

  const statusText = labels.status(range.first + 1, range.last + 1, total);
  const slideName = labels.slide;
  const trackId = `${baseId}-track`;
  const slideId = (i: number) => `${baseId}-slide-${i}`;
  const tabId = (i: number) => `${baseId}-tab-${i}`;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      data-playing={rotates ? String(running) : undefined}
      className={cn("@container flex min-w-0 flex-col gap-r3", className)}
      onPointerEnter={composeEventHandlers(
        onPointerEnter,
        (e) => {
          if (e.pointerType === "mouse") setHovered(true);
        },
        UNCANCELABLE,
      )}
      onPointerLeave={composeEventHandlers(onPointerLeave, () => setHovered(false), UNCANCELABLE)}
      onFocus={composeEventHandlers(onFocus, () => setFocused(true), UNCANCELABLE)}
      onBlur={composeEventHandlers(
        onBlur,
        (e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
        },
        UNCANCELABLE,
      )}
      {...props}
    >
      <div
        ref={trackRef}
        id={trackId}
        tabIndex={0}
        role="group"
        aria-label={labels.slides}
        // Announce the slide that comes into view only while the user drives it.
        aria-live={dots || rotates ? "off" : undefined}
        style={{ "--r-marketing-carousel-count": total } as CSSProperties}
        className={cn("r-marketing-carousel-track", PER_VIEW[perView], classNames?.track)}
        onKeyDown={onTrackKeyDown}
      >
        {slides.map((slide, i) => {
          const { className: slideClass, ...slideProps } = slide.props;
          return (
            <div
              key={slide.key ?? i}
              id={slideId(i)}
              role={dots ? "tabpanel" : "group"}
              aria-roledescription="slide"
              aria-label={slideName(i + 1, total)}
              aria-labelledby={dots ? tabId(i) : undefined}
              {...slideProps}
              className={cn("r-marketing-carousel-slide", slideClass)}
            />
          );
        })}
      </div>
      {total > 1 && (
        <div className={cn("flex min-w-0 flex-wrap items-center justify-between gap-r4", classNames?.controls)}>
          {dots ? (
            <Dots
              total={total}
              current={target ?? range.first}
              tabId={tabId}
              slideId={slideId}
              slideName={slideName}
              label={labels.dots}
              onSelect={choose}
              className={classNames?.dots}
            />
          ) : (
            <p
              role="status"
              aria-live={rotates && running ? "off" : "polite"}
              className={cn("min-w-0 text-body-2 text-fg-muted", classNames?.status)}
            >
              {statusText}
            </p>
          )}
          <div className="ms-auto flex items-center gap-r5">
            {rotates && (
              <IconButton
                variant="secondary"
                label={playing ? labels.pause : labels.play}
                icon={playing ? <Pause /> : <Play />}
                onClick={() => setChosen(!playing)}
                className={classNames?.toggle}
              />
            )}
            <IconButton
              variant="secondary"
              label={labels.prev}
              icon={<ChevronLeft className="rtl:-scale-x-100" />}
              aria-controls={trackId}
              aria-disabled={!canPrev || undefined}
              onClick={() => step(-1)}
              className={classNames?.prev}
            />
            <IconButton
              variant="secondary"
              label={labels.next}
              icon={<ChevronRight className="rtl:-scale-x-100" />}
              aria-controls={trackId}
              aria-disabled={!canNext || undefined}
              onClick={() => step(1)}
              className={classNames?.next}
            />
          </div>
        </div>
      )}
    </section>
  );
}

/**
 * A small disc meeting the hit floor through `hit-area`. Selected is the accent
 * fill over an edge at rest, a token utility, so it reads without colour (filled
 * vs ring) and survives forced colours.
 */
const DOT =
  "r-marketing-carousel-dot hit-area size-r4 shrink-0 cursor-pointer rounded-full border border-border-strong transition-colors hover:bg-fg-primary/8 aria-selected:border-accent aria-selected:bg-accent";

function Dots({
  total,
  current,
  tabId,
  slideId,
  slideName,
  label,
  onSelect,
  className,
}: {
  label: string;
  total: number;
  current: number;
  tabId: (i: number) => string;
  slideId: (i: number) => string;
  slideName: (index: number, total: number) => string;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = isRtl(event.currentTarget);
    const keys: Record<string, number> = {
      [rtl ? "ArrowLeft" : "ArrowRight"]: current + 1,
      [rtl ? "ArrowRight" : "ArrowLeft"]: current - 1,
      Home: 0,
      End: total - 1,
    };
    const target = keys[event.key];
    if (target === undefined) return;
    event.preventDefault();
    const index = (target + total) % total;
    onSelect(index);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
  };

  return (
    <div ref={listRef} role="tablist" aria-label={label} className={cn("flex flex-wrap items-center", className)} onKeyDown={onKeyDown}>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          id={tabId(i)}
          aria-controls={slideId(i)}
          aria-selected={i === current}
          aria-label={slideName(i + 1, total)}
          tabIndex={i === current ? 0 : -1}
          onClick={() => onSelect(i)}
          className={DOT}
        />
      ))}
    </div>
  );
}

/** Compound: `Carousel` with `Carousel.Slide` children. */
export const Carousel = Object.assign(CarouselRoot, { Slide: CarouselSlide });
