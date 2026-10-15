import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Input } from "./Input";

describe("Input", () => {
  it("is uncontrolled by default and forwards ref and props to the <input>", async () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} aria-label="Name" name="name" placeholder="Ada" defaultValue="A" />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute("placeholder", "Ada");
    await userEvent.type(input, "da");
    expect(input).toHaveValue("Ada");
  });

  it("is controlled with value + onChange", async () => {
    const onChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <Input
          aria-label="Name"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setValue(e.target.value.toUpperCase());
          }}
        />
      );
    }
    render(<Harness />);
    await userEvent.type(screen.getByRole("textbox"), "ab");
    expect(screen.getByRole("textbox")).toHaveValue("AB");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("puts className on the frame and classNames.input on the <input>", () => {
    render(<Input aria-label="X" className="w-1/2" classNames={{ input: "text-end" }} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("text-end");
    expect(input).not.toHaveClass("w-1/2");
    expect(input.parentElement).toHaveClass("w-1/2", "h-control");
  });

  it("renders start and end adornments around the input", () => {
    render(<Input aria-label="Latency" start={<span>≈</span>} end={<span>ms</span>} />);
    const input = screen.getByRole("textbox");
    expect(input.previousElementSibling).toHaveTextContent("≈");
    expect(input.nextElementSibling).toHaveTextContent("ms");
  });

  it("focuses the input on a press of the frame or a decorative adornment, not of an interactive one", () => {
    const onClick = vi.fn();
    render(
      // A focusable ancestor (a skip-link target <main tabindex=-1>) is outside the frame.
      <main tabIndex={-1}>
        <Input
          aria-label="Q"
          start={<span data-testid="icon">i</span>}
          end={
            <button type="button" onClick={onClick}>
              go
            </button>
          }
        />
      </main>,
    );
    const input = screen.getByRole("textbox");
    const frame = input.parentElement as HTMLElement;
    expect(fireEvent.mouseDown(frame)).toBe(false); // default prevented: no blur-then-refocus flicker
    expect(input).toHaveFocus();
    input.blur();
    fireEvent.mouseDown(screen.getByTestId("icon"));
    expect(input).toHaveFocus();
    input.blur();
    expect(fireEvent.mouseDown(screen.getByRole("button", { name: "go" }))).toBe(true);
    expect(input).not.toHaveFocus();
  });

  it("reports invalid, disabled and read-only on the input and as frame state", async () => {
    render(
      <>
        <Input aria-label="Bad" invalid />
        <Input aria-label="Off" disabled />
        <Input aria-label="Fixed" readOnly defaultValue="v" />
      </>,
    );
    const bad = screen.getByRole("textbox", { name: "Bad" });
    expect(bad).toHaveAttribute("aria-invalid", "true");
    expect(bad.parentElement).toHaveAttribute("data-invalid");

    const off = screen.getByRole("textbox", { name: "Off" });
    expect(off).toBeDisabled();
    expect(off.parentElement).toHaveAttribute("data-disabled");
    fireEvent.mouseDown(off.parentElement as HTMLElement);
    expect(off).not.toHaveFocus();

    const fixed = screen.getByRole("textbox", { name: "Fixed" });
    await userEvent.type(fixed, "x");
    expect(fixed).toHaveValue("v");
    expect(fixed.parentElement).toHaveAttribute("data-readonly");
  });

  it("keeps a caller's aria-invalid where the component has no opinion", () => {
    render(<Input aria-label="X" aria-invalid="grammar" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "grammar");
  });
});
