import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Card } from "../primitives";
import { Spotlight } from "./Spotlight";

function stubFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => queue.push(cb));
  vi.stubGlobal("cancelAnimationFrame", () => {});
  return {
    queue,
    run: () =>
      act(() => {
        for (const cb of queue.splice(0)) cb(0);
      }),
  };
}

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

/** A 400 × 200 box at (100, 50). */
function placeBox() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 50, bottom: 250, left: 100, right: 500, width: 400, height: 200, x: 100, y: 50, toJSON: () => ({}),
  });
}

const x = (el: HTMLElement) => el.style.getPropertyValue("--r-motion-spotlight-x");
const y = (el: HTMLElement) => el.style.getPropertyValue("--r-motion-spotlight-y");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Spotlight", () => {
  it("follows a mouse at most once a frame, as the pointer's share of the box", () => {
    const frames = stubFrames();
    placeBox();
    render(<Spotlight data-testid="s">Card</Spotlight>);
    const box = screen.getByTestId("s");
    expect(box).toHaveClass("r-motion-spotlight");
    expect(box).not.toHaveAttribute("data-spotlight");

    fireEvent.pointerMove(box, { pointerType: "mouse", clientX: 150, clientY: 60 });
    fireEvent.pointerMove(box, { pointerType: "mouse", clientX: 200, clientY: 100 });
    expect(frames.queue).toHaveLength(1);
    frames.run();
    // The last move wins: (200 − 100) / 400, (100 − 50) / 200.
    expect(x(box)).toBe("0.25");
    expect(y(box)).toBe("0.25");
    expect(box).toHaveAttribute("data-spotlight", "on");

    fireEvent.pointerMove(box, { pointerType: "pen", clientX: 500, clientY: 250 });
    frames.run();
    expect(x(box)).toBe("1");
    expect(y(box)).toBe("1");
  });

  it("goes out when the pointer leaves, dropping a move still waiting for its frame", () => {
    const frames = stubFrames();
    placeBox();
    render(<Spotlight data-testid="s">Card</Spotlight>);
    const box = screen.getByTestId("s");
    fireEvent.pointerMove(box, { pointerType: "mouse", clientX: 200, clientY: 100 });
    frames.run();
    fireEvent.pointerMove(box, { pointerType: "mouse", clientX: 300, clientY: 100 });
    fireEvent.pointerLeave(box, { pointerType: "mouse" });
    expect(box).not.toHaveAttribute("data-spotlight");
    frames.run();
    expect(box).not.toHaveAttribute("data-spotlight");
  });

  it("ignores a finger: no frame is asked for and nothing lights", () => {
    const frames = stubFrames();
    placeBox();
    render(<Spotlight data-testid="s">Card</Spotlight>);
    const box = screen.getByTestId("s");
    fireEvent.pointerMove(box, { pointerType: "touch", clientX: 200, clientY: 100 });
    expect(frames.queue).toHaveLength(0);
    expect(box).not.toHaveAttribute("data-spotlight");
    expect(x(box)).toBe("");
  });

  it("does nothing under reduced motion", () => {
    stubReducedMotion(true);
    const frames = stubFrames();
    placeBox();
    render(<Spotlight data-testid="s">Card</Spotlight>);
    const box = screen.getByTestId("s");
    fireEvent.pointerMove(box, { pointerType: "mouse", clientX: 200, clientY: 100 });
    expect(frames.queue).toHaveLength(0);
    expect(box).not.toHaveAttribute("data-spotlight");
  });

  it("renders the card it is given, keeping the card's look and the caller's handlers", () => {
    const frames = stubFrames();
    placeBox();
    const onPointerMove = vi.fn();
    const onPointerLeave = vi.fn();
    render(
      <Spotlight as={Card} data-testid="s" className="p-r3" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        Plan
      </Spotlight>,
    );
    const card = screen.getByTestId("s");
    expect(card).toHaveClass("r-motion-spotlight", "bg-surface-0", "rounded-lg", "p-r3");
    fireEvent.pointerMove(card, { pointerType: "mouse", clientX: 300, clientY: 150 });
    fireEvent.pointerMove(card, { pointerType: "touch", clientX: 300, clientY: 150 });
    fireEvent.pointerLeave(card, { pointerType: "mouse" });
    expect(onPointerMove).toHaveBeenCalledTimes(2);
    expect(onPointerLeave).toHaveBeenCalledTimes(1);
    frames.run();
    expect(card).not.toHaveAttribute("data-spotlight");
  });
});
