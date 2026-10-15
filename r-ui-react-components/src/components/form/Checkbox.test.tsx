import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Checkbox } from "./Checkbox";
import { Field } from "./Field";

describe("Checkbox", () => {
  it("toggles from a click on its label and reports each change once", async () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox onCheckedChange={onCheckedChange}>Email me</Checkbox>);
    const box = screen.getByRole("checkbox", { name: "Email me" });
    expect(box).not.toBeChecked();

    await userEvent.click(screen.getByText("Email me"));
    expect(box).toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenLastCalledWith(true);

    await userEvent.click(box);
    expect(box).not.toBeChecked();
    expect(onCheckedChange).toHaveBeenCalledTimes(2);
    expect(onCheckedChange).toHaveBeenLastCalledWith(false);
  });

  it("toggles with Space", async () => {
    render(<Checkbox defaultChecked>Keep</Checkbox>);
    const box = screen.getByRole("checkbox");
    expect(box).toBeChecked();
    box.focus();
    await userEvent.keyboard(" ");
    expect(box).not.toBeChecked();
  });

  it("is controlled: it only changes when the parent says so", async () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={onCheckedChange}>
        Fixed
      </Checkbox>,
    );
    const box = screen.getByRole("checkbox");
    await userEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(box).not.toBeChecked();
    rerender(
      <Checkbox checked onCheckedChange={onCheckedChange}>
        Fixed
      </Checkbox>,
    );
    expect(box).toBeChecked();
  });

  it("shows indeterminate as mixed and keeps it while the prop says so", async () => {
    function Harness() {
      const [all, setAll] = useState<boolean | "some">("some");
      return (
        <Checkbox
          checked={all === true}
          indeterminate={all === "some"}
          onCheckedChange={(next) => setAll(next)}
        >
          Select all
        </Checkbox>
      );
    }
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Select all" });
    expect(box).toBePartiallyChecked();

    await userEvent.click(box);
    expect(box).not.toBePartiallyChecked();
    expect(box).toBeChecked();
  });

  it("re-applies indeterminate after a click when the caller keeps it", async () => {
    render(<Checkbox indeterminate>Some</Checkbox>);
    const box = screen.getByRole("checkbox");
    await userEvent.click(box);
    expect(box).toBePartiallyChecked();
  });

  it("is named by aria-label when it has no visible label", () => {
    render(<Checkbox aria-label="Select row 3" />);
    expect(screen.getByRole("checkbox", { name: "Select row 3" })).toBeInTheDocument();
  });

  it("does not toggle when disabled or read-only; read-only says so", async () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Checkbox disabled onCheckedChange={onCheckedChange}>
          Off
        </Checkbox>
        <Checkbox readOnly defaultChecked onCheckedChange={onCheckedChange}>
          Locked
        </Checkbox>
      </>,
    );
    await userEvent.click(screen.getByText("Off"));
    await userEvent.click(screen.getByText("Locked"));
    expect(screen.getByRole("checkbox", { name: "Off" })).not.toBeChecked();
    const locked = screen.getByRole("checkbox", { name: "Locked" });
    expect(locked).toBeChecked();
    expect(locked).toHaveAttribute("aria-readonly", "true");
    expect(onCheckedChange).toHaveBeenCalledTimes(0);
  });

  it("submits its name and value only when checked", async () => {
    const { container } = render(
      <form>
        <Checkbox name="tos" value="yes">
          Agree
        </Checkbox>
      </form>,
    );
    const form = container.querySelector("form") as HTMLFormElement;
    expect(new FormData(form).has("tos")).toBe(false);
    await userEvent.click(screen.getByRole("checkbox"));
    expect(new FormData(form).get("tos")).toBe("yes");
  });

  it("takes invalid and description from a Field; ref reaches the input", () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <Field>
        <Checkbox ref={ref}>I accept the terms</Checkbox>
        <Field.Error>You must accept to continue</Field.Error>
      </Field>,
    );
    const box = screen.getByRole("checkbox", { name: "I accept the terms" });
    expect(ref.current).toBe(box);
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("You must accept to continue");
  });

  it("puts className on the label root and classNames on its parts", () => {
    render(
      <Checkbox className="caller" classNames={{ label: "lbl", box: "bx" }}>
        Text
      </Checkbox>,
    );
    const box = screen.getByRole("checkbox");
    expect(box.closest("label")).toHaveClass("r-form-check", "caller");
    expect(box.parentElement).toHaveClass("r-form-check-box", "bx");
    expect(screen.getByText("Text")).toHaveClass("lbl");
  });

  it("gives the box a hit area only when there is no visible label to press", () => {
    render(
      <>
        <Checkbox>Labelled</Checkbox>
        <Checkbox aria-label="Select row" />
      </>,
    );
    // A labelled row is its own target, padded to the floor in CSS.
    expect(screen.getByRole("checkbox", { name: "Labelled" }).parentElement).not.toHaveClass("hit-area");
    expect(screen.getByRole("checkbox", { name: "Select row" }).parentElement).toHaveClass("r-form-check-box", "hit-area");
  });
});
