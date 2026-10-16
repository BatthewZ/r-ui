import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Field } from "./Field";
import { RangeSlider } from "./RangeSlider";
import { Form, useForm } from "./use-form";

function layOut(container: HTMLElement) {
  const rail = container.querySelector<HTMLElement>(".r-form-slider-rail");
  if (!rail) throw new Error("no rail");
  rail.getBoundingClientRect = () => ({ left: 0, top: 0, right: 200, bottom: 20, width: 200, height: 20, x: 0, y: 0, toJSON: () => ({}) });
  const control = container.querySelector<HTMLElement>(".r-form-slider-control");
  if (!control) throw new Error("no control");
  return control;
}
const press = (control: HTMLElement, clientX: number) => fireEvent.pointerDown(control, { button: 0, pointerId: 1, clientX, clientY: 10 });
const drag = (control: HTMLElement, clientX: number) => fireEvent.pointerMove(control, { pointerId: 1, clientX, clientY: 10 });
const release = (control: HTMLElement) => fireEvent.pointerUp(control, { pointerId: 1 });

const thumbs = () => [screen.getByRole("slider", { name: "Minimum" }), screen.getByRole("slider", { name: "Maximum" })] as const;
const now = () => thumbs().map((t) => Number(t.getAttribute("aria-valuenow")));

