import { CircleAlert, Clock, TrendingDown, TrendingUp } from "lucide-react";

import { Rating } from "../../../src/components/form";
import { formatCompact, formatDelta, formatPercent } from "../../../src/util/format";
import { DemoLabel } from "../../shell/DemoLabel";

export const meta = {
  title: "Domain tokens",
  group: "tokens",
  order: 0,
  description:
    "This package's own tokens: series, sequential, trend, domain status, chart chrome, the rating fill and KPI sizing, each blended for the theme's scheme.",
};

// Literal class lists, so Tailwind's scanner sees every utility.
const SERIES = [
  "bg-series-1",
  "bg-series-2",
  "bg-series-3",
  "bg-series-4",
  "bg-series-5",
  "bg-series-6",
  "bg-series-7",
  "bg-series-8",
];
const SEQ = ["bg-seq-1", "bg-seq-2", "bg-seq-3", "bg-seq-4", "bg-seq-5", "bg-seq-6", "bg-seq-7"];

export default function DomainTokens() {
  return (
    <div className="flex flex-col gap-r2">
      <Row label="Series 1–8">
        <ol className="flex flex-wrap gap-r5" aria-label="Categorical series">
          {SERIES.map((cls, i) => (
            <li key={cls} className="flex items-center gap-r5 text-body-3 text-fg-secondary">
              <span className={`${cls} size-heat-cell rounded-sm`} aria-hidden />
              {i + 1}
            </li>
          ))}
        </ol>
      </Row>

      <Row label="Sequential 1–7">
        <div className="flex" role="img" aria-label="Sequential ramp, strongest first">
          {SEQ.map((cls) => (
            <span key={cls} className={`${cls} h-bar flex-1 first:rounded-s-sm last:rounded-e-sm`} />
          ))}
        </div>
      </Row>

      <Row label="Trend">
        <div className="flex flex-wrap gap-r3 text-body-2">
          <span className="inline-flex items-center gap-r6 text-trend-good">
            <TrendingDown aria-hidden className="size-icon" /> Error rate {formatPercent(-0.124, { signDisplay: "exceptZero" })}
          </span>
          <span className="inline-flex items-center gap-r6 text-trend-bad">
            <TrendingUp aria-hidden className="size-icon" /> p95 latency {formatDelta(38)} ms
          </span>
          <span className="inline-flex items-center gap-r6 text-trend-flat">Requests {formatDelta(0)}</span>
        </div>
      </Row>

      <Row label="Status">
        <div className="flex flex-wrap gap-r4 text-body-2">
          <span className="inline-flex items-center gap-r5 rounded-full bg-status-serious-bg px-r4 text-fg-serious">
            <CircleAlert aria-hidden className="size-icon text-status-serious" /> Serious
          </span>
          <span className="inline-flex items-center gap-r5 rounded-full bg-status-stale-bg px-r4 text-fg-stale">
            <Clock aria-hidden className="size-icon text-status-stale" /> Stale · 12 min old
          </span>
        </div>
      </Row>

      <Row label="Chart chrome">
        <svg className="h-chart w-full" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
          {[10, 20, 30].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} className="stroke-chart-grid" vectorEffect="non-scaling-stroke" />
          ))}
          <line x1="0" x2="100" y1="40" y2="40" className="stroke-chart-axis" vectorEffect="non-scaling-stroke" />
          <polyline
            points="0,30 15,26 30,28 45,18 60,21 75,12 100,9"
            fill="none"
            className="stroke-series-1"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </Row>

      <Row label="Rating fill">
        {/* `text-rating`, Rating's default ink: data, never the accent. */}
        <Rating value={3.5} readOnly />
      </Row>

      <Row label="KPI value (container-sized)">
        {/* Side by side when the demo has room; stacked (narrow = half width) on a phone,
            where a quarter-width tile could not hold the value at its floor. */}
        <div className="grid items-end gap-r3 @md:grid-cols-[1fr_3fr]">
          {["narrow", "wide"].map((w) => (
            <div key={w} className={`@container min-w-0 rounded-md border p-r3 ${w === "narrow" ? "w-1/2 @md:w-auto" : ""}`}>
              <div className="truncate text-body-3 text-fg-muted">Requests / min</div>
              <div className="text-kpi font-semibold">{formatCompact(128_430)}</div>
            </div>
          ))}
        </div>
      </Row>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-r5">
      <DemoLabel>{label}</DemoLabel>
      {children}
    </div>
  );
}
