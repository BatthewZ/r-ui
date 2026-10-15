import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Meter, meterTone } from "./Meter";

const CPU = [
  { at: 80, tone: "warning" as const },
  { at: 90, tone: "error" as const },
];

describe("Meter", () => {
  it("is a meter named by its label with value, range and text", () => {
    render(<Meter label="Disk used" value={412} max={500} valueText="412 of 500 GB" />);
    const meter = screen.getByRole("meter", { name: "Disk used" });
    expect(meter).toHaveAttribute("aria-valuenow", "412");
    expect(meter).toHaveAttribute("aria-valuemin", "0");
    expect(meter).toHaveAttribute("aria-valuemax", "500");
    expect(meter).toHaveAttribute("aria-valuetext", "412 of 500 GB");
    expect(screen.getByText("412 of 500 GB")).toBeInTheDocument();
  });

  it("defaults the text to a percentage of the range", () => {
    render(<Meter label="CPU" value={50} min={0} max={200} />);
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuetext", "25%");
  });

  it("maps thresholds to a tone: fill, a distinct icon, and a spoken word", () => {
    const { container, rerender } = render(<Meter label="CPU" value={62} thresholds={CPU} />);
    const meter = () => screen.getByRole("meter");
    expect(meter()).toHaveAttribute("data-tone", "neutral");
    expect(meter()).toHaveAttribute("aria-valuetext", "62%");
    expect(container.querySelector("svg")).toBeNull();

    rerender(<Meter label="CPU" value={85} thresholds={CPU} />);
    expect(meter()).toHaveAttribute("data-tone", "warning");
    expect(meter()).toHaveAttribute("aria-valuetext", "85%, Warning");
    expect(meter().firstElementChild).toHaveClass("bg-status-warning");
    expect(container.querySelector("svg")).toHaveClass("text-status-warning");

    rerender(<Meter label="CPU" value={97} thresholds={CPU} toneLabel="Overloaded" />);
    expect(meter()).toHaveAttribute("aria-valuetext", "97%, Overloaded");
    expect(meter().firstElementChild).toHaveClass("bg-status-error");
  });

  it("flips for worse='low' (budget left), most severe match winning", () => {
    const budget = [
      { at: 50, tone: "warning" as const },
      { at: 10, tone: "error" as const },
    ];
    expect(meterTone(64, budget, "low")).toBe("neutral");
    expect(meterTone(41, budget, "low")).toBe("warning");
    expect(meterTone(8, budget, "low")).toBe("error");
    expect(meterTone(8, CPU, "high")).toBe("neutral");
    expect(meterTone(95, CPU, "high")).toBe("error");
  });

  it("renders a missing value as an em dash with no aria-valuenow", () => {
    render(<Meter label="billing" value={null} thresholds={CPU} />);
    const meter = screen.getByRole("meter", { name: "billing" });
    expect(meter).not.toHaveAttribute("aria-valuenow");
    expect(meter).toHaveAttribute("aria-valuetext", "—");
    expect(meter.firstElementChild).toHaveStyle({ inlineSize: "0%" });
  });

  it("clamps the fill to the range", () => {
    render(<Meter label="over" value={140} />);
    expect(screen.getByRole("meter").firstElementChild).toHaveStyle({ inlineSize: "100%" });
  });

  it("inline: the label is hidden visually but still names the meter", () => {
    render(<Meter variant="inline" label="checkout CPU" value={91} thresholds={CPU} />);
    expect(screen.getByRole("meter", { name: "checkout CPU" })).toBeInTheDocument();
    expect(screen.getByText("checkout CPU")).toHaveClass("sr-only");
  });
});
