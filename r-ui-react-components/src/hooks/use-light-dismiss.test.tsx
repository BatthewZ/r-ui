import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useLightDismiss } from "./use-light-dismiss";

// jsdom lays nothing out, so the panel's box has to be supplied for the
// inside/outside test to have anything to compare a press against.
const PANEL = { left: 100, top: 100, right: 300, bottom: 200 };
const OUTSIDE = { clientX: 50, clientY: 50 };
const INSIDE = { clientX: 200, clientY: 150 };

function withPanelRect(panel: HTMLElement) {
  panel.getBoundingClientRect = () =>
    ({
      ...PANEL,
      width: PANEL.right - PANEL.left,
      height: PANEL.bottom - PANEL.top,
      x: PANEL.left,
      y: PANEL.top,
      toJSON() {},
    }) as DOMRect;
}

function Panel({
  enabled,
  onDismiss,
  onPointerDown,
  onClick,
}: {
  enabled?: boolean;
  onDismiss: () => void;
  onPointerDown?: () => void;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useLightDismiss({ ref, enabled, onDismiss, onPointerDown, onClick });

  return (
    <div ref={ref} data-testid="panel" {...handlers}>
      <button type="button">Inside</button>
    </div>
  );
}

function renderPanel(props: Parameters<typeof Panel>[0]) {
  render(<Panel {...props} />);
  const panel = screen.getByTestId("panel");
  withPanelRect(panel);
  return panel;
}

describe("useLightDismiss", () => {
  it("dismisses on a press that starts and ends outside the panel", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({ onDismiss });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, OUTSIDE);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("stays put for a press inside the panel's own box", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({ onDismiss });

    // The panel's own padding lands on the panel element, which is why this is a
    // geometry question and not a target one.
    fireEvent.pointerDown(panel, INSIDE);
    fireEvent.click(panel, INSIDE);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stays put when a drag that began inside is released outside", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({ onDismiss });

    // Selecting text and releasing past the edge: the click's target resolves to
    // the panel and its coordinates read "outside", so the release alone is not
    // enough to tell this from a press on the scrim.
    fireEvent.pointerDown(screen.getByRole("button"), INSIDE);
    fireEvent.click(panel, OUTSIDE);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("stays put when a press outside is released on the panel", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({ onDismiss });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, INSIDE);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("ignores a press dispatched at a child, whatever its coordinates", () => {
    const onDismiss = vi.fn();
    renderPanel({ onDismiss });
    const child = screen.getByRole("button");

    fireEvent.pointerDown(child, OUTSIDE);
    fireEvent.click(child, OUTSIDE);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does nothing at all when disabled", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({ onDismiss, enabled: false });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, OUTSIDE);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("still runs the caller's handlers when disabled", () => {
    const onDismiss = vi.fn();
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const panel = renderPanel({ onDismiss, enabled: false, onPointerDown, onClick });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, OUTSIDE);

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("runs the caller's handlers alongside the dismissal", () => {
    const onDismiss = vi.fn();
    const onPointerDown = vi.fn();
    const onClick = vi.fn();
    const panel = renderPanel({ onDismiss, onPointerDown, onClick });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, OUTSIDE);

    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("lets the caller opt out by preventing the click", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({
      onDismiss,
      onClick: (event) => event.preventDefault(),
    });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, OUTSIDE);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("does not carry a press over to the next click", () => {
    const onDismiss = vi.fn();
    const panel = renderPanel({ onDismiss });

    fireEvent.pointerDown(panel, OUTSIDE);
    fireEvent.click(panel, OUTSIDE);
    // No press this time: a stale "started outside" would dismiss on a click the
    // user never began, which is how a keyboard-activated control inside the
    // panel would close it.
    fireEvent.click(panel, OUTSIDE);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
