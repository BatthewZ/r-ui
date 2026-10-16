import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { ProgressRing } from "./ProgressRing";

const arc = (ring: HTMLElement) => ring.querySelector("circle[stroke-dasharray]")!;
const centre = (ring: HTMLElement) => ring.querySelector(":scope > span");

describe("ProgressRing", () => {
  it("is a progressbar named by label, and the arc covers the share", () => {
    render(<ProgressRing label="Profile complete" value={3} max={5} />);
    const ring = screen.getByRole("progressbar", { name: "Profile complete" });
    expect(ring).toHaveAttribute("aria-valuenow", "3");
    expect(ring).toHaveAttribute("aria-valuemax", "5");
    expect(ring).toHaveAttribute("aria-valuetext", "60%");
    expect(arc(ring)).toHaveAttribute("stroke-dasharray", "100");
    expect(Number(arc(ring).getAttribute("stroke-dashoffset"))).toBeCloseTo(40);
    expect(arc(ring)).toHaveAttribute("pathLength", "100");
  });

  it("no round cap at 0%, which would draw a dot that reads as work begun", () => {
    const { rerender } = render(<ProgressRing label="Setup" value={0} />);
    const ring = screen.getByRole("progressbar");
    expect(arc(ring)).toHaveAttribute("stroke-linecap", "butt");
    rerender(<ProgressRing label="Setup" value={1} />);
    expect(arc(ring)).toHaveAttribute("stroke-linecap", "round");
  });

  it("indeterminate: no valuenow, the indeterminate word, a quarter arc that spins", () => {
    render(<ProgressRing label="Syncing" />);
    const ring = screen.getByRole("progressbar", { name: "Syncing" });
    expect(ring).not.toHaveAttribute("aria-valuenow");
    expect(ring).toHaveAttribute("aria-valuetext", "In progress");
    expect(ring).toHaveAttribute("data-indeterminate");
    expect(arc(ring)).toHaveAttribute("stroke-dasharray", "25 75");
    expect(ring.querySelector("svg")).toHaveClass("animate-spin");
  });

  it("a determinate ring does not spin", () => {
    render(<ProgressRing label="Upload" value={10} />);
    expect(screen.getByRole("progressbar").querySelector("svg")).not.toHaveClass("animate-spin");
  });

  it("showValue puts the locale percentage in the centre; children replace it; icon size has no centre", () => {
    const { rerender } = render(
      <LocaleProvider locale="fr-FR">
        <ProgressRing label="Avancement" value={42} size="large" showValue />
      </LocaleProvider>,
    );
    let ring = screen.getByRole("progressbar");
    expect(centre(ring)?.textContent).toMatch(/^42\s%$/);
    expect(centre(ring)).toHaveAttribute("aria-hidden", "true");
    expect(centre(ring)).toHaveClass("text-h4");
    rerender(
      <ProgressRing label="Steps" value={3} max={5} size="large" valueText="3 of 5 steps">
        3/5
      </ProgressRing>,
    );
    // The provider is gone, so this is a new element.
    ring = screen.getByRole("progressbar");
    expect(centre(ring)?.textContent).toBe("3/5");
    expect(ring).toHaveAttribute("aria-valuetext", "3 of 5 steps");
    rerender(
      <ProgressRing label="Steps" value={3} max={5} size="icon" showValue>
        3/5
      </ProgressRing>,
    );
    expect(centre(ring)).toBeNull();
    expect(ring).toHaveClass("size-icon");
  });

  it("no centre by default, and none while indeterminate even with showValue", () => {
    const { rerender } = render(<ProgressRing label="Upload" value={20} />);
    const ring = screen.getByRole("progressbar");
    expect(centre(ring)).toBeNull();
    rerender(<ProgressRing label="Upload" showValue />);
    expect(centre(ring)).toBeNull();
  });

  it("sizes come from the tokens; the tone colours the arc and is spoken", () => {
    render(<ProgressRing label="Quota job" value={90} tone="warning" />);
    const ring = screen.getByRole("progressbar");
    expect(ring).toHaveClass("size-control");
    expect(arc(ring)).toHaveClass("text-status-warning");
    expect(ring).toHaveAttribute("aria-valuetext", "90%, Warning");
  });
});
