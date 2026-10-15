"use client";
import { Check, X } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { cn } from "../../util/style";
import { contrastRatio, composite, maxChroma, paintPlane, type Rgb, wcagLevels } from "./color-core";

/*
 * ColorPicker's internal parts: the lightness × chroma area, the one-axis
 * slider (hue, opacity), the swatch radio group and the contrast readout. Not
 * public components: a general Slider is out of scope, and these speak colour.
 */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isRtl = (el: Element) => getComputedStyle(el).direction === "rtl";

/** Where a pointer sits along an element, 0–1 from its inline start (RTL-aware), and down its block axis. */
function pointerFraction(el: HTMLElement, event: PointerEvent) {
  const r = el.getBoundingClientRect();
  const fx = r.width > 0 ? clamp((event.clientX - r.left) / r.width, 0, 1) : 0;
  const fy = r.height > 0 ? clamp((event.clientY - r.top) / r.height, 0, 1) : 0;
  return { x: isRtl(el) ? 1 - fx : fx, y: fy };
}

/**
 * Pointer drag on a surface: a press moves the value there and captures the
 * pointer, so the drag follows outside the surface. Focus goes to `thumb` (the
 * keyboard control) without scrolling, so keys continue from where the press left.
 */
function useDrag(onMove: (event: PointerEvent<HTMLDivElement>) => void, thumb: RefObject<HTMLElement | null>) {
  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (event.button !== 0) return;
      // Before the press's default action, which would focus the panel instead.
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      thumb.current?.focus({ preventScroll: true });
      onMove(event);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) onMove(event);
    },
  };
}

// ── The area ────────────────────────────────────────────────────────────────

export interface ColorAreaProps {
  hue: number;
  /** Lightness, 0–1. */
  l: number;
  /** Chroma as shown (inside sRGB). */
  c: number;
  /** Chroma at the area's end edge. */
  axis: number;
  label: string;
  roleDescription: string;
  valueText: string;
  /** The colour under the thumb, painted on it. */
  paint: string;
  onChange: (l: number, c: number) => void;
  className?: string;
}

/**
 * Lightness (up) × chroma (toward the inline end) at one hue, painted on a
 * canvas; the region sRGB cannot show is left clear over a hatch, so the gamut's
 * edge is visible and the thumb cannot cross it. One focusable thumb
 * (`role="slider"`, lightness as its value, both axes in its value text):
 * arrows move by 1% (Shift: 10%), Page Up/Down move lightness by 10%, Home/End
 * go to no chroma / the most sRGB holds.
 */
export function ColorArea({ hue, l, c, axis, label, roleDescription, valueText, paint, onChange, className }: ColorAreaProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const set = (nextL: number, nextC: number) => {
    const lightness = clamp(nextL, 0, 1);
    onChange(lightness, clamp(nextC, 0, maxChroma(lightness, hue)));
  };

  // The backing store follows the drawn size (and pixel ratio), re-measured on resize.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measure = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(canvas.clientWidth * ratio);
      const h = Math.round(canvas.clientHeight * ratio);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    // No 2D canvas (jsdom, a locked-down engine): the hatch and the thumb remain.
    if (!canvas || size.w === 0 || size.h === 0 || typeof CanvasRenderingContext2D === "undefined") return;
    canvas.width = size.w;
    canvas.height = size.h;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(size.w, size.h);
    paintPlane(image.data, size.w, size.h, hue, axis);
    context.putImageData(image, 0, 0);
  }, [hue, axis, size]);

  const drag = useDrag((event) => {
    const area = areaRef.current;
    if (!area) return;
    const f = pointerFraction(area, event);
    set(1 - f.y, f.x * axis);
  }, thumbRef);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = event.shiftKey ? 10 : 1;
    const stepL = 0.01 * big;
    const stepC = axis * 0.01 * big;
    const toEnd = isRtl(event.currentTarget) ? -1 : 1;
    switch (event.key) {
      case "ArrowUp":
        set(l + stepL, c);
        break;
      case "ArrowDown":
        set(l - stepL, c);
        break;
      case "ArrowRight":
        set(l, c + stepC * toEnd);
        break;
      case "ArrowLeft":
        set(l, c - stepC * toEnd);
        break;
      case "PageUp":
        set(l + 0.1, c);
        break;
      case "PageDown":
        set(l - 0.1, c);
        break;
      case "Home":
        set(l, 0);
        break;
      case "End":
        set(l, maxChroma(l, hue));
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div ref={areaRef} className={cn("r-form-color-area", className)} {...drag}>
      <canvas ref={canvasRef} className="r-form-color-area-canvas" aria-hidden />
      <div
        ref={thumbRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-roledescription={roleDescription}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(l * 100)}
        aria-valuetext={valueText}
        className="r-form-color-thumb"
        style={
          {
            insetInlineStart: `${axis > 0 ? (c / axis) * 100 : 0}%`,
            insetBlockStart: `${(1 - l) * 100}%`,
            "--r-form-color-paint": paint,
          } as CSSProperties
        }
        onKeyDown={onKeyDown}
      >
        <span aria-hidden className="r-form-color-thumb-hit hit-area" />
      </div>
    </div>
  );
}

// ── One-axis slider ─────────────────────────────────────────────────────────

export interface ColorSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Arrow step; Shift + arrow and Page Up/Down move ten of them. */
  step: number;
  valueText: string;
  /** The track's background image: a gradient through the values. */
  track: string;
  /** Lay the track over a checkerboard (opacity). */
  checker?: boolean;
  paint: string;
  onChange: (value: number) => void;
  className?: string;
}

/**
 * A horizontal slider on a painted track. The root is the press target (at
 * least `--HIT-MIN` tall), the thumb is the keyboard control (`role="slider"`).
 * In RTL the track runs from the inline start, and ArrowRight decreases.
 */