describe("RangeSlider", () => {
  it("is a group named by the Field, with two thumbs named, described and spoken separately", () => {
    const { container } = render(
      <form aria-label="filters">
        <Field>
          <Field.Label>Price</Field.Label>
          <RangeSlider
            name="price"
            min={0}
            max={1000}
            step={10}
            defaultValue={[120, 640]}
            locale="en-US"
            formatOptions={{ style: "currency", currency: "USD", maximumFractionDigits: 0 }}
          />
          <Field.Description>Per night.</Field.Description>
        </Field>
      </form>,
    );
    expect(screen.getByRole("group", { name: "Price" })).toBeInTheDocument();
    const [low, high] = thumbs();
    expect(low).toHaveAttribute("aria-valuetext", "$120");
    expect(high).toHaveAttribute("aria-valuetext", "$640");
    expect(low).toHaveAccessibleDescription("Per night.");
    expect(high).toHaveAccessibleDescription("Per night.");
    // Each thumb's range is bounded by the other (APG multi-thumb).
    expect([low.getAttribute("aria-valuemin"), low.getAttribute("aria-valuemax")]).toEqual(["0", "640"]);
    expect([high.getAttribute("aria-valuemin"), high.getAttribute("aria-valuemax")]).toEqual(["120", "1000"]);
    expect(new FormData(container.querySelector("form") as HTMLFormElement).getAll("price")).toEqual(["120", "640"]);
  });

  it("names its thumbs from labels, through the provider and the instance", () => {
    render(
      <LocaleProvider labels={{ RangeSlider: { minimum: "Von", maximum: "Bis" } }}>
        <RangeSlider aria-label="Preis" />
        <RangeSlider aria-label="Dauer" labels={{ maximum: "Höchstens" }} />
      </LocaleProvider>,
    );
    expect(screen.getAllByRole("slider").map((s) => s.getAttribute("aria-label"))).toEqual(["Von", "Bis", "Von", "Höchstens"]);
    expect(screen.getByRole("group", { name: "Preis" })).toBeInTheDocument();
  });

  it("moves each thumb by its own keys, and neither crosses the other (or the kept gap)", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<RangeSlider aria-label="Window" defaultValue={[20, 40]} minStepsBetweenThumbs={5} onValueChange={onValueChange} />);
    const [low, high] = thumbs();
    await user.tab();
    expect(low).toHaveFocus();
    await user.keyboard("{ArrowRight}{End}");
    expect(now()).toEqual([35, 40]);
    await user.tab();
    expect(high).toHaveFocus();
    await user.keyboard("{Home}");
    expect(now()).toEqual([35, 40]);
    await user.keyboard("{End}{Shift>}{ArrowLeft}{/Shift}");
    expect(now()).toEqual([35, 90]);
    expect(onValueChange.mock.calls.map(([v]) => v)).toEqual([
      [21, 40],
      [35, 40],
      [35, 100],
      [35, 90],
    ]);
  });

  it("drags the nearest thumb, which stops at the other, and commits once on release", () => {
    const onValueCommit = vi.fn();
    const { container } = render(<RangeSlider aria-label="Window" defaultValue={[20, 60]} onValueCommit={onValueCommit} />);
    const control = layOut(container);
    const [low, high] = thumbs();
    // 30 is nearer the low thumb.
    press(control, 60);
    expect(low).toHaveFocus();
    expect(now()).toEqual([30, 60]);
    drag(control, 190);
    expect(now()).toEqual([60, 60]);
    release(control);
    expect(onValueCommit).toHaveBeenCalledExactlyOnceWith([60, 60]);
    // Coincident thumbs, a press above them: the high one, pushed back down onto
    // the low one. The gesture ends where it began, so it commits nothing.
    press(control, 180);
    expect(high).toHaveFocus();
    expect(now()).toEqual([60, 90]);
    drag(control, 0);
    release(control);
    expect(now()).toEqual([60, 60]);
    expect(onValueCommit).toHaveBeenCalledTimes(1);
  });

  it("settles a press on coincident thumbs by the direction of the drag", () => {
    const { container } = render(<RangeSlider aria-label="Window" defaultValue={[50, 50]} />);
    const control = layOut(container);
    const [low, high] = thumbs();
    press(control, 100);
    expect(now()).toEqual([50, 50]);
    drag(control, 140);
    expect(high).toHaveFocus();
    expect(now()).toEqual([50, 70]);
    release(control);
    press(control, 100);
    drag(control, 60);
    release(control);
    expect(low).toHaveFocus();
    expect(now()).toEqual([30, 70]);
  });

  it("takes a press within half a thumb of stacked thumbs as on them, not as a side", () => {
    const { container } = render(<RangeSlider aria-label="Window" defaultValue={[50, 50]} />);
    const control = layOut(container);
    // 20px thumbs on a 200px rail: half a thumb is 5 units.
    for (const thumb of thumbs()) {
      thumb.getBoundingClientRect = () => ({ left: 90, top: 0, right: 110, bottom: 20, width: 20, height: 20, x: 90, y: 0, toJSON: () => ({}) });
    }
    // 48 is below the pair, but on the stacked thumbs: dragging right takes the high one.
    press(control, 96);
    drag(control, 140);
    release(control);
    expect(now()).toEqual([50, 70]);
  });

  it("draws a caller's out-of-order or too-close pair as the scale can hold it", () => {
    render(<RangeSlider aria-label="Window" value={[80, 20]} />);
    expect(now()).toEqual([20, 80]);
  });

  it("binds to a Form as [low, high] and takes the Field's disabled state", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    function Filters({ disabled = false }: { disabled?: boolean }) {
      const form = useForm<{ price: [number, number] }>({ defaultValues: { price: [100, 500] }, onSubmit });
      return (
        <Form form={form}>
          <Field name="price" disabled={disabled}>
            <Field.Label>Price</Field.Label>
            <RangeSlider min={0} max={1000} step={50} />
          </Field>
          <button type="submit">Apply</button>
        </Form>
      );
    }
    const { unmount } = render(<Filters />);
    expect(now()).toEqual([100, 500]);
    thumbs()[1].focus();
    await user.keyboard("{ArrowRight}");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ price: [100, 550] });
    unmount();

    render(<Filters disabled />);
    for (const thumb of thumbs()) {
      expect(thumb).toHaveAttribute("aria-disabled", "true");
      expect(thumb).not.toHaveAttribute("tabindex");
    }
  });
});
