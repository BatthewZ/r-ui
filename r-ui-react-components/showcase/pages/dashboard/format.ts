import { formatDelta, formatPercent, formatUnit } from "../../../src/util/format";
import type { Range } from "./data";

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

export const RANGE_LABEL: Record<Range, { prior: string; span: string; step: string }> = {
  "24h": { prior: "vs prior 24h", span: "Last 24 hours", step: "hourly" },
  "7d": { prior: "vs prior 7d", span: "Last 7 days", step: "4-hour intervals" },
  "30d": { prior: "vs prior 30d", span: "Last 30 days", step: "daily" },
  "90d": { prior: "vs prior 90d", span: "Last 90 days", step: "daily" },
};