export function ColorSlider({ label, value, min, max, step, valueText, track, checker, paint, onChange, className }: ColorSliderProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const set = (next: number) => onChange(clamp(Math.round(next / step) * step, min, max));
  const drag = useDrag((event) => {
    const rail = railRef.current;
    if (rail) set(min + pointerFraction(rail, event).x * (max - min));
  }, thumbRef);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = step * 10;
    const toEnd = isRtl(event.currentTarget) ? -1 : 1;
    const by = event.shiftKey ? big : step;
    switch (event.key) {
      case "ArrowRight":
        set(value + by * toEnd);
        break;
      case "ArrowLeft":
        set(value - by * toEnd);
        break;
      case "ArrowUp":
        set(value + by);
        break;
      case "ArrowDown":
        set(value - by);
        break;
      case "PageUp":
        set(value + big);
        break;
      case "PageDown":
        set(value - big);
        break;
      case "Home":
        set(min);
        break;
      case "End":
        set(max);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <div className={cn("r-form-color-slider", className)} {...drag}>
      <div ref={railRef} className="r-form-color-rail">
        <div className="r-form-color-track" data-checker={checker ? "" : undefined}>
          <div className="r-form-color-track-paint" style={{ backgroundImage: track }} />
        </div>
        <div
          ref={thumbRef}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-orientation="horizontal"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={Math.round(value)}
          aria-valuetext={valueText}
          className="r-form-color-thumb"
          style={
            {
              insetInlineStart: `${max > min ? ((value - min) / (max - min)) * 100 : 0}%`,
              insetBlockStart: "50%",
              "--r-form-color-paint": paint,
            } as CSSProperties
          }
          onKeyDown={onKeyDown}
        >
          <span aria-hidden className="r-form-color-thumb-hit hit-area" />
        </div>
      </div>
    </div>
  );
}

// ── Swatches ────────────────────────────────────────────────────────────────

export interface SwatchOption {
  /** The value committed when chosen, in the picker's format. */
  value: string;
  label: string;
  /** The colour to paint (sRGB, alpha included). */
  paint: string;
}

/**
 * Consumer swatches as a radio group (WAI-ARIA APG): one tab stop (the checked
 * swatch, else the first), arrows move and choose, wrapping. Each swatch is
 * named by its label; the selected one carries a ring, so the choice reads
 * without colour.
 */
export function SwatchGroup({
  label,
  options,
  selected,
  onSelect,
  className,
}: {
  label: string;
  options: readonly SwatchOption[];
  selected: string | undefined;
  onSelect: (option: SwatchOption) => void;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const checkedIndex = options.findIndex((o) => o.value === selected);
  const stop = checkedIndex === -1 ? 0 : checkedIndex;
  const labelId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = options.length;
    const forward = isRtl(event.currentTarget) ? "ArrowLeft" : "ArrowRight";
    const back = forward === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
    let next: number;
    if (event.key === forward || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === back || event.key === "ArrowUp") next = (index - 1 + count) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onSelect(option);
    refs.current[next]?.focus();
  };

  return (
    <div className={cn("grid gap-r5", className)}>
      <div id={labelId} className="text-body-3 font-medium text-fg-muted">
        {label}
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="r-form-color-swatches">
        {options.map((option, index) => (
          <button
            key={`${option.value}-${index}`}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={index === checkedIndex}
            aria-label={option.label}
            title={option.label}
            tabIndex={index === stop ? 0 : -1}
            className="r-form-color-swatch"
            onClick={() => onSelect(option)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span aria-hidden className="r-form-color-chip" style={{ "--r-form-color-paint": option.paint } as CSSProperties} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Contrast ────────────────────────────────────────────────────────────────

export interface ContrastLabels {
  /** "Contrast on page surface". */
  heading: (against: string) => string;
  pass: string;
  fail: string;
}

/** Truncated, not rounded: 4.499 must not read as a passing "4.50". */
const ratioText = (ratio: number, locale?: string) =>
  new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.floor(ratio * 100) / 100);

/**
 * The WCAG 2.x ratio of the colour (laid over the background when translucent)
 * against `background`, with AA (4.5:1) and AAA (7:1) for body text, each a
 * glyph plus its name and a spoken pass/fail.
 */
export function ContrastReadout({
  color,
  alpha,
  background,
  against,
  labels,
  className,
}: {
  color: Rgb;
  alpha: number;
  background: Rgb | null;
  against: string;
  labels: ContrastLabels;
  className?: string;
}) {
  const ratio = background ? contrastRatio(composite(color, alpha, background), background) : null;
  const levels = ratio === null ? null : wcagLevels(ratio);
  const level = (name: string, ok: boolean): ReactNode => (
    <span className="inline-flex items-center gap-r6" data-level={name} data-pass={ok ? "" : undefined}>
      {ok ? (
        <Check aria-hidden className="size-icon text-fg-success" />
      ) : (
        <X aria-hidden className="size-icon text-fg-error" />
      )}
      <span className="font-medium text-fg-primary">{name}</span>{" "}
      <span className="sr-only">{ok ? labels.pass : labels.fail}</span>
    </span>
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-x-r4 gap-y-r6 text-body-2", className)} data-contrast>
      <span className="text-fg-secondary">{labels.heading(against)}</span>
      <span className="font-medium text-fg-primary" data-ratio={ratio === null ? undefined : ratio.toFixed(3)}>
        {ratio === null ? "—" : `${ratioText(ratio)}:1`}
      </span>
      {levels && level("AA", levels.aa)}
      {levels && level("AAA", levels.aaa)}
    </div>
  );
}
