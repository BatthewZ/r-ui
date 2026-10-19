import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useRef } from "react";
import { describe, expect, it } from "vitest";

import { useRovingFocus, useRovingFocusWithin, type UseRovingFocusWithinOptions } from "./use-roving-focus";

function RovingList({
  orientation = "vertical",
  loop = true,
  labels = ["A", "B", "C"],
  disabled = [],
}: {
  orientation?: "horizontal" | "vertical";
  loop?: boolean;
  labels?: string[];
  disabled?: number[];
}) {
  const { getRovingProps, focusedIndex, setFocusedIndex } = useRovingFocus({
    orientation,
    loop,
  });
  return (
    <div>
      {labels.map((label, i) => {
        const props = getRovingProps(i);
        return (
          <button key={label} data-testid={`item-${i}`} disabled={disabled.includes(i)} {...props}>
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

  describe("right to left", () => {
    it("mirrors the horizontal arrows: ArrowLeft is next, ArrowRight is previous", () => {
      render(
        <div style={{ direction: "rtl" }}>
          <RovingList orientation="horizontal" />
        </div>,
      );
      const first = screen.getByTestId("item-0");
      first.focus();

      fireEvent.keyDown(first, { key: "ArrowLeft" });
      expect(document.activeElement).toBe(screen.getByTestId("item-1"));

      fireEvent.keyDown(screen.getByTestId("item-1"), { key: "ArrowRight" });
      expect(document.activeElement).toBe(first);
    });

    it("leaves a vertical group's arrows alone", () => {
      render(
        <div style={{ direction: "rtl" }}>
          <RovingList orientation="vertical" />
        </div>,
      );
      const first = screen.getByTestId("item-0");
      first.focus();

      fireEvent.keyDown(first, { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByTestId("item-1"));
      // ArrowLeft is not a vertical group's key in either direction.
      fireEvent.keyDown(screen.getByTestId("item-1"), { key: "ArrowLeft" });
      expect(document.activeElement).toBe(screen.getByTestId("item-1"));
    });
  });

  describe("disabled items", () => {
    const labels = ["A", "B", "C", "D"];

    it("arrows pass over a natively disabled item, both ways", () => {
      render(<RovingList labels={labels} disabled={[1]} />);
      const first = screen.getByTestId("item-0");
      first.focus();

      fireEvent.keyDown(first, { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByTestId("item-2"));
      expect(screen.getByTestId("focused").textContent).toBe("2");

      fireEvent.keyDown(screen.getByTestId("item-2"), { key: "ArrowUp" });
      expect(document.activeElement).toBe(first);
    });

    it("wraps past a disabled item at the end, and stays put without loop", () => {
      const { unmount } = render(<RovingList labels={labels} disabled={[3]} />);
      screen.getByTestId("item-2").focus();
      fireEvent.click(screen.getByTestId("outside"));
      fireEvent.keyDown(screen.getByTestId("item-2"), { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByTestId("item-0"));
      unmount();

      render(<RovingList labels={labels} disabled={[3]} loop={false} />);
      screen.getByTestId("item-2").focus();
      fireEvent.click(screen.getByTestId("outside"));
      fireEvent.keyDown(screen.getByTestId("item-2"), { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByTestId("item-2"));
      expect(screen.getByTestId("focused").textContent).toBe("2");
    });

    it("Home and End land on the first and last enabled items", () => {
      render(<RovingList labels={labels} disabled={[0, 3]} />);
      const second = screen.getByTestId("item-1");
      second.focus();

      fireEvent.keyDown(second, { key: "End" });
      expect(document.activeElement).toBe(screen.getByTestId("item-2"));

      fireEvent.keyDown(screen.getByTestId("item-2"), { key: "Home" });
      expect(document.activeElement).toBe(second);
    });

    it("keeps an aria-disabled item in the walk: it can take focus", () => {
      function AriaDisabled() {
        const { getRovingProps } = useRovingFocus({ orientation: "vertical" });
        return (
          <div>
            {["A", "B", "C"].map((label, i) => (
              <button key={label} data-testid={`aria-${i}`} aria-disabled={i === 1 || undefined} {...getRovingProps(i)}>
                {label}
              </button>
            ))}
          </div>
        );
      }
      render(<AriaDisabled />);
      const first = screen.getByTestId("aria-0");
      first.focus();
      fireEvent.keyDown(first, { key: "ArrowDown" });
      expect(document.activeElement).toBe(screen.getByTestId("aria-1"));
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
   * `setFocusedIndex` is the entry point a value-driven widget (a radiogroup)
   * uses instead of the key handler above. Both directions matter: it
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

function Within({
  children,
  ...options
}: Partial<UseRovingFocusWithinOptions> & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onKeyDown } = useRovingFocusWithin(ref, { orientation: "horizontal", ...options });
  return (
    <div ref={ref} data-testid="group" onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}

const stops = () => [...screen.getByTestId("group").querySelectorAll<HTMLElement>("[tabindex='0']")].map((el) => el.dataset.testid);
const press = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key });

describe("useRovingFocusWithin", () => {
  it("leaves one tab stop among whatever focusable elements the group holds", () => {
    render(
      <Within>
        <button data-testid="a">A</button>
        <span>
          <input data-testid="b" aria-label="B" />
        </span>
        <select data-testid="c" aria-label="C" />
        <a href="#d" data-testid="d">
          D
        </a>
      </Within>,
    );
    expect(stops()).toEqual(["a"]);
    for (const id of ["b", "c", "d"]) expect(screen.getByTestId(id)).toHaveAttribute("tabindex", "-1");
  });

  it("moves with the arrows, Home and End, wrapping, and mirrors the arrows right to left", () => {
    const { unmount } = render(
      <Within>
        <button data-testid="a">A</button>
        <button data-testid="b">B</button>
        <button data-testid="c">C</button>
      </Within>,
    );
    screen.getByTestId("a").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("b"));
    expect(stops()).toEqual(["b"]);
    press("End");
    expect(document.activeElement).toBe(screen.getByTestId("c"));
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("a"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(screen.getByTestId("c"));
    press("Home");
    expect(document.activeElement).toBe(screen.getByTestId("a"));
    unmount();

    render(
      <div style={{ direction: "rtl" }}>
        <Within>
          <button data-testid="a">A</button>
          <button data-testid="b">B</button>
          <button data-testid="c">C</button>
        </Within>
      </div>,
    );
    // Three items: with two, "next" and "previous" (wrapping) land on the same one.
    screen.getByTestId("a").focus();
    press("ArrowLeft");
    expect(document.activeElement).toBe(screen.getByTestId("b"));
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("a"));
  });

  it("uses Up and Down in a vertical group, and stays at an end without loop", () => {
    render(
      <Within orientation="vertical" loop={false}>
        <button data-testid="a">A</button>
        <button data-testid="b">B</button>
      </Within>,
    );
    screen.getByTestId("a").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("a"));
    press("ArrowDown");
    expect(document.activeElement).toBe(screen.getByTestId("b"));
    const atEnd = press("ArrowDown");
    expect(document.activeElement).toBe(screen.getByTestId("b"));
    // Still the group's key: it must not scroll the page.
    expect(atEnd).toBe(false);
  });

  it("passes over natively disabled controls and keeps aria-disabled ones in the walk", () => {
    render(
      <Within>
        <button data-testid="a">A</button>
        <button data-testid="b" disabled>
          B
        </button>
        <button data-testid="c" aria-disabled>
          C
        </button>
      </Within>,
    );
    screen.getByTestId("a").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("c"));
  });

  it("wraps past a disabled control at the start to the last one", () => {
    render(
      <Within>
        <button data-testid="undo" disabled>
          Undo
        </button>
        <button data-testid="redo" aria-disabled>
          Redo
        </button>
        <button data-testid="save">Save</button>
      </Within>,
    );
    screen.getByTestId("redo").focus();
    press("ArrowLeft");
    expect(document.activeElement).toBe(screen.getByTestId("save"));
  });

  it("a text input keeps its caret: arrows leave it only from the edge they point past", () => {
    render(
      <Within>
        <button data-testid="a">A</button>
        <input data-testid="find" aria-label="Find" defaultValue="hello" />
        <button data-testid="c">C</button>
      </Within>,
    );
    const input = screen.getByTestId("find") as HTMLInputElement;
    input.focus();
    input.setSelectionRange(2, 2);
    expect(press("ArrowRight")).toBe(true);
    expect(press("ArrowLeft")).toBe(true);
    expect(press("Home")).toBe(true);
    expect(press("End")).toBe(true);
    expect(document.activeElement).toBe(input);

    // A selection is the input's too, even when it touches the end.
    input.setSelectionRange(3, 5);
    press("ArrowRight");
    expect(document.activeElement).toBe(input);

    input.setSelectionRange(5, 5);
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("c"));

    input.focus();
    input.setSelectionRange(0, 0);
    press("ArrowLeft");
    expect(document.activeElement).toBe(screen.getByTestId("a"));
  });

  it("a select keeps Up, Down, Home and End; Left and Right move on", () => {
    render(
      <Within>
        <select data-testid="font" aria-label="Font">
          <option>Serif</option>
          <option>Sans</option>
        </select>
        <button data-testid="b">B</button>
      </Within>,
    );
    const select = screen.getByTestId("font");
    select.focus();
    expect(press("ArrowDown")).toBe(true);
    expect(press("End")).toBe(true);
    expect(document.activeElement).toBe(select);
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("b"));
  });

  it("ignores a key a part already handled, and keys from a popup opened inside the group", () => {
    render(
      <Within>
        <button data-testid="a" onKeyDown={(e) => e.key === "ArrowRight" && e.preventDefault()}>
          A
        </button>
        <button data-testid="b">B</button>
        <div role="menu">
          <div role="menuitem" tabIndex={-1} data-testid="item">
            Item
          </div>
        </div>
      </Within>,
    );
    screen.getByTestId("a").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("a"));

    // The menu item is not one of the group's stops, and its keys are the menu's.
    expect(screen.getByTestId("item")).toHaveAttribute("tabindex", "-1");
    screen.getByTestId("item").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("item"));
  });

  it("returns Tab to the control that last had focus, and moves the stop off one that becomes disabled", async () => {
    function Harness({ disableB }: { disableB: boolean }) {
      return (
        <>
          <Within>
            <button data-testid="a">A</button>
            <button data-testid="b" disabled={disableB}>
              B
            </button>
          </Within>
          <button data-testid="outside">Outside</button>
        </>
      );
    }
    const { rerender } = render(<Harness disableB={false} />);
    screen.getByTestId("a").focus();
    press("ArrowRight");
    screen.getByTestId("outside").focus();
    expect(stops()).toEqual(["b"]);

    rerender(<Harness disableB />);
    await waitFor(() => expect(stops()).toEqual(["a"]));
  });

  it("a preferred stop takes the stop back when focus leaves", () => {
    render(
      <>
        <Within preferredStop={(items) => items.find((el) => el.getAttribute("aria-checked") === "true")}>
          <button role="radio" aria-checked={false} data-testid="a">
            A
          </button>
          <button role="radio" aria-checked data-testid="b">
            B
          </button>
        </Within>
        <button data-testid="outside">Outside</button>
      </>,
    );
    expect(stops()).toEqual(["b"]);
    screen.getByTestId("b").focus();
    press("ArrowLeft");
    expect(stops()).toEqual(["a"]);
    screen.getByTestId("outside").focus();
    expect(stops()).toEqual(["b"]);
  });

  it("reports each move to onNavigate, once", () => {
    const moved: string[] = [];
    render(
      <Within onNavigate={(el) => moved.push(el.dataset.testid ?? "")}>
        <button data-testid="a">A</button>
        <button data-testid="b">B</button>
      </Within>,
    );
    screen.getByTestId("a").focus();
    press("ArrowRight");
    press("Enter");
    expect(moved).toEqual(["b"]);
  });

  it("disabled, it touches neither tab stops nor keys (a nested group whose parent owns them)", () => {
    render(
      <Within enabled={false}>
        <button data-testid="a">A</button>
        <button data-testid="b">B</button>
      </Within>,
    );
    expect(screen.getByTestId("b")).not.toHaveAttribute("tabindex");
    screen.getByTestId("a").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(screen.getByTestId("a"));
  });
});
