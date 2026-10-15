import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Field } from "./Field";
import { Textarea } from "./Textarea";

// jsdom has no layout: scrollHeight is always 0. Each test that needs content
// height stubs it to grow with the text, which is what a browser reports.
function stubScrollHeight(perLine: number) {
  return vi
    .spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get")
    .mockImplementation(function (this: HTMLTextAreaElement) {
      return this.value.split("\n").length * perLine;
    });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Textarea", () => {
  it("is a labelled multi-line textbox wired by its Field", () => {
    render(
      <Field required>
        <Field.Label>Notes</Field.Label>
        <Textarea />
        <Field.Error>Too short</Field.Error>
      </Field>,
    );
    const textarea = screen.getByRole("textbox", { name: "Notes" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Too short");
    expect(textarea).toHaveAttribute("rows", "3");
  });

  it("does not size itself without autosize", async () => {
    stubScrollHeight(20);
    render(<Textarea aria-label="Plain" />);
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "a{Enter}b");
    expect(textarea.style.height).toBe("");
    expect(textarea).toHaveClass("resize-y");
  });

  it("grows with uncontrolled typing when autosize is on", async () => {
    stubScrollHeight(20);
    render(<Textarea aria-label="Grow" autosize />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.style.height).toBe("20px");
    await userEvent.type(textarea, "a{Enter}b{Enter}c");
    expect(textarea.style.height).toBe("60px");
    expect(textarea).toHaveClass("resize-none");
  });

  it("follows a controlled value that changes without an input event", () => {
    stubScrollHeight(20);
    const { rerender } = render(<Textarea aria-label="Ctl" autosize value="one" onChange={() => {}} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea.style.height).toBe("20px");
    rerender(<Textarea aria-label="Ctl" autosize value={"one\ntwo\nthree\nfour"} onChange={() => {}} />);
    expect(textarea.style.height).toBe("80px");
  });

  it("caps at maxRows and scrolls past it", async () => {
    stubScrollHeight(20);
    render(
      <Textarea
        aria-label="Cap"
        autosize
        maxRows={2}
        style={{ lineHeight: "20px", paddingTop: "4px", paddingBottom: "4px" }}
      />,
    );
    const textarea = screen.getByRole("textbox");
    await userEvent.type(textarea, "a");
    expect(textarea.style.overflowY).toBe("hidden");
    await userEvent.type(textarea, "{Enter}b{Enter}c{Enter}d");
    // 2 rows × 20 + 8 padding (+ 0 border in jsdom)
    expect(textarea.style.height).toBe("48px");
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("calls a caller's onChange exactly once per edit", async () => {
    const onChange = vi.fn();
    render(<Textarea aria-label="X" autosize onChange={onChange} />);
    await userEvent.type(screen.getByRole("textbox"), "ab");
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
