import { fireEvent,render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRovingFocus } from "./use-roving-focus";

function RovingList({
  orientation = "vertical",
  loop = true,
}: {
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
}) {
  const { getRovingProps, focusedIndex, setFocusedIndex } = useRovingFocus({
    orientation,
    loop,
  });
  return (
    <div>
      {["A", "B", "C"].map((label, i) => {
        const props = getRovingProps(i);
        return (
          <button key={label} data-testid={`item-${i}`} {...props}>
            {label}
          </button>
        );
      })}
      <span data-testid="focused">{focusedIndex}</span>
      <button data-testid="outside" onClick={() => setFocusedIndex(2)}>
        outside
      </button>
    </div>
  );
}

describe("useRovingFocus", () => {
  it("first item has tabIndex=0, others have tabIndex=-1", () => {
    render(<RovingList />);

    expect(screen.getByTestId("item-0")).toHaveAttribute("tabindex", "0");
    expect(screen.getByTestId("item-1")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByTestId("item-2")).toHaveAttribute("tabindex", "-1");
  });

  describe("vertical orientation", () => {
    it("ArrowDown moves focus to the next item", () => {
      render(<RovingList orientation="vertical" />);

      const first = screen.getByTestId("item-0");
      first.focus();

      fireEvent.keyDown(first, { key: "ArrowDown" });

      expect(document.activeElement).toBe(screen.getByTestId("item-1"));
      expect(screen.getByTestId("focused").textContent).toBe("1");
    });

    it("ArrowUp moves focus to the previous item", () => {
      render(<RovingList orientation="vertical" />);

      const first = screen.getByTestId("item-0");
      first.focus();

      // Move to item-1 first
      fireEvent.keyDown(first, { key: "ArrowDown" });
      const second = screen.getByTestId("item-1");
      expect(document.activeElement).toBe(second);

      // Move back to item-0
      fireEvent.keyDown(second, { key: "ArrowUp" });

      expect(document.activeElement).toBe(screen.getByTestId("item-0"));
      expect(screen.getByTestId("focused").textContent).toBe("0");
    });
  });

  describe("horizontal orientation", () => {
    it("ArrowRight moves focus to the next item", () => {
      render(<RovingList orientation="horizontal" />);

      const first = screen.getByTestId("item-0");
      first.focus();

      fireEvent.keyDown(first, { key: "ArrowRight" });

      expect(document.activeElement).toBe(screen.getByTestId("item-1"));
      expect(screen.getByTestId("focused").textContent).toBe("1");
    });

    it("ArrowLeft moves focus to the previous item", () => {
      render(<RovingList orientation="horizontal" />);

      const first = screen.getByTestId("item-0");
      first.focus();

      // Move to item-1 first
      fireEvent.keyDown(first, { key: "ArrowRight" });
      const second = screen.getByTestId("item-1");

      // Move back to item-0
      fireEvent.keyDown(second, { key: "ArrowLeft" });

      expect(document.activeElement).toBe(screen.getByTestId("item-0"));
      expect(screen.getByTestId("focused").textContent).toBe("0");
    });
  });

  it("Home moves focus to the first item", () => {
    render(<RovingList orientation="vertical" />);

    const first = screen.getByTestId("item-0");
    first.focus();

    // Navigate to the last item
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByTestId("item-1"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("item-2"));

    // Press Home
    fireEvent.keyDown(screen.getByTestId("item-2"), { key: "Home" });

    expect(document.activeElement).toBe(screen.getByTestId("item-0"));
    expect(screen.getByTestId("focused").textContent).toBe("0");
  });

  it("End moves focus to the last item", () => {
    render(<RovingList orientation="vertical" />);

    const first = screen.getByTestId("item-0");
    first.focus();

    fireEvent.keyDown(first, { key: "End" });

    expect(document.activeElement).toBe(screen.getByTestId("item-2"));
    expect(screen.getByTestId("focused").textContent).toBe("2");
  });

  it("wraps around at boundaries when loop is true", () => {
    render(<RovingList orientation="vertical" loop={true} />);

    const first = screen.getByTestId("item-0");
    first.focus();

    // Navigate to last
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByTestId("item-1"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("item-2"));

    // ArrowDown on last should wrap to first
    fireEvent.keyDown(screen.getByTestId("item-2"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(screen.getByTestId("item-0"));
    expect(screen.getByTestId("focused").textContent).toBe("0");
  });

  it("does not wrap at boundaries when loop is false", () => {
    render(<RovingList orientation="vertical" loop={false} />);

    const first = screen.getByTestId("item-0");
    first.focus();

    // Navigate to last
    fireEvent.keyDown(first, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByTestId("item-1"), { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByTestId("item-2"));

    // ArrowDown on last should stay on last
    fireEvent.keyDown(screen.getByTestId("item-2"), { key: "ArrowDown" });

    expect(document.activeElement).toBe(screen.getByTestId("item-2"));
    expect(screen.getByTestId("focused").textContent).toBe("2");
  });

  /**
   * `setFocusedIndex` is the entry point a value-driven widget uses instead of
   * the key handler above (Rating, ThemeSwitcher). Both directions matter: it
   * has to carry DOM focus with the tab stop, and it must not pull focus into
   * the group from outside it.
   */
  describe("setFocusedIndex", () => {
    it("carries DOM focus with the tab stop when the group already has focus", () => {
      render(<RovingList />);

      screen.getByTestId("item-0").focus();
      // `fireEvent.click` does not move focus in jsdom, so focus is still on
      // item-0 when the handler calls `setFocusedIndex(2)`.
      fireEvent.click(screen.getByTestId("outside"));

      expect(document.activeElement).toBe(screen.getByTestId("item-2"));
      expect(screen.getByTestId("item-2")).toHaveAttribute("tabindex", "0");
    });

    it("does not steal focus when the group does not hold it", () => {
      render(<RovingList />);

      const outside = screen.getByTestId("outside");
      outside.focus();
      fireEvent.click(outside);

      // Tab stop moved; focus did not. Moving it would drag a user out of
      // whatever they were doing elsewhere on the page.
      expect(screen.getByTestId("item-2")).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(outside);
    });
  });
});
