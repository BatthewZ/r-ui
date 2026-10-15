import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Carousel, type CarouselProps } from "./Carousel";

/*
 * jsdom has no layout, so the scroller's geometry is stubbed at the boundary: a
 * 300px track whose slides are 300px wide with a 10px gap, scrolled by `scrollBy`.
 * Everything above it (which slide is next, the status, the timers) is real.
 */
const TRACK_W = 300;
const PITCH = 310;
let scroll = 0;
let scrollBy: ReturnType<typeof vi.fn>;

const isTrack = (el: Element) => el.classList.contains("r-marketing-carousel-track");
const slideIndex = (el: Element) => (el.classList.contains("r-marketing-carousel-slide") ? [...el.parentElement!.children].indexOf(el) : -1);

function rect(left: number, width: number): DOMRect {
  return { left, right: left + width, width, top: 0, bottom: 100, height: 100, x: left, y: 0, toJSON: () => ({}) };
}

beforeEach(() => {
  scroll = 0;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (isTrack(this)) return rect(0, TRACK_W);
    const i = slideIndex(this);
    return i >= 0 ? rect(i * PITCH - scroll, TRACK_W) : rect(0, 0);
  });
  const prop = (name: string, get: (el: HTMLElement) => number) =>
    vi.spyOn(HTMLElement.prototype, name as "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return isTrack(this) ? get(this) : 0;
    });
  prop("scrollWidth", (el) => (el.children.length - 1) * PITCH + TRACK_W);
  prop("clientWidth", () => TRACK_W);
  vi.spyOn(Element.prototype, "scrollLeft", "get").mockImplementation(() => scroll);
  scrollBy = vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
    const max = (this.children.length - 1) * PITCH;
    scroll = Math.min(max, Math.max(0, scroll + (options.left ?? 0)));
    this.dispatchEvent(new Event("scroll"));
  });
  Element.prototype.scrollBy = scrollBy as unknown as Element["scrollBy"];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

const flushFrame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

function Quotes(props: Partial<CarouselProps>) {
  return (
    <Carousel label="Customer stories" {...props}>
      <Carousel.Slide>First quote</Carousel.Slide>
      <Carousel.Slide>
        Second quote <a href="/story-2">Read the story</a>
      </Carousel.Slide>
      <Carousel.Slide>
        Third quote <input aria-label="Reply" />
      </Carousel.Slide>
    </Carousel>
  );
}

