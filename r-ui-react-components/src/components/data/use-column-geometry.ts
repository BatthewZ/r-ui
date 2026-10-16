"use client";
import { type RefObject, useLayoutEffect, useState } from "react";

/** A header cell's drawn width and, for a resizable column, its resolved bounds, in px. */
export interface ColumnGeometry {
  width: number;
  min: number;
  max: number;
}

/**
 * A CSS length (`var(--MEASURE)`, `calc(var(--CONTROL-H) * 2)`) in px, as it
 * resolves where `host` is drawn, so density and theme move it. A hidden,
 * absolutely positioned probe takes no part in layout. Zero where nothing lays
 * out (jsdom).
 */
export function resolveLength(host: Element, css: string): number {
  const probe = document.createElement("span");
  probe.setAttribute("aria-hidden", "true");
  probe.dataset.columnProbe = css;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.setProperty("inline-size", css);
  host.append(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width;
}

export interface ColumnBounds {
  min: string;
  max: string;
}

const same = (a: Record<string, ColumnGeometry>, b: Record<string, ColumnGeometry>) => {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k];
    const y = b[k];
    return x !== undefined && y !== undefined && x.width === y.width && x.min === y.min && x.max === y.max;
  });
};

/**
 * The drawn width of every cell in the table's first head row that carries
 * `data-column-key`, by that key, re-read whenever one of them resizes (a
 * resize, a density change, a column shown or dropped). `bounds` resolves a
 * resizable column's min and max in its own header cell. Off while `enabled`
 * is false: a table without sticky or resizable columns measures nothing.
 */
export function useColumnGeometry(
  rootRef: RefObject<HTMLElement | null>,
  keys: readonly string[],
  bounds: Readonly<Record<string, ColumnBounds>>,
  enabled: boolean,
): Record<string, ColumnGeometry> {
  const [geometry, setGeometry] = useState<Record<string, ColumnGeometry>>({});
  const keyList = keys.join("\u0000");
  const boundList = JSON.stringify(bounds);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const parsed = JSON.parse(boundList) as Record<string, ColumnBounds>;
    const cells = () => [...root.querySelectorAll<HTMLElement>("thead tr:first-child > [data-column-key]")];
    const measure = () => {
      const next: Record<string, ColumnGeometry> = {};
      for (const cell of cells()) {
        const key = cell.dataset.columnKey as string;
        const b = parsed[key];
        next[key] = {
          width: cell.getBoundingClientRect().width,
          min: b ? resolveLength(cell, b.min) : 0,
          max: b ? resolveLength(cell, b.max) : 0,
        };
      }
      setGeometry((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    for (const cell of cells()) observer.observe(cell);
    return () => observer.disconnect();
  }, [rootRef, keyList, boundList, enabled]);

  return geometry;
}
