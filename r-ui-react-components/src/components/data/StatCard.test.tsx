import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatCard } from "./StatCard";

const delta = () => screen.getByText((_, el) => el?.hasAttribute("data-sentiment") ?? false);

describe("StatCard", () => {
  it("is a group named by its label, showing the value and unit", () => {
    render(<StatCard label="p95 latency" value="212" unit="ms" />);
    const group = screen.getByRole("group", { name: "p95 latency" });
    expect(group).toHaveTextContent("212ms");
    expect(screen.getByText("212")).toHaveClass("text-kpi", "tabular-nums");
  });

  it("is a size container, so text-kpi sizes by the tile", () => {
    render(<StatCard label="Requests" value="18.4K" />);
    expect(screen.getByRole("group")).toHaveClass("@container");
  });

  it("colours the delta by sentiment, not direction: error rate DOWN is good", () => {
    const { rerender } = render(<StatCard label="Error rate" value="0.42%" delta={-0.8} sentiment="good" />);
    expect(delta()).toHaveAttribute("data-sentiment", "good");
    expect(delta()).toHaveClass("text-trend-good");
    expect(delta()).toHaveTextContent("-0.8");
    expect(screen.getByText(", better")).toHaveClass("sr-only");

    rerender(<StatCard label="p95" value="212" delta={38} sentiment="bad" />);
    expect(delta()).toHaveClass("text-trend-bad");
    expect(delta()).not.toHaveClass("text-trend-good");
    expect(delta()).toHaveTextContent("+38");
    expect(screen.getByText(", worse")).toBeInTheDocument();
  });

  it("draws an unjudged change flat and says nothing extra", () => {
    render(<StatCard label="Queue" value="1.3M" delta={-3.1} deltaLabel="vs prior 24h" />);
    expect(delta()).toHaveClass("text-trend-flat");
    expect(screen.queryByText(/better|worse/)).toBeNull();
    expect(screen.getByText("vs prior 24h")).toBeInTheDocument();
  });

  it("formats the delta with the caller's formatter and lets sentiment words be replaced", () => {
    render(
      <StatCard
        label="Uptime"
        value="99.9%"
        delta={1.25}
        formatDelta={(d) => `${d.toFixed(2)} pts`}
        sentiment="good"
        sentimentLabels={{ good: "improving" }}
      />,
    );
    expect(delta()).toHaveTextContent("1.25 pts");
    expect(screen.getByText(", improving")).toBeInTheDocument();
  });

  it("renders a missing value as an em dash and hides its unit", () => {
    render(<StatCard label="Cost" value={null} unit="µ$" />);
    expect(screen.getByRole("group")).toHaveTextContent("Cost—");
    expect(screen.queryByText("µ$")).toBeNull();
  });

  it("marks a stale value with a clock, the age, and secondary ink", () => {
    render(<StatCard label="Queue depth" value="1.3M" stale="12 min old" />);
    const group = screen.getByRole("group", { name: "Queue depth" });
    expect(group).toHaveAttribute("data-stale");
    expect(screen.getByText("12 min old")).toBeInTheDocument();
    expect(screen.getByText("1.3M")).toHaveClass("text-fg-secondary");
  });

  it("is busy with skeletons while loading", () => {
    render(<StatCard label="Revenue" value="1,000" delta={3} loading sparkline={<svg data-testid="spark" />} />);
    expect(screen.getByRole("group")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("1,000")).toBeNull();
    expect(screen.queryByTestId("spark")).toBeNull();
  });

  it("renders the sparkline and status slots", () => {
    render(<StatCard label="Req" value="1" sparkline={<svg data-testid="spark" />} status={<span>Within SLO</span>} />);
    expect(screen.getByTestId("spark")).toBeInTheDocument();
    expect(screen.getByText("Within SLO")).toBeInTheDocument();
  });

  it("lets a huge value break inside the tile instead of holding it on one line", () => {
    render(<StatCard label="Requests (all time)" value="9,007,199,254,740,991" unit="req" />);
    const value = screen.getByText("9,007,199,254,740,991");
    expect(value).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
    expect(value).not.toHaveClass("whitespace-nowrap");
    // The unit stays glued to the figure: no space between them to wrap at.
    expect(value.textContent).toBe("9,007,199,254,740,991req");
  });

  it("lets a huge delta break inside the tile too", () => {
    render(<StatCard label="Requests" value="1" delta={1e12} sentiment="good" />);
    const figure = screen.getByText("+1,000,000,000,000");
    expect(figure).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
    expect(figure.parentElement).toHaveClass("min-w-0", "max-w-full");
  });
});
