import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { LogoCloud, type LogoCloudProps } from "./LogoCloud";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: matches && query.includes("prefers-reduced-motion"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  );
}

/**
 * jsdom has no layout or ResizeObserver: a set of logos `setWidth` wide inside a
 * viewport `room` wide, observed by a ResizeObserver that reports once on observe.
 */
function stubLayout(setWidth: number, room: number) {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
    },
  );
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const width = this.classList.contains("r-marketing-logo-cloud-set") ? setWidth : 0;
    return { left: 0, right: width, width, top: 0, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({}) };
  });
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("r-marketing-logo-cloud-viewport") ? room : 0;
  });
}

function Customers(props: Partial<LogoCloudProps>) {
  return (
    <LogoCloud title="Trusted by teams at" {...props}>
      <img src="data:," alt="Halden Labs" />
      <svg role="img" aria-label="Northpine" />
      <a href="/stories/corvid">
        <img src="data:," alt="Corvid Health" />
      </a>
    </LogoCloud>
  );
}

const sets = (container: HTMLElement) => [...container.querySelectorAll("ul")];

describe("LogoCloud", () => {
  it("lists the logos once, named by its title, with no motion or toggle by default", () => {
    const { container } = render(<Customers />);
    const list = screen.getByRole("list", { name: "Trusted by teams at" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("img", { name: "Northpine" })).toBeInTheDocument();
    expect(sets(container)).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild).not.toHaveAttribute("data-marquee");
  });

  it("names the list from its labels when there is no title, the provider's under the instance's", () => {
    const { rerender } = render(
      <LocaleProvider labels={{ LogoCloud: { list: "Kunden" } }}>
        <Customers title={undefined} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("list", { name: "Kunden" })).toBeInTheDocument();
    rerender(
      <LocaleProvider labels={{ LogoCloud: { list: "Kunden" } }}>
        <Customers title={undefined} labels={{ list: "Clients" }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("list", { name: "Clients" })).toBeInTheDocument();
  });

  it("renders nothing without logos", () => {
    const { container } = render(<LogoCloud title="Trusted by" marquee />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marquee: one list for assistive tech; the copies that make the loop are hidden and inert", () => {
    const { container } = render(<Customers marquee />);
    const [original, ...copies] = sets(container);
    expect(original).toHaveAccessibleName("Trusted by teams at");
    expect(original).not.toHaveAttribute("aria-hidden");
    expect(copies.length).toBeGreaterThan(0);
    for (const copy of copies) {
      expect(copy).toHaveAttribute("aria-hidden", "true");
      expect(copy).toHaveAttribute("inert");
      expect(copy).toHaveAttribute("data-print", "hide");
    }
    // Only the original's link and image are in the accessibility tree.
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: "Halden Labs" })).toHaveLength(1);
    expect(screen.getAllByRole("list")).toHaveLength(1);
  });

  it("marquee: repeats the set until one loop covers the viewport, and times the loop by the speed", () => {
    stubLayout(200, 500);
    const { container } = render(<Customers marquee={40} />);
    // 500 / 200 → three sets per loop; the track holds two loops.
    expect(sets(container)).toHaveLength(6);
    const track = container.querySelector<HTMLElement>(".r-marketing-logo-cloud-track")!;
    // One loop is 3 × 200 = 600px at 40px a second.
    expect(track.style.getPropertyValue("--r-marketing-logo-cloud-duration")).toBe("15s");
  });

  it("marquee: a set wider than the viewport loops once, at the default speed", () => {
    stubLayout(640, 300);
    const { container } = render(<Customers marquee />);
    expect(sets(container)).toHaveLength(2);
    const track = container.querySelector<HTMLElement>(".r-marketing-logo-cloud-track")!;
    expect(track.style.getPropertyValue("--r-marketing-logo-cloud-duration")).toBe("20s");
  });

  it("marquee: the toggle pauses and resumes, keeping its name and carrying the state in aria-pressed", async () => {
    const user = userEvent.setup();
    const { container } = render(<Customers marquee />);
    const root = container.firstElementChild!;
    const toggle = screen.getByRole("button", { name: "Pause moving logos" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(root).toHaveAttribute("data-marquee", "running");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(toggle).toHaveAccessibleName("Pause moving logos");
    expect(root).toHaveAttribute("data-marquee", "paused");
    await user.click(toggle);
    expect(root).toHaveAttribute("data-marquee", "running");
    expect(toggle).toHaveAttribute("data-print", "hide");
  });

  it("marquee under reduced motion: the static wrapped list, no copies, no toggle", () => {
    stubReducedMotion(true);
    const { container } = render(<Customers marquee />);
    expect(sets(container)).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.firstElementChild).not.toHaveAttribute("data-marquee");
    expect(container.querySelector(".r-marketing-logo-cloud-track")).toBeNull();
  });

  it("marquee without reduced motion (the same stub, answering no) moves", () => {
    stubReducedMotion(false);
    const { container } = render(<Customers marquee />);
    expect(container.querySelector(".r-marketing-logo-cloud-track")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Pause moving logos" })).toBeInTheDocument();
  });

  it("a zero or negative speed is no marquee", () => {
    const { container, rerender } = render(<Customers marquee={0} />);
    expect(sets(container)).toHaveLength(1);
    rerender(<Customers marquee={-10} />);
    expect(sets(container)).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("marks colour on hover, takes className on the root and classNames on the parts", () => {
    const { container } = render(<Customers colorOnHover marquee className="mt-r2" classNames={{ logo: "px-r2", toggle: "ms-r2" }} />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-color-on-hover", "true");
    expect(root.classList).toContain("mt-r2");
    expect(root.querySelector("li")!.classList).toContain("px-r2");
    expect(screen.getByRole("button").classList).toContain("ms-r2");
  });
});
