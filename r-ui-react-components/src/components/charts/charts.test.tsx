import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BarChart } from "./BarChart";
import type { ChartSeries } from "./chart-model";
import { Heatmap } from "./Heatmap";
import { LineChart } from "./LineChart";

/**
 * The renderers, driven as a user would. jsdom has no ResizeObserver, so every
 * chart draws at the fallback box (640 × 216): enough to prove what is drawn and
 * wired, not where it lands. Geometry, overlap, the top layer and real pointer
 * hit testing are `scripts/browser/charts-interaction.js`.
 */

const days = ["Mon", "Tue", "Wed", "Thu"];
const regions: ChartSeries[] = [
  { name: "us-east", values: [10, 20, 30, 40] },
  { name: "eu-west", values: [5, null, 15, 25] },
];

const plotOf = (name: string) => screen.getByRole("group", { name });
const status = () => screen.getByRole("status");

describe("LineChart", () => {
  it("is a figure named by its label, with a summary and a table a screen reader can reach", () => {
    render(<LineChart label="Requests" x={days} series={regions} locale="en-US" />);
    const figure = screen.getByRole("figure", { name: "Requests" });
    expect(figure).toHaveAccessibleDescription(/Line chart, 2 series \(us-east, eu-west\), 4 points, Mon to Thu\. Values from 5 to 40\./);
    const table = within(figure).getByRole("table", { name: "Requests" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "us-east", "eu-west"]);
    expect(within(table).getByRole("row", { name: /Tue/ })).toHaveTextContent("Tue20—");
    // Beside a drawing the table is visually hidden, not removed.
    expect(figure.querySelector("[data-chart-table]")).toHaveAttribute("data-chart-table", "hidden");
    expect(figure.querySelector("svg path.r-charts-line")).not.toBeNull();
  });

  it("pairs every series with its colour AND a distinct shape in the legend", () => {
    const { container } = render(<LineChart label="Requests" x={days} series={regions} />);
    const legend = container.querySelector("[data-chart-legend]");
    expect(legend).toHaveAttribute("aria-hidden", "true");
    const items = [...(legend?.querySelectorAll("li") ?? [])];
    expect(items.map((li) => li.textContent)).toEqual(["us-east", "eu-west"]);
    const shapes = items.map((li) => li.querySelector("[data-shape]")?.getAttribute("data-shape"));
    const inks = items.map((li) => li.querySelector("svg")?.getAttribute("class")?.match(/text-series-\d/)?.[0]);
    expect(shapes).toEqual(["circle", "square"]);
    expect(inks).toEqual(["text-series-1", "text-series-2"]);
  });

  it("steps a crosshair with the keyboard and announces every series at that x", async () => {
    const user = userEvent.setup();
    const { container } = render(<LineChart label="Requests" x={days} series={regions} locale="en-US" />);
    await user.tab();
    expect(plotOf("Requests")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(container.querySelector("[data-chart-crosshair]")).toHaveAttribute("data-row", "0");
    expect(status()).toHaveTextContent("Mon: us-east 10, eu-west 5");
    await user.keyboard("{ArrowRight}");
    expect(status()).toHaveTextContent("Tue: us-east 20, eu-west —");
    const rows = [...container.querySelectorAll("[data-chart-tooltip-row]")].map((r) => r.textContent);
    expect(rows).toEqual(["20us-east", "—eu-west"]);
    await user.keyboard("{End}");
    expect(container.querySelector("[data-chart-crosshair]")).toHaveAttribute("data-row", "3");
    await user.keyboard("{ArrowRight}");
    expect(container.querySelector("[data-chart-crosshair]")).toHaveAttribute("data-row", "3");
    await user.keyboard("{Escape}");
    expect(container.querySelector("[data-chart-crosshair]")).toBeNull();
  });

  it("snaps a hovering pointer to the nearest x without announcing it", () => {
    const { container } = render(<LineChart label="Requests" x={days} series={regions} />);
    const plot = plotOf("Requests");
    // The fallback box is 640 wide; the last point sits near the right edge.
    fireEvent.pointerMove(plot, { clientX: 630, clientY: 50, pointerType: "mouse" });
    expect(container.querySelector("[data-chart-crosshair]")).toHaveAttribute("data-row", "3");
    expect(container.querySelectorAll("[data-chart-tooltip-row]")).toHaveLength(2);
    expect(status()).toHaveTextContent("");
    fireEvent.pointerLeave(plot, { pointerType: "mouse" });
    expect(container.querySelector("[data-chart-crosshair]")).toBeNull();
  });

  it("inspects a point on a tap, announces it, and lets a press elsewhere close it", () => {
    const { container } = render(
      <>
        <LineChart label="Requests" x={days} series={regions} locale="en-US" />
        <button type="button">elsewhere</button>
      </>,
    );
    fireEvent.pointerDown(plotOf("Requests"), { clientX: 630, clientY: 50, pointerType: "touch" });
    expect(status()).toHaveTextContent("Thu: us-east 40, eu-west 25");
    fireEvent.mouseDown(screen.getByRole("button", { name: "elsewhere" }));
    expect(container.querySelector("[data-chart-crosshair]")).toBeNull();
  });

  it("shows the table in place of the drawing on request, and back", async () => {
    const user = userEvent.setup();
    const { container } = render(<LineChart label="Requests" x={days} series={regions} />);
    await user.click(screen.getByRole("button", { name: "Show as table" }));
    expect(container.querySelector("[data-chart-table]")).toHaveAttribute("data-chart-table", "visible");
    expect(container.querySelector("[data-chart-plot]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show chart" }));
    expect(container.querySelector("[data-chart-plot]")).not.toBeNull();
  });

  it("shows the table when nothing can be drawn, and says so", () => {
    const { container } = render(<LineChart label="Gaps" x={days} series={[{ name: "a", values: [null, null, null, null] }]} />);
    expect(screen.getByText(/Nothing to draw/)).toBeInTheDocument();
    expect(container.querySelector("[data-chart-table]")).toHaveAttribute("data-chart-table", "visible");
    expect(screen.queryByRole("button", { name: "Show as table" })).toBeNull();
  });

  it("says No data with no rows at all", () => {
    render(<LineChart label="Nothing" series={[]} />);
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Nothing" })).toHaveAccessibleDescription("Line chart, no data.");
  });

  it("draws eight series in eight inks, notes the rest, and tabulates them", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ name: `svc-${i + 1}`, values: [i, i + 1] }));
    const { container } = render(<LineChart label="Many" series={many} />);
    expect(container.querySelectorAll("[data-chart-legend] li")).toHaveLength(8);
    expect(container.querySelectorAll("svg g[data-series]")).toHaveLength(8);
    expect(screen.getByText(/8 of 11 series drawn/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("columnheader")).toHaveLength(12);
  });

  it("renders hostile input without throwing", () => {
    const hostile: ChartSeries[][] = [
      [],
      [{ name: "one", values: [7] }],
      [{ name: "flat", values: [3, 3, 3] }],
      [{ name: "huge", values: [1e308, -1e308, Number.NaN, Infinity] }],
      [
        { name: "__proto__", values: [1, 2] },
        { name: "__proto__", values: [2, 1] },
      ],
      [{ name: "x".repeat(20_000), values: [-1, -2, -3] }],
      [null as never, { values: "nope" } as never],
    ];
    for (const series of hostile) {
      const { unmount } = render(<LineChart label="Hostile" x={["x".repeat(20_000), "b"]} series={series} area />);
      expect(screen.getByRole("figure", { name: "Hostile" })).toBeInTheDocument();
      unmount();
    }
  });
});

