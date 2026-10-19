import { formatDelta, formatNumber, formatPercent, formatUnit } from "../../../src/util/format";
import { DAY_MS, HOUR_MS } from "./data";

/** "14m ago", "3h ago", "2d ago": the largest whole unit, narrow. */
export function ago(minutes: number): string {
  if (minutes < 60) return `${formatUnit(minutes, "minute", { unitDisplay: "narrow" })} ago`;
  if (minutes < 1440) return `${formatUnit(Math.round(minutes / 60), "hour", { unitDisplay: "narrow" })} ago`;
  return `${formatUnit(Math.round(minutes / 1440), "day", { unitDisplay: "narrow" })} ago`;
}

/** A change in percent (4.2 -> "+4.2%"). */
export const percentDelta = (d: number) =>
  formatPercent(d / 100, { signDisplay: "exceptZero", maximumFractionDigits: 1 });

/** A change in percentage points (-0.08 -> "−0.08 pp"). */
export const pointDelta = (d: number) => `${formatDelta(d, { maximumFractionDigits: 2 })} pp`;

/** A window's length, narrow: "24h", "36h", "7d". Days once it is two or more whole days. */
export function shortSpan(ms: number): string {
  const hours = Math.round(ms / HOUR_MS);
  if (hours < 48) return formatUnit(hours, "hour", { unitDisplay: "narrow" });
  return formatUnit(Math.round(ms / DAY_MS), "day", { unitDisplay: "narrow" });
}

/** How a series of the given step reads in a card's description. */
export function stepText(stepHours: number): string {
  if (stepHours === 1) return "hourly";
  if (stepHours === 24) return "daily";
  return `${formatNumber(stepHours)}-hour intervals`;
}
