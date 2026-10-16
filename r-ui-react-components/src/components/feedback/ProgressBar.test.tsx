import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { ProgressBar } from "./ProgressBar";
import { DEFAULT_PROGRESS_LABELS, percentText } from "./progress-model";

/** The visible value: the aria-hidden text beside the label. */
const shown = (bar: HTMLElement) => bar.querySelector('[aria-hidden="true"]')?.textContent;
const fills = (bar: HTMLElement) =>
  [...bar.querySelectorAll<HTMLElement>('[data-print="exact"]')].map((el) => el.style.inlineSize);

describe("ProgressBar", () => {
  it("is a progressbar named by its label, with the value spoken and shown alike", () => {
    render(<ProgressBar label="Uploading report.pdf" value={45} />);
    const bar = screen.getByRole("progressbar", { name: "Uploading report.pdf" });
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-valuenow", "45");
    expect(bar).toHaveAttribute("aria-valuetext", "45%");
    expect(shown(bar)).toBe("45%");
    expect(fills(bar)).toEqual(["45%"]);
  });

  it("reads value against max, and clamps past either end so the announcement matches the fill", () => {
    const { rerender } = render(<ProgressBar label="Import" value={3} max={12} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuemax", "12");
    expect(bar).toHaveAttribute("aria-valuetext", "25%");
    expect(fills(bar)).toEqual(["25%"]);
    rerender(<ProgressBar label="Import" value={140} max={100} />);
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(shown(bar)).toBe("100%");
    expect(fills(bar)).toEqual(["100%"]);
    rerender(<ProgressBar label="Import" value={-5} />);
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(fills(bar)).toEqual(["0%"]);
  });

  it("rounds the percentage down: unfinished work never reads 100%, and 29 stays 29", () => {
    const { rerender } = render(<ProgressBar label="Sync" value={99.6} />);
    const bar = screen.getByRole("progressbar");
    expect(shown(bar)).toBe("99%");
    rerender(<ProgressBar label="Sync" value={29} />);
    expect(shown(bar)).toBe("29%");
    expect(percentText(0.29, "en-US")).toBe("29%");
    expect(percentText(0.57, "en-US")).toBe("57%");
  });

  it("formats in its locale: the prop, else the provider's", () => {
    const { rerender } = render(
      <LocaleProvider locale="de-DE">
        <ProgressBar label="Export" value={45} />
      </LocaleProvider>,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuetext")).toMatch(/^45\s%$/);
    rerender(
      <LocaleProvider locale="de-DE">
        <ProgressBar label="Export" value={45} locale="en-US" />
      </LocaleProvider>,
    );
    expect(bar).toHaveAttribute("aria-valuetext", "45%");
  });

  it("without a value (or with NaN, or a max that spans nothing) is indeterminate: no valuenow, the word, a sweep", () => {
    const { rerender } = render(<ProgressBar label="Preparing" />);
    const bar = screen.getByRole("progressbar", { name: "Preparing" });
    const check = () => {
      expect(bar).not.toHaveAttribute("aria-valuenow");
      expect(bar).not.toHaveAttribute("aria-valuemax");
      expect(bar).toHaveAttribute("aria-valuetext", DEFAULT_PROGRESS_LABELS.indeterminate);
      expect(bar).toHaveAttribute("data-indeterminate");
      expect(bar.querySelector(".r-feedback-progress-sweep")).not.toBeNull();
      expect(shown(bar)).toBe("In progress");
    };
    check();
    rerender(<ProgressBar label="Preparing" value={Number.NaN} />);
    check();
    rerender(<ProgressBar label="Preparing" value={4} max={0} />);
    check();
    rerender(<ProgressBar label="Preparing" value={4} />);
    expect(bar.querySelector(".r-feedback-progress-sweep")).toBeNull();
    expect(bar).not.toHaveAttribute("data-indeterminate");
  });

  it("a status tone is spoken after the value and drawn as a glyph; accent and neutral say nothing", () => {
    const { rerender } = render(<ProgressBar label="Upload" value={60} tone="error" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuetext", "60%, Error");
    expect(bar.querySelector("svg.text-status-error")).not.toBeNull();
    expect(bar.querySelector(".bg-status-error")).not.toBeNull();
    for (const tone of ["accent", "neutral"] as const) {
      rerender(<ProgressBar label="Upload" value={60} tone={tone} />);
      expect(bar).toHaveAttribute("aria-valuetext", "60%");
      expect(bar.querySelector("svg")).toBeNull();
    }
  });

  it("labels come from the provider, and the instance's win over it", () => {
    const { rerender } = render(
      <LocaleProvider labels={{ Progress: { indeterminate: "En cours", tones: { success: "Réussi" } } }}>
        <ProgressBar label="Envoi" />
        <ProgressBar label="Fini" value={100} tone="success" />
      </LocaleProvider>,
    );
    expect(screen.getByRole("progressbar", { name: "Envoi" })).toHaveAttribute("aria-valuetext", "En cours");
    expect(screen.getByRole("progressbar", { name: "Fini" })).toHaveAttribute("aria-valuetext", "100%, Réussi");
    rerender(
      <LocaleProvider labels={{ Progress: { indeterminate: "En cours" } }}>
        <ProgressBar label="Envoi" labels={{ indeterminate: "Patientez" }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("progressbar", { name: "Envoi" })).toHaveAttribute("aria-valuetext", "Patientez");
  });

  it("valueText replaces the shown and spoken value, keeping the tone word", () => {
    render(<ProgressBar label="Upload" value={32} valueText="3.2 of 10 MB" tone="warning" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuetext", "3.2 of 10 MB, Warning");
    expect(shown(bar)).toBe("3.2 of 10 MB");
  });

  it("segmented: one segment per step, a fraction fills part of the current one, the value counts whole steps", () => {
    render(<ProgressBar label="Deploy" variant="segmented" max={5} value={2.5} />);
    const bar = screen.getByRole("progressbar", { name: "Deploy" });
    expect(bar).toHaveAttribute("aria-valuemax", "5");
    expect(bar).toHaveAttribute("aria-valuenow", "2.5");
    expect(bar).toHaveAttribute("aria-valuetext", "2 of 5");
    expect(shown(bar)).toBe("2 of 5");
    const segments = [...bar.querySelectorAll("[data-segment]")].map((s) => s.getAttribute("data-segment"));
    expect(segments).toEqual(["done", "done", "partial", "pending", "pending"]);
    expect(fills(bar)).toEqual(["100%", "100%", "50%", "0%", "0%"]);
  });

  it("segmented steps are a whole number, and the steps label is translatable", () => {
    render(
      <ProgressBar
        label="Pipeline"
        variant="segmented"
        max={3.4}
        value={3}
        labels={{ steps: (done, total) => `Étape ${done} sur ${total}` }}
      />,
    );
    const bar = screen.getByRole("progressbar");
    expect(bar.querySelectorAll("[data-segment]")).toHaveLength(3);
    expect(bar).toHaveAttribute("aria-valuetext", "Étape 3 sur 3");
  });

  it("hideLabel keeps the name but hides the label; showValue={false} drops the visible value", () => {
    const { rerender } = render(<ProgressBar label="Row 4 upload" value={10} hideLabel />);
    const bar = screen.getByRole("progressbar", { name: "Row 4 upload" });
    expect(screen.getByText("Row 4 upload")).toHaveClass("sr-only");
    expect(shown(bar)).toBe("10%");
    rerender(<ProgressBar label="Row 4 upload" value={10} showValue={false} />);
    expect(screen.getByText("Row 4 upload")).not.toHaveClass("sr-only");
    expect(bar.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(bar).toHaveAttribute("aria-valuetext", "10%");
  });

  it("className is the root; classNames reach the parts; a caller's aria-labelledby wins", () => {
    render(
      <>
        <span id="outside">Outside name</span>
        <ProgressBar
          label="Inner"
          value={5}
          className="mt-r3"
          classNames={{ track: "h-r4", fill: "bg-series-2", label: "text-fg-primary" }}
          aria-labelledby="outside"
        />
      </>,
    );
    const bar = screen.getByRole("progressbar", { name: "Outside name" });
    expect(bar).toHaveClass("mt-r3");
    expect(bar.querySelector(".r-feedback-progress-track")).toHaveClass("h-r4");
    expect(bar.querySelector('[data-print="exact"]')).toHaveClass("bg-series-2");
    expect(screen.getByText("Inner")).toHaveClass("text-fg-primary");
  });
});