describe("BarChart", () => {
  const classes: ChartSeries[] = [{ name: "Errors", values: [412, 1280, 96] }];

  it("labels horizontal bars by category and carries the value at the tip", () => {
    const { container } = render(
      <BarChart label="Errors by class" orientation="horizontal" x={["5xx", "4xx", "Timeouts"]} series={classes} locale="en-US" />,
    );
    const svg = container.querySelector("svg.r-charts-svg");
    expect([...(svg?.querySelectorAll("[data-axis=category] text") ?? [])].map((t) => t.textContent)).toEqual(["5xx", "4xx", "Timeouts"]);
    expect([...(svg?.querySelectorAll(".r-charts-value text") ?? [])].map((t) => t.textContent)).toEqual(["412", "1,280", "96"]);
    expect(svg?.querySelectorAll("path.r-charts-bar")).toHaveLength(3);
    // One series: the label names it, so there is no legend.
    expect(container.querySelector("[data-chart-legend]")).toBeNull();
  });

  it("lists every stacked series and their total for the band under the keyboard", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <BarChart label="Errors over time" stacked x={days} series={[...regions, { name: "ap-south", values: [1, 1, 1, 1] }]} locale="en-US" />,
    );
    await user.tab();
    await user.keyboard("{Home}");
    expect(container.querySelector("[data-chart-band]")).toHaveAttribute("data-row", "0");
    expect(status()).toHaveTextContent("Mon: us-east 10, eu-west 5, ap-south 1, Total 16");
    await user.keyboard("{ArrowDown}");
    expect(status()).toHaveTextContent("Tue: us-east 20, eu-west —, ap-south 1, Total 21");
  });
});

describe("Heatmap", () => {
  const rows = ["Mon", "Tue"];
  const columns = ["00", "01", "02"];
  const values = [
    [0, 5, 10],
    [null, 20, 40],
  ];

  it("paints each cell a ramp step, a gap as an empty cell, and tabulates every value", () => {
    const { container } = render(<Heatmap label="5xx by hour" rows={rows} columns={columns} values={values} locale="en-US" />);
    const steps = [...container.querySelectorAll("[data-cell]")].map((c) => c.getAttribute("data-step"));
    expect(steps).toEqual(["7", "7", "6", null, "4", "1"]);
    expect(container.querySelector('[data-cell="1:0"]')).toHaveClass("r-charts-heat-missing");
    expect(container.querySelector('[data-cell="1:2"]')).toHaveClass("bg-seq-1");
    const table = screen.getByRole("table", { name: "5xx by hour" });
    expect(within(table).getByRole("row", { name: /Tue/ })).toHaveTextContent("Tue—2040");
  });

  it("moves cell by cell with the arrows and announces the value", async () => {
    const user = userEvent.setup();
    render(<Heatmap label="5xx by hour" rows={rows} columns={columns} values={values} valueLabel="5xx errors" locale="en-US" />);
    await user.tab();
    await user.keyboard("{ArrowRight}");
    expect(status()).toHaveTextContent("Mon · 00: 5xx errors 0");
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(status()).toHaveTextContent("Tue · 01: 5xx errors 20");
    await user.keyboard("{End}");
    expect(status()).toHaveTextContent("Tue · 02: 5xx errors 40");
    await user.keyboard("{Home}");
    expect(status()).toHaveTextContent("Tue · 00: 5xx errors —");
  });

  it("renders hostile grids without throwing", () => {
    for (const grid of [[], [[]], [[Number.NaN, Infinity]], [[1e308, -1e308]], null as never]) {
      const { unmount } = render(<Heatmap label="H" rows={["x".repeat(20_000)]} columns={[]} values={grid} />);
      expect(screen.getByRole("figure", { name: "H" })).toBeInTheDocument();
      unmount();
    }
  });
});
