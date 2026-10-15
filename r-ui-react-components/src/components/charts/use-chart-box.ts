"use client";
import { type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";

import { estimateMeasure, type Measure } from "./chart-scale";

/** What a chart reads from the page to draw at its real size. */
export interface ChartBox {
  width: number;
  height: number;
  /** The axis text's computed font size, px. */
  fontSize: number;
  /** `--BAR-THICK` (density-aware), px. */
  barThick: number;
  /** `--RADIUS-SM`, the bars' data-end radius, px. */
  radius: number;
  /** Whether the box was measured (a browser) or is the fallback (the server, jsdom). */
  measured: boolean;
  /** Width of one line of axis text in the chart's own font. */
  measure: Measure;
}

/**
 * The size assumed before anything is measured: on the server, in a test
 * process (no ResizeObserver) and on the first client render. 13.5rem and 1rem
 * are the comfortable `--CHART-H` and `--BAR-THICK`, so a first paint is the
 * common case.
 */
const FALLBACK = { width: 640, height: 216, fontSize: 12, barThick: 16, radius: 4 };

type Font = string;
let canvas: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();

/** A canvas measurement in `font`, or `null` where no canvas is available. */
function canvasMeasure(font: Font): Measure | null {
  if (canvas === undefined) {
    try {
      canvas = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    } catch {
      canvas = null;
    }
  }
  const ctx = canvas;
  if (!ctx) return null;
  return (text) => {
    const key = `${font}\u0000${text}`;
    let w = widths.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width;
      if (widths.size > 5000) widths.clear();
      widths.set(key, w);
    }
    return w;
  };
}

const px = (value: string): number => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Measures `ref` (the plot box, sized by the caller's classes: `h-chart`, `w-full`)
 * and the `probe` inside it (sized `h-bar`, `rounded-sm`), and re-measures on any
 * resize of either, so a density switch, a container change, a theme's own
 * `--CHART-H` or a late web font all redraw. The probe is how a domain token is
 * read in px whatever unit it was declared in.
 *
 * Without ResizeObserver (the server, jsdom) the box is `FALLBACK`.
 */
export function useChartBox(ref: RefObject<HTMLElement | null>, probe: RefObject<HTMLElement | null>): ChartBox {
  const [box, setBox] = useState<Omit<ChartBox, "measure"> & { font: Font | null }>({ ...FALLBACK, measured: false, font: null });
  const last = useRef("");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const probeEl = probe.current;
      const probeRect = probeEl?.getBoundingClientRect();
      const next = {
        width: rect.width,
        height: rect.height,
        fontSize: px(style.fontSize) || FALLBACK.fontSize,
        barThick: probeRect?.height || FALLBACK.barThick,
        radius: probeEl ? px(getComputedStyle(probeEl).borderTopLeftRadius) : FALLBACK.radius,
        measured: true,
        font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
      };
      const key = JSON.stringify(next);
      if (key === last.current) return;
      last.current = key;
      setBox(next);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    if (probe.current) observer.observe(probe.current);
    // A web font that lands late changes every label's width and nothing's size.
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    const onFonts = () => {
      widths.clear();
      last.current = "";
      read();
    };
    fonts?.addEventListener?.("loadingdone", onFonts);
    return () => {
      observer.disconnect();
      fonts?.removeEventListener?.("loadingdone", onFonts);
    };
  }, [ref, probe]);

  const { font, ...rest } = box;
  const measure = useMemo(() => (font ? canvasMeasure(font) : null) ?? estimateMeasure(rest.fontSize), [font, rest.fontSize]);
  return { ...rest, measure };
}
