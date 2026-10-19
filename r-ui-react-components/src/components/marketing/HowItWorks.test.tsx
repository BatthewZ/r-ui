import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HowItWorks, type HowItWorksProps } from "./HowItWorks";

function Steps({ count = 4, ...props }: Partial<HowItWorksProps> & { count?: number }) {
  return (
    <HowItWorks label="How it works" {...props}>
      {Array.from({ length: count }, (_, i) => (
        <HowItWorks.Step key={i} title={`Step title ${i + 1}`} media={i === 0 ? <img alt="Connect screen" src="x.png" /> : undefined}>
          Description {i + 1}
        </HowItWorks.Step>
      ))}
    </HowItWorks>
  );
}

const list = () => screen.getByRole("list", { name: "How it works" });

describe("HowItWorks", () => {
  it("is an ordered list of steps, each a numbered marker, a heading, its text and optional media", () => {
    render(<Steps />);
    expect(list().tagName).toBe("OL");
    const items = within(list()).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    items.forEach((item, i) => {
      expect(within(item).getByRole("heading", { level: 3, name: `Step title ${i + 1}` })).toHaveClass("text-display-4");
      const marker = item.querySelector(".r-steps-marker")!;
      // The number is drawn for the eye; the list's own order is what is read.
      expect(marker).toHaveAttribute("aria-hidden", "true");
      expect(marker).toHaveTextContent(String(i + 1));
    });
    expect(within(items[0]!).getByRole("img", { name: "Connect screen" })).toBeInTheDocument();
    expect(within(items[1]!).queryByRole("img")).toBeNull();
  });

  it("speaks the Stepper's visual language: its marker ring and marker size, no current step", () => {
    const { container } = render(<Steps />);
    // The steps group's root class carries the marker-size token; its marker class the ring.
    expect(container.firstElementChild).toHaveClass("r-steps-stepper", "@container");
    for (const marker of container.querySelectorAll(".r-steps-marker")) {
      expect(marker).toHaveAttribute("data-ring", "single");
      expect(marker).toHaveClass("size-(--r-steps-marker)", "rounded-full", "border-border-strong");
    }
    expect(container.querySelector("[aria-current]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("joins each step to the next with a connector, none after the last", () => {
    render(<Steps />);
    const items = within(list()).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector(".r-marketing-how-connector") !== null)).toEqual([true, true, true, false]);
  });

  it("auto: the row form is a container variant chosen by the step count", () => {
    const cases: Array<[number, string]> = [
      [2, "@sm:[--r-marketing-how-h:1]"],
      [3, "@xl:[--r-marketing-how-h:1]"],
      [4, "@3xl:[--r-marketing-how-h:1]"],
      [5, "@4xl:[--r-marketing-how-h:1]"],
      [7, "@5xl:[--r-marketing-how-h:1]"],
    ];
    const { rerender } = render(<Steps count={2} />);
    for (const [count, variant] of cases) {
      rerender(<Steps count={count} />);
      expect(list()).toHaveAttribute("data-steps", String(count));
      expect(list()).toHaveAttribute("data-orientation", "auto");
      const toggles = [...list().classList].filter((name) => name.includes("--r-marketing-how-h"));
      expect(toggles).toEqual([variant]);
    }
  });

  it("a fixed orientation sets the toggle always (horizontal) or never (vertical)", () => {
    const { rerender } = render(<Steps orientation="horizontal" />);
    expect(list()).toHaveClass("[--r-marketing-how-h:1]");
    rerender(<Steps orientation="vertical" />);
    expect([...list().classList].filter((name) => name.includes("--r-marketing-how-h"))).toEqual([]);
    expect(list()).toHaveAttribute("data-orientation", "vertical");
  });

  it("headingLevel moves every step title in the outline", () => {
    render(<Steps headingLevel={4} count={3} />);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(3);
  });

  it("puts className and props on the root, classNames.list on the list", () => {
    const { container } = render(<Steps className="mt-r2" data-testid="how" classNames={{ list: "gap-r1" }} />);
    expect(screen.getByTestId("how")).toBe(container.firstElementChild);
    expect(screen.getByTestId("how")).toHaveClass("mt-r2");
    expect(list()).toHaveClass("gap-r1");
  });
});