describe("Carousel", () => {
  it("is a named carousel region of named slides with a status line", () => {
    render(<Quotes />);
    const region = screen.getByRole("region", { name: "Customer stories" });
    expect(region).toHaveAttribute("aria-roledescription", "carousel");
    const slides = screen.getAllByRole("group").filter((g) => g.getAttribute("aria-roledescription") === "slide");
    expect(slides.map((s) => s.getAttribute("aria-label"))).toEqual(["1 of 3", "2 of 3", "3 of 3"]);
    expect(screen.getByRole("status")).toHaveTextContent("Slide 1 of 3");
    // Without dots there is no tablist.
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("next and previous move by exactly one slide, and say when they cannot", async () => {
    const user = userEvent.setup();
    render(<Quotes />);
    const prev = screen.getByRole("button", { name: "Previous slide" });
    const next = screen.getByRole("button", { name: "Next slide" });
    expect(prev).toHaveAttribute("aria-disabled", "true");
    expect(next).not.toHaveAttribute("aria-disabled");

    await user.click(next);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: PITCH, behavior: "smooth" });
    await flushFrame();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 2 of 3");
    expect(prev).not.toHaveAttribute("aria-disabled");

    await user.click(next);
    await flushFrame();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 3 of 3");
    expect(next).toHaveAttribute("aria-disabled", "true");
    // At the end, next is inert: no further scroll.
    await user.click(next);
    expect(scrollBy).toHaveBeenCalledTimes(2);

    await user.click(prev);
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -PITCH, behavior: "smooth" });
    await flushFrame();
    expect(screen.getByRole("status")).toHaveTextContent("Slide 2 of 3");
  });

  it("the focused track moves by arrows, Home and End", async () => {
    const user = userEvent.setup();
    render(<Quotes />);
    const track = screen.getByRole("group", { name: "Slides" });
    expect(track).toHaveAttribute("tabindex", "0");
    track.focus();
    await user.keyboard("{ArrowRight}");
    expect(scrollBy).toHaveBeenLastCalledWith({ left: PITCH, behavior: "smooth" });
    await user.keyboard("{End}");
    expect(scrollBy).toHaveBeenLastCalledWith({ left: PITCH, behavior: "smooth" });
    expect(scroll).toBe(2 * PITCH);
    await user.keyboard("{Home}");
    expect(scroll).toBe(0);
    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -PITCH, behavior: "smooth" });
    expect(scrollBy).toHaveBeenCalledTimes(5);
  });

  it("leaves arrows pressed inside a slide's own control alone", async () => {
    const user = userEvent.setup();
    render(<Quotes />);
    await user.click(screen.getByRole("textbox", { name: "Reply" }));
    await user.keyboard("{ArrowLeft}{ArrowRight}");
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("scrolls instantly under reduced motion", async () => {
    stubReducedMotion(true);
    const user = userEvent.setup();
    render(<Quotes />);
    await user.click(screen.getByRole("button", { name: "Next slide" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: PITCH, behavior: "auto" });
  });

  it("never rotates by default", () => {
    vi.useFakeTimers();
    render(<Quotes />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(scrollBy).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /slide show/ })).toBeNull();
  });

  describe("autoplay", () => {
    it("rotates on its interval, wraps at the end, and the toggle stops and restarts it", () => {
      vi.useFakeTimers();
      render(<Quotes autoplay={1000} />);
      const toggle = screen.getByRole("button", { name: "Pause slide show" });
      act(() => vi.advanceTimersByTime(1000));
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scroll).toBe(PITCH);
      act(() => vi.advanceTimersByTime(2000));
      expect(scroll).toBe(0); // 2 → wraps to the first slide
      expect(scrollBy).toHaveBeenCalledTimes(3);

      fireEvent.click(toggle);
      expect(screen.getByRole("button", { name: "Play slide show" })).toBe(toggle);
      act(() => vi.advanceTimersByTime(5000));
      expect(scrollBy).toHaveBeenCalledTimes(3);

      fireEvent.click(toggle);
      act(() => vi.advanceTimersByTime(1000));
      expect(scrollBy).toHaveBeenCalledTimes(4);
    });

    it("pauses while a mouse is over it or focus is in it, and resumes after", () => {
      vi.useFakeTimers();
      render(<Quotes autoplay={1000} />);
      const region = screen.getByRole("region", { name: "Customer stories" });

      fireEvent.pointerEnter(region, { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(5000));
      expect(scrollBy).not.toHaveBeenCalled();
      expect(region).toHaveAttribute("data-playing", "false");
      fireEvent.pointerLeave(region, { pointerType: "mouse" });
      act(() => vi.advanceTimersByTime(1000));
      expect(scrollBy).toHaveBeenCalledTimes(1);

      act(() => screen.getByRole("link", { name: "Read the story" }).focus());
      act(() => vi.advanceTimersByTime(5000));
      expect(scrollBy).toHaveBeenCalledTimes(1);
      // Still the user's choice: the toggle offers to pause, not to play.
      expect(screen.getByRole("button", { name: "Pause slide show" })).toBeInTheDocument();
      act(() => screen.getByRole("link", { name: "Read the story" }).blur());
      act(() => vi.advanceTimersByTime(1000));
      expect(scrollBy).toHaveBeenCalledTimes(2);
    });

    it("does not start under reduced motion; play still runs it on request", () => {
      stubReducedMotion(true);
      vi.useFakeTimers();
      render(<Quotes autoplay />);
      const toggle = screen.getByRole("button", { name: "Play slide show" });
      act(() => vi.advanceTimersByTime(60_000));
      expect(scrollBy).not.toHaveBeenCalled();
      fireEvent.click(toggle);
      act(() => vi.advanceTimersByTime(6000));
      expect(scrollBy).toHaveBeenCalledTimes(1);
      expect(scrollBy).toHaveBeenLastCalledWith({ left: PITCH, behavior: "auto" });
    });

    it("silences the status while it rotates", () => {
      render(<Quotes autoplay={1000} />);
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "off");
      fireEvent.click(screen.getByRole("button", { name: "Pause slide show" }));
      expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("dots", () => {
    it("are a tablist whose tabs control the slides, with one tab stop and arrow keys", async () => {
      const user = userEvent.setup();
      render(<Quotes dots />);
      const tabs = screen.getAllByRole("tab");
      expect(tabs.map((t) => t.getAttribute("aria-label"))).toEqual(["1 of 3", "2 of 3", "3 of 3"]);
      expect(tabs[0]).toHaveAttribute("aria-selected", "true");
      expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1, -1]);
      const panels = screen.getAllByRole("tabpanel");
      expect(panels).toHaveLength(3);
      expect(tabs[1]).toHaveAttribute("aria-controls", panels[1]!.id);
      // The dots replace the status line.
      expect(screen.queryByRole("status")).toBeNull();

      await user.click(tabs[0]!);
      await user.keyboard("{ArrowRight}");
      expect(scrollBy).toHaveBeenLastCalledWith({ left: PITCH, behavior: "smooth" });
      await flushFrame();
      expect(tabs[1]).toHaveFocus();
      expect(tabs[1]).toHaveAttribute("aria-selected", "true");
      expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1]);

      await user.click(tabs[2]!);
      await flushFrame();
      expect(scroll).toBe(2 * PITCH);
      expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    });
  });

  it("dot keys step from the slide last chosen, not from where a smooth scroll has got to", async () => {
    const user = userEvent.setup();
    // A smooth scroll in flight: the request is made, the track has not moved yet.
    const requested: number[] = [];
    Element.prototype.scrollBy = vi.fn((options: ScrollToOptions) => {
      requested.push(options.left ?? 0);
    }) as unknown as Element["scrollBy"];
    render(<Quotes dots />);
    const tabs = screen.getAllByRole("tab");
    await user.click(tabs[0]!);
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(requested).toEqual([0, PITCH, 2 * PITCH]);
    expect(tabs[2]).toHaveFocus();
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, -1, 0]);

    // The scroll lands: the measured slide agrees, and stays the selection.
    scroll = 2 * PITCH;
    fireEvent.scroll(document.querySelector(".r-marketing-carousel-track")!);
    await flushFrame();
    expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(requested.at(-1)).toBe(-PITCH);
    expect(tabs[1]).toHaveFocus();
  });

  it("only Carousel.Slide children become slides; one slide has no controls", () => {
    render(
      <Carousel label="One">
        <Carousel.Slide>Only</Carousel.Slide>
      </Carousel>,
    );
    expect(screen.getByText("Only")).toHaveAttribute("aria-label", "1 of 1");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("takes caller labels", () => {
    render(
      <Quotes
        labels={{
          prev: "Vorige",
          next: "Volgende",
          status: (f, _l, t) => `Dia ${f} van ${t}`,
          slide: (i, t) => `${i} van ${t}`,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Vorige" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volgende" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Dia 1 van 3");
    expect(screen.getByText("First quote")).toHaveAttribute("aria-label", "1 van 3");
  });
});
