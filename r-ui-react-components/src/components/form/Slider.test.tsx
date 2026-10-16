import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Field } from "./Field";
import { Slider } from "./Slider";
import { Form, useForm } from "./use-form";

/** jsdom lays nothing out: give the rail a 200px-wide box at the page's left edge. */
function layOut(container: HTMLElement, { width = 200, height = 20 } = {}) {
  const rail = container.querySelector<HTMLElement>(".r-form-slider-rail");
  if (!rail) throw new Error("no rail");
  rail.getBoundingClientRect = () => ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) });
  const control = container.querySelector<HTMLElement>(".r-form-slider-control");
  if (!control) throw new Error("no control");
  return control;
}

const press = (control: HTMLElement, clientX: number, clientY = 10) =>
  fireEvent.pointerDown(control, { button: 0, pointerId: 1, clientX, clientY });
const drag = (control: HTMLElement, clientX: number, clientY = 10) => fireEvent.pointerMove(control, { pointerId: 1, clientX, clientY });
const release = (control: HTMLElement) => fireEvent.pointerUp(control, { pointerId: 1 });

describe("Slider", () => {
  it("is a Field control: named by the label, described, spoken in its format, submitted by name", () => {
    const { container } = render(
      <form aria-label="alerts">
        <Field>
          <Field.Label>Alert threshold</Field.Label>
          <Slider name="threshold" defaultValue={70} formatOptions={{ style: "unit", unit: "percent" }} locale="en-US" />
          <Field.Description>Pages on-call above this.</Field.Description>
        </Field>
      </form>,
    );
    const slider = screen.getByRole("slider", { name: "Alert threshold" });
    expect(slider).toHaveAttribute("aria-valuenow", "70");
    expect(slider).toHaveAttribute("aria-valuetext", "70%");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
    expect(slider).toHaveAccessibleDescription("Pages on-call above this.");
    expect(new FormData(container.querySelector("form") as HTMLFormElement).get("threshold")).toBe("70");
  });

  it("formats the value in the provider's locale, and a formatter wins", () => {
    render(
      <LocaleProvider locale="de-DE">
        <Slider aria-label="Budget" min={0} max={5000} step={0.5} defaultValue={1234.5} />
        <Slider aria-label="Rate" defaultValue={12} formatValue={(v) => `${v} requests a second`} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("slider", { name: "Budget" })).toHaveAttribute("aria-valuetext", "1.234,5");
    expect(screen.getByRole("slider", { name: "Rate" })).toHaveAttribute("aria-valuetext", "12 requests a second");
  });

  it("steps by keys: arrows, Shift and Page for the large step, Home and End", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Slider aria-label="Volume" defaultValue={50} onValueChange={onValueChange} />);
    const slider = screen.getByRole("slider", { name: "Volume" });
    await user.tab();
    expect(slider).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowUp}");
    expect(slider).toHaveAttribute("aria-valuenow", "52");
    await user.keyboard("{ArrowLeft}{ArrowDown}");
    expect(slider).toHaveAttribute("aria-valuenow", "50");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(slider).toHaveAttribute("aria-valuenow", "60");
    await user.keyboard("{PageDown}{PageDown}");
    expect(slider).toHaveAttribute("aria-valuenow", "40");
    await user.keyboard("{End}");
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    await user.keyboard("{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    await user.keyboard("{Home}");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
    // One call per change; the press at the bound changed nothing.
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([51, 52, 51, 50, 60, 50, 40, 100, 0]);
  });

  it("mirrors left and right in RTL", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ direction: "rtl" }}>
        <Slider aria-label="Volume" defaultValue={50} />
      </div>,
    );
    const slider = screen.getByRole("slider", { name: "Volume" });
    slider.focus();
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowRight}");
    expect(slider).toHaveAttribute("aria-valuenow", "51");
  });

  it("commits once per key gesture, on key up, and not for a press that changed nothing", async () => {
    const user = userEvent.setup();
    const onValueCommit = vi.fn();
    const onValueChange = vi.fn();
    render(<Slider aria-label="Volume" defaultValue={95} onValueChange={onValueChange} onValueCommit={onValueCommit} />);
    screen.getByRole("slider", { name: "Volume" }).focus();
    // Held: three repeats, one release.
    await user.keyboard("{ArrowRight>3}");
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueCommit).not.toHaveBeenCalled();
    await user.keyboard("{/ArrowRight}");
    expect(onValueCommit).toHaveBeenCalledExactlyOnceWith(98);
    await user.keyboard("{End}");
    expect(onValueCommit).toHaveBeenCalledTimes(2);
    expect(onValueCommit).toHaveBeenLastCalledWith(100);
    await user.keyboard("{End}{ArrowRight}");
    expect(onValueCommit).toHaveBeenCalledTimes(2);
  });

  it("drags with the pointer: the press moves the value, moves follow, the release commits once", () => {
    const onValueCommit = vi.fn();
    const onValueChange = vi.fn();
    const { container } = render(<Slider aria-label="Volume" defaultValue={10} onValueChange={onValueChange} onValueCommit={onValueCommit} />);
    const control = layOut(container);
    const slider = screen.getByRole("slider", { name: "Volume" });
    press(control, 50);
    expect(slider).toHaveAttribute("aria-valuenow", "25");
    // The press hands focus to the thumb, so keys continue from here.
    expect(slider).toHaveFocus();
    expect(slider).toHaveAttribute("data-dragging");
    drag(control, 120);
    drag(control, 400);
    expect(slider).toHaveAttribute("aria-valuenow", "100");
    expect(onValueCommit).not.toHaveBeenCalled();
    release(control);
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([25, 60, 100]);
    expect(onValueCommit).toHaveBeenCalledExactlyOnceWith(100);
    expect(slider).not.toHaveAttribute("data-dragging");
    // A move after the release is not a drag.
    drag(control, 0);
    expect(slider).toHaveAttribute("aria-valuenow", "100");
  });

  it("runs bottom (min) to top when vertical", () => {
    const { container } = render(<Slider aria-label="Level" orientation="vertical" />);
    const control = layOut(container, { width: 20, height: 200 });
    press(control, 10, 50);
    release(control);
    const slider = screen.getByRole("slider", { name: "Level" });
    expect(slider).toHaveAttribute("aria-orientation", "vertical");
    expect(slider).toHaveAttribute("aria-valuenow", "75");
  });

  it("disabled: out of the tab order, deaf to keys and presses", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <>
        <Slider aria-label="Volume" defaultValue={50} disabled onValueChange={onValueChange} />
        <button type="button">after</button>
      </>,
    );
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("aria-disabled", "true");
    expect(slider).not.toHaveAttribute("tabindex");
    await user.tab();
    expect(screen.getByRole("button", { name: "after" })).toHaveFocus();
    press(layOut(container), 180);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(slider).toHaveAttribute("aria-valuenow", "50");
  });

  it("read-only (from the Field): focusable and announced, but nothing moves it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(
      <Field readOnly>
        <Field.Label>Current limit</Field.Label>
        <Slider defaultValue={40} onValueChange={onValueChange} />
      </Field>,
    );
    const slider = screen.getByRole("slider", { name: "Current limit" });
    expect(slider).toHaveAttribute("aria-readonly", "true");
    await user.tab();
    expect(slider).toHaveFocus();
    await user.keyboard("{ArrowRight}{End}");
    const control = layOut(container);
    press(control, 190);
    drag(control, 10);
    release(control);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(slider).toHaveAttribute("aria-valuenow", "40");
  });

  it("takes the Field's error: invalid and described by it", () => {
    render(
      <Field>
        <Field.Label>Threshold</Field.Label>
        <Slider defaultValue={5} />
        <Field.Error>Too low to be useful.</Field.Error>
      </Field>,
    );
    const slider = screen.getByRole("slider", { name: "Threshold" });
    expect(slider).toHaveAttribute("aria-invalid", "true");
    expect(slider).toHaveAccessibleDescription("Too low to be useful.");
    expect(slider.closest(".r-form-slider")).toHaveAttribute("data-invalid");
  });

  it("draws marks as ticks (lit up to the value) with their labels out of the accessibility tree", () => {
    const { container } = render(
      <Slider aria-label="Threshold" defaultValue={75} marks={[0, { value: 50, label: "Warn" }, { value: 90, label: "Page" }, 120]} />,
    );
    const ticks = [...container.querySelectorAll(".r-form-slider-tick")];
    // 120 is off the scale and dropped.
    expect(ticks.map((t) => t.hasAttribute("data-active"))).toEqual([true, true, false]);
    const labels = container.querySelector(".r-form-slider-marks");
    expect(labels).toHaveAttribute("aria-hidden", "true");
    expect([...(labels?.querySelectorAll(".r-form-slider-mark") ?? [])].map((m) => m.textContent)).toEqual(["Warn", "Page"]);
  });

  it("shows the formatted value in a bubble only when asked", () => {
    const { container, rerender } = render(<Slider aria-label="Volume" defaultValue={30} formatValue={(v) => `${v} dB`} />);
    expect(container.querySelector(".r-form-slider-bubble")).toBeNull();
    rerender(<Slider aria-label="Volume" defaultValue={30} formatValue={(v) => `${v} dB`} showValue />);
    expect(container.querySelector(".r-form-slider-bubble")).toHaveTextContent("30 dB");
  });

  it("draws and announces an off-grid value where the scale can hold it", () => {
    render(<Slider aria-label="Step" min={0} max={10} step={2} value={5.2} />);
    expect(screen.getByRole("slider", { name: "Step" })).toHaveAttribute("aria-valuenow", "6");
  });

  it("binds to a Form through its Field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    function Settings() {
      const form = useForm<{ refresh: number }>({ defaultValues: { refresh: 30 }, onSubmit });
      return (
        <Form form={form}>
          <Field name="refresh">
            <Field.Label>Refresh every</Field.Label>
            <Slider min={5} max={120} step={5} />
          </Field>
          <button type="submit">Save</button>
        </Form>
      );
    }
    const { container } = render(<Settings />);
    const slider = screen.getByRole("slider", { name: "Refresh every" });
    expect(slider).toHaveAttribute("aria-valuenow", "30");
    expect(container.querySelector<HTMLInputElement>('input[type=hidden][name="refresh"]')?.value).toBe("30");
    slider.focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ refresh: 40 });
  });
});
