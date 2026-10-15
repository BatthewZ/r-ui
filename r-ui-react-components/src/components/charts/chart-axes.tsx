import type { Rect, ValueTick } from "./chart-plan";
import type { AxisLabel } from "./chart-scale";

/**
 * Gridlines, tick labels and the axis line, for either orientation. Chrome
 * recedes: gridlines in the chart-grid colour, the axis a step firmer, labels in
 * the contract's muted text (never a series colour), all at the theme's line
 * weight.
 */
export function CartesianAxes({
  plot,
  valueTicks,
  categoryLabels,
  zero,
  orientation,
  fontSize,
}: {
  plot: Rect;
  valueTicks: readonly ValueTick[];
  categoryLabels: readonly AxisLabel[];
  /** Where zero sits along the value axis, when it is not the plot's own edge. */
  zero: number | null;
  orientation: "vertical" | "horizontal";
  fontSize: number;
}) {
  const vertical = orientation === "vertical";
  return (
    <>
      <g className="r-charts-grid stroke-chart-grid">
        {valueTicks.map((t, i) =>
          vertical ? (
            <line key={i} x1={plot.left} x2={plot.right} y1={t.pos} y2={t.pos} />
          ) : (
            <line key={i} x1={t.pos} x2={t.pos} y1={plot.top} y2={plot.bottom} />
          ),
        )}
      </g>
      <g data-axis="value" className="r-charts-tick fill-fg-muted">
        {valueTicks.map((t, i) =>
          vertical ? (
            <text key={i} x={plot.left - fontSize * 0.5} y={t.pos} textAnchor="end" dominantBaseline="central">
              {t.label}
            </text>
          ) : (
            <text key={i} x={t.pos} y={plot.bottom + fontSize * 1.35} textAnchor="middle">
              {t.label}
            </text>
          ),
        )}
      </g>
      <g data-axis="category" className="r-charts-tick fill-fg-muted">
        {categoryLabels.map((l, i) =>
          vertical ? (
            <text key={i} x={l.center} y={plot.bottom + fontSize * 1.35} textAnchor="middle">
              {l.text}
            </text>
          ) : (
            <text key={i} x={plot.left - fontSize * 0.5} y={l.center} textAnchor="end" dominantBaseline="central">
              {l.text}
            </text>
          ),
        )}
      </g>
      <g className="r-charts-axis stroke-chart-axis">
        {vertical ? (
          <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} />
        ) : (
          <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} />
        )}
        {zero !== null &&
          (vertical ? (
            <line data-zero="" x1={plot.left} x2={plot.right} y1={zero} y2={zero} />
          ) : (
            <line data-zero="" x1={zero} x2={zero} y1={plot.top} y2={plot.bottom} />
          ))}
      </g>
    </>
  );
}
