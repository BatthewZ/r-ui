import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Field } from "./Field";
import { Rating } from "./Rating";
import { Form, useForm } from "./use-form";

const items = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".r-form-rating-item")];
const fills = (container: HTMLElement) => items(container).map((i) => i.dataset.fill);

/** jsdom lays nothing out: each icon cell is 20px wide, side by side from x = 0. */
function layOut(container: HTMLElement) {
  items(container).forEach((item, index) => {
    const left = index * 20;
    item.getBoundingClientRect = () => ({ left, top: 0, right: left + 20, bottom: 20, width: 20, height: 20, x: left, y: 0, toJSON: () => ({}) });
  });
  return items(container);
}

describe("Rating", () => {
  it("is one slider: a single tab stop whose value text says the rating", async () => {
    const user = userEvent.setup();
    render(<Rating aria-label="Your rating" defaultValue={3} />);
    const rating = screen.getByRole("slider", { name: "Your rating" });
    expect(rating).toHaveAttribute("aria-valuetext", "3 out of 5");
    expect(rating).toHaveAttribute("aria-valuenow", "3");
    expect(rating).toHaveAttribute("aria-valuemin", "0");
    expect(rating).toHaveAttribute("aria-valuemax", "5");
    await user.tab();
    expect(rating).toHaveFocus();
    await user.tab();
    expect(rating).not.toHaveFocus();
  });

  it("steps by keys, mirrored in RTL; digits jump; it never clears unless clearable", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <div style={{ direction: "rtl" }}>
        <Rating aria-label="Stay" defaultValue={2} onValueChange={onValueChange} />
      </div>,
    );
    const rating = screen.getByRole("slider", { name: "Stay" });
    rating.focus();
    await user.keyboard("{ArrowLeft}");
    expect(rating).toHaveAttribute("aria-valuenow", "3");
    await user.keyboard("{ArrowRight}{ArrowDown}{ArrowDown}{Home}");
    expect(rating).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{Delete}{Backspace}0");
    expect(rating).toHaveAttribute("aria-valuenow", "1");
    await user.keyboard("{End}");
    expect(fills(container)).toEqual(["full", "full", "full", "full", "full"]);
    await user.keyboard("4{PageDown}9");
    expect(rating).toHaveAttribute("aria-valuetext", "3 out of 5");
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([3, 2, 1, 5, 4, 3]);
  });

  it("clearable: Delete, Home or pressing the current value clears to no rating", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<Rating aria-label="Stay" defaultValue={4} clearable onValueChange={onValueChange} />);
    const rating = screen.getByRole("slider", { name: "Stay" });
    rating.focus();
    await user.keyboard("{Delete}");
    expect(rating).toHaveAttribute("aria-valuetext", "No rating");
    expect(rating).toHaveAttribute("aria-valuenow", "0");
    expect(fills(container)).toEqual(["empty", "empty", "empty", "empty", "empty"]);
    await user.keyboard("{ArrowRight}{ArrowRight}{Home}");
    expect(rating).toHaveAttribute("aria-valuetext", "No rating");
    await user.click(items(container)[1] as HTMLElement);
    expect(rating).toHaveAttribute("aria-valuenow", "2");
    await user.click(items(container)[1] as HTMLElement);
    expect(rating).toHaveAttribute("aria-valuetext", "No rating");
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([null, 1, 2, null, 2, null]);
  });

  it("half steps: keys move by a half, and a press on an icon's start half picks the half", async () => {
    const user = userEvent.setup();
    const { container } = render(<Rating aria-label="Stay" allowHalf defaultValue={2} />);
    const rating = screen.getByRole("slider", { name: "Stay" });
    rating.focus();
    await user.keyboard("{ArrowRight}");
    expect(rating).toHaveAttribute("aria-valuetext", "2.5 out of 5");
    expect(fills(container)).toEqual(["full", "full", "part", "empty", "empty"]);
    const cells = layOut(container);
    fireEvent.click(cells[3] as HTMLElement, { clientX: 64 });
    expect(rating).toHaveAttribute("aria-valuenow", "3.5");
    fireEvent.click(cells[3] as HTMLElement, { clientX: 76 });
    expect(rating).toHaveAttribute("aria-valuenow", "4");
    await user.keyboard("{End}{ArrowLeft}");
    expect(rating).toHaveAttribute("aria-valuetext", "4.5 out of 5");
  });

  it("previews under a hovering mouse, and drops the preview when it leaves", () => {
    const { container } = render(<Rating aria-label="Stay" defaultValue={1} />);
    const cells = layOut(container);
    fireEvent.pointerMove(cells[3] as HTMLElement, { pointerType: "mouse", clientX: 70 });
    expect(fills(container)).toEqual(["full", "full", "full", "full", "empty"]);
    // Only the value is announced; the preview is the pointer's.
    expect(screen.getByRole("slider", { name: "Stay" })).toHaveAttribute("aria-valuenow", "1");
    fireEvent.pointerLeave(screen.getByRole("slider", { name: "Stay" }));
    expect(fills(container)).toEqual(["full", "empty", "empty", "empty", "empty"]);
  });

  it("read-only is a display: an image named by its value, at any fraction, out of the tab order", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <>
        <Rating readOnly value={4.3} />
        <Rating readOnly value={null} max={3} />
        <button type="button">after</button>
      </>,
    );
    const display = screen.getByRole("img", { name: "4.3 out of 5" });
    expect(display).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("img", { name: "No rating" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(fills(container).slice(0, 5)).toEqual(["full", "full", "full", "full", "part"]);
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
  });

  it("speaks its value in the labels given, by the provider or the instance", () => {
    render(
      <LocaleProvider labels={{ Rating: { value: (v, max) => `${v} von ${max} Sternen`, none: "Keine Bewertung" } }}>
        <Rating aria-label="Hotel" defaultValue={4} />
        <Rating readOnly value={2} labels={{ value: (v, max) => `${v}/${max}` }} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("slider", { name: "Hotel" })).toHaveAttribute("aria-valuetext", "4 von 5 Sternen");
    expect(screen.getByRole("img", { name: "2/5" })).toBeInTheDocument();
  });

  it("draws a custom icon twice per step (outline and fill)", () => {
    const { container } = render(<Rating aria-label="Love" max={3} defaultValue={1} icon={<svg data-heart="" />} />);
    expect(container.querySelectorAll("[data-heart]")).toHaveLength(6);
  });

  it("fills in the rating colour, not the accent, and a caller's text colour replaces it", () => {
    render(
      <>
        <Rating aria-label="Plain" defaultValue={2} />
        <Rating readOnly aria-label="Shown" value={4} />
        <Rating aria-label="Tinted" defaultValue={2} className="text-series-2 text-body-2" />
      </>,
    );
    expect(screen.getByRole("slider", { name: "Plain" })).toHaveClass("text-rating");
    expect(screen.getByRole("img", { name: "Shown" })).toHaveClass("text-rating");
    const tinted = screen.getByRole("slider", { name: "Tinted" });
    expect(tinted).toHaveClass("text-series-2", "text-body-2");
    expect(tinted).not.toHaveClass("text-rating");
  });

  it("disabled: out of the tab order and deaf to keys and presses", () => {
    const onValueChange = vi.fn();
    const { container } = render(<Rating aria-label="Stay" defaultValue={2} disabled onValueChange={onValueChange} />);
    const rating = screen.getByRole("slider", { name: "Stay" });
    expect(rating).toHaveAttribute("aria-disabled", "true");
    expect(rating).not.toHaveAttribute("tabindex");
    fireEvent.keyDown(rating, { key: "ArrowRight" });
    fireEvent.click(items(container)[4] as HTMLElement);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("binds to a Form through its Field: named, invalid when the form says so, submitted", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    function Review() {
      const form = useForm<{ stars: number | null }>({ defaultValues: { stars: null }, onSubmit });
      return (
        <Form form={form}>
          <Field name="stars" validate={(value) => (value === null ? "Pick a rating." : undefined)}>
            <Field.Label>Overall</Field.Label>
            <Rating />
            <Field.Error />
          </Field>
          <button type="submit">Post review</button>
        </Form>
      );
    }
    const { container } = render(<Review />);
    const rating = screen.getByRole("slider", { name: "Overall" });
    expect(container.querySelector<HTMLInputElement>('input[type=hidden][name="stars"]')?.value).toBe("");
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await waitFor(() => expect(rating).toHaveAttribute("aria-invalid", "true"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(rating).toHaveAccessibleDescription("Pick a rating.");
    expect(rating).toHaveFocus();
    await user.keyboard("4");
    await user.click(screen.getByRole("button", { name: "Post review" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ stars: 4 });
  });
});
