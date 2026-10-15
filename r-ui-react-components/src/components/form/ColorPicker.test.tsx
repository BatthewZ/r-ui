import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stubPopover } from "../overlays/overlay-stubs.test.helpers";
import { hueMaxChroma, maxChroma, parseOklch } from "./color-core";
import { ColorPicker, type ColorPickerProps } from "./ColorPicker";
import { Field } from "./Field";
import { Form, useForm } from "./use-form";

let popover: ReturnType<typeof stubPopover>;
beforeEach(() => {
  popover = stubPopover();
});
afterEach(() => popover.restore());

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent);

const BRAND = [
  { value: "#0f766e", label: "Teal" },
  { value: "#b45309", label: "Amber" },
  { value: "oklch(0.45 0.2 290)", label: "Violet" },
];

function Picker(props: ColorPickerProps) {
  return (
    <form aria-label="settings">
      <Field>
        <Field.Label>Brand colour</Field.Label>
        <ColorPicker name="brand" {...props} />
        <Field.Description>Used for links and the primary action.</Field.Description>
      </Field>
      <button type="button">elsewhere</button>
    </form>
  );
}

const trigger = () => screen.getByRole("button", { name: /^Brand colour/ });
const submitted = () => new FormData(screen.getByRole("form", { name: "settings" }) as HTMLFormElement).get("brand");

/** Opens the popup and waits for its initial focus (the area's thumb). */
async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(trigger());
  // jsdom never matches :popover-open, so the promoted panel counts as hidden
  // (and an element hidden itself gets no computed name: read the attribute).
  const dialog = screen.getByRole("dialog", { hidden: true });
  expect(dialog).toHaveAttribute("aria-label", "Choose colour");
  const area = within(dialog).getByRole("slider", { name: "Lightness and chroma", hidden: true });
  await waitFor(() => expect(area).toHaveFocus());
  return { dialog, area };
}

describe("ColorPicker", () => {
  it("is a Field control: named by the label and its value, described by the Field, submitted by name", () => {
    render(<Picker defaultValue="#0f766e" />);
    expect(trigger()).toHaveAccessibleName("Brand colour #0f766e");
    expect(describedBy(trigger())).toEqual(["Used for links and the primary action."]);
    expect(trigger()).toHaveAttribute("aria-haspopup", "dialog");
    expect(submitted()).toBe("#0f766e");
  });

  it("shows no colour as text, and takes its name from aria-label outside a Field", () => {
    render(<ColorPicker aria-label="Accent" />);
    expect(screen.getByRole("button", { name: "Accent None" })).toBeInTheDocument();
  });

  it("moves lightness and chroma from the keyboard on the area's thumb", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker format="oklch" defaultValue="oklch(0.5 0.1 250)" onValueChange={onValueChange} />);
    const { area } = await openPicker(user);
    expect(area).toHaveAttribute("aria-valuenow", "50");
    expect(area).toHaveAttribute("aria-valuetext", "Lightness 50%, chroma 0.100");
    await user.keyboard("{ArrowUp}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.51 0.1 250)");
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.61 0.1 250)");
    await user.keyboard("{PageDown}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.51 0.1 250)");
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.51 0 250)");
    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    expect(parseOklch(onValueChange.mock.lastCall?.[0])?.color.c).toBeCloseTo(hueMaxChroma(250) * 0.1, 2);
    await user.keyboard("{End}");
    expect(parseOklch(onValueChange.mock.lastCall?.[0])?.color.c).toBeCloseTo(maxChroma(0.51, 250), 2);
    // The trigger and the submitted value follow every step.
    expect(trigger()).toHaveAccessibleName(`Brand colour ${onValueChange.mock.lastCall?.[0]}`);
    expect(submitted()).toBe(onValueChange.mock.lastCall?.[0]);
  });

  it("moves hue from the keyboard on the hue slider", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker format="oklch" defaultValue="oklch(0.5 0.1 250)" onValueChange={onValueChange} />);
    const { dialog } = await openPicker(user);
    const hue = within(dialog).getByRole("slider", { name: "Hue", hidden: true });
    expect(hue).toHaveAttribute("aria-valuenow", "250");
    hue.focus();
    await user.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.5 0.1 251)");
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.5 0.1 241)");
    await user.keyboard("{Home}");
    expect(onValueChange).toHaveBeenLastCalledWith("oklch(0.5 0.1 0)");
    expect(hue).toHaveAttribute("aria-valuetext", "0°");
  });

  it("keeps the hue through a grey, where the value itself cannot carry one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker format="oklch" defaultValue="oklch(0.5 0.1 250)" onValueChange={onValueChange} />);
    await openPicker(user);
    await user.keyboard("{Home}{End}");
    expect(parseOklch(onValueChange.mock.lastCall?.[0])?.color.h).toBe(250);
  });

  it.each([
    ["hex", "#3366CC", "#3366cc"],
    ["hex", "#36c", "#3366cc"],
    ["hex", "oklch(0.628 0.2577 29.23)", "#ff0000"],
    ["oklch", "oklch(0.7 0.1 150)", "oklch(0.7 0.1 150)"],
    ["oklch", "oklch(70% 0.1 150deg)", "oklch(0.7 0.1 150)"],
  ] as const)("%s: typed %s commits %s on Enter", async (format, typed, committed) => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker format={format} onValueChange={onValueChange} />);
    const { dialog } = await openPicker(user);
    const input = within(dialog).getByRole("textbox", { name: "Colour value", hidden: true });
    await user.clear(input);
    await user.type(input, `${typed}{Enter}`);
    expect(onValueChange.mock.calls).toEqual([[committed]]);
    expect(input).toHaveValue(committed);
    expect(submitted()).toBe(committed);
  });

  it("keeps a colour outside sRGB inside it, and says so", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker format="oklch" onValueChange={onValueChange} />);
    const { dialog } = await openPicker(user);
    const input = within(dialog).getByRole("textbox", { name: "Colour value", hidden: true });
    await user.clear(input);
    await user.type(input, "oklch(0.7 0.3 150){Enter}");
    const kept = maxChroma(0.7, 150);
    expect(parseOklch(onValueChange.mock.lastCall?.[0])?.color.c).toBeCloseTo(kept, 2);
    expect(within(dialog).getByRole("status", { hidden: true })).toHaveTextContent(
      `Outside sRGB: chroma 0.300 is shown as ${kept.toFixed(3)}.`,
    );
    expect(describedBy(input)).toContain(`Outside sRGB: chroma 0.300 is shown as ${kept.toFixed(3)}.`);
  });

  it("refuses text it cannot read: the Field turns invalid and says why; the value stays", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker defaultValue="#0f766e" onValueChange={onValueChange} />);
    const { dialog } = await openPicker(user);
    const input = within(dialog).getByRole("textbox", { name: "Colour value", hidden: true });
    await user.clear(input);
    await user.type(input, "teal{Enter}");
    const reason = "“teal” is not a colour. Use #rrggbb or oklch(L C H).";
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(describedBy(input)).toEqual([reason]);
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
    expect(describedBy(trigger())).toEqual([reason, "Used for links and the primary action."]);
    // The Field itself turns invalid (its own state, not only the control's).
    const fieldRoot = screen.getByRole("form", { name: "settings" }).firstElementChild;
    expect(fieldRoot).toHaveAttribute("data-invalid");
    expect(submitted()).toBe("#0f766e");
    // Editing clears the reason.
    await user.type(input, "{Backspace}");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(trigger()).not.toHaveAttribute("aria-invalid");
    expect(fieldRoot).not.toHaveAttribute("data-invalid");
  });

  it("drops a refused draft when the popup closes", async () => {
    const user = userEvent.setup();
    render(<Picker defaultValue="#0f766e" />);
    const { dialog } = await openPicker(user);
    const input = within(dialog).getByRole("textbox", { name: "Colour value", hidden: true });
    await user.clear(input);
    await user.type(input, "nope{Enter}");
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
    await user.keyboard("{Escape}");
    expect(trigger()).toHaveFocus();
    expect(trigger()).not.toHaveAttribute("aria-invalid");
    await user.click(trigger());
    expect(screen.getByRole("textbox", { name: "Colour value", hidden: true })).toHaveValue("#0f766e");
  });

  it("follows a controlled open, asking the parent; a parent's close drops a refused draft too", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = render(<Picker defaultValue="#0f766e" open={false} onOpenChange={onOpenChange} />);
    await user.click(trigger());
    expect(onOpenChange.mock.calls).toEqual([[true]]);
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();

    rerender(<Picker defaultValue="#0f766e" open onOpenChange={onOpenChange} />);
    const input = screen.getByRole("textbox", { name: "Colour value", hidden: true });
    await user.clear(input);
    await user.type(input, "nope{Enter}");
    expect(trigger()).toHaveAttribute("aria-invalid", "true");
    rerender(<Picker defaultValue="#0f766e" open={false} onOpenChange={onOpenChange} />);
    expect(trigger()).not.toHaveAttribute("aria-invalid");
  });

  it("className styles the root; the trigger is a slot and takes ref and the rest", () => {
    let button: HTMLButtonElement | null = null;
    render(
      <Picker
        className="max-w-column-sm"
        classNames={{ trigger: "trigger-slot" }}
        data-testid="colour-trigger"
        ref={(el) => {
          button = el;
        }}
      />,
    );
    const root = trigger().parentElement!;
    expect(root).toHaveClass("max-w-column-sm");
    expect(trigger()).not.toHaveClass("max-w-column-sm");
    expect(trigger()).toHaveClass("trigger-slot");
    expect(trigger()).toHaveAttribute("data-testid", "colour-trigger");
    expect(button).toBe(trigger());
  });

  it("offers swatches as a radio group: one tab stop, arrows move and choose", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker defaultValue="#b45309" swatches={BRAND} onValueChange={onValueChange} />);
    expect(trigger()).toHaveAccessibleName("Brand colour #b45309 · Amber");
    const { dialog } = await openPicker(user);
    const group = within(dialog).getByRole("radiogroup", { name: "Swatches", hidden: true });
    const radios = within(group).getAllByRole("radio", { hidden: true });
    expect(radios.map((r) => [r.getAttribute("aria-label"), r.getAttribute("aria-checked"), r.tabIndex])).toEqual([
      ["Teal", "false", -1],
      ["Amber", "true", 0],
      ["Violet", "false", -1],
    ]);
    radios[1]?.focus();
    await user.keyboard("{ArrowRight}");
    expect(radios[2]).toHaveFocus();
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
    expect(radios[2]).toHaveAttribute("tabindex", "0");
    const violet = onValueChange.mock.lastCall?.[0];
    expect(trigger()).toHaveAccessibleName(`Brand colour ${violet} · Violet`);
    await user.keyboard("{ArrowRight}");
    expect(radios[0]).toHaveFocus();
    expect(onValueChange).toHaveBeenLastCalledWith("#0f766e");
    await user.keyboard("{ArrowLeft}");
    expect(onValueChange).toHaveBeenLastCalledWith(violet);
  });

  it("reads the WCAG ratio against a background, with AA and AAA by name", async () => {
    const user = userEvent.setup();
    render(<Picker defaultValue="#767676" swatches={[{ value: "#595959", label: "Ink" }]} contrast={{ against: "#ffffff", label: "white" }} />);
    const { dialog } = await openPicker(user);
    const readout = dialog.querySelector("[data-contrast]") as HTMLElement;
    expect(readout).toHaveTextContent("Contrast on white4.54:1AA passesAAA fails");
    await user.click(within(dialog).getByRole("radio", { name: "Ink", hidden: true }));
    expect(readout).toHaveTextContent("Contrast on white7.00:1AA passesAAA passes");
  });

  it("composites a translucent colour over the background before rating it", async () => {
    const user = userEvent.setup();
    render(<Picker alpha defaultValue="#00000080" contrast={{ against: "#ffffff", label: "white" }} />);
    const { dialog } = await openPicker(user);
    // 0x80 is 50.2% black: over white that is #7f7f7f, 4.00:1 (opaque black would be 21:1).
    expect(dialog.querySelector("[data-ratio]")).toHaveTextContent("4.00:1");
  });

  it("keeps alpha in the value when asked, from an opacity slider", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker alpha defaultValue="#0f766e" onValueChange={onValueChange} />);
    const { dialog } = await openPicker(user);
    const opacity = within(dialog).getByRole("slider", { name: "Opacity", hidden: true });
    expect(opacity).toHaveAttribute("aria-valuetext", "100%");
    opacity.focus();
    await user.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    expect(onValueChange).toHaveBeenLastCalledWith("#0f766ee6");
    expect(opacity).toHaveAttribute("aria-valuetext", "90%");
  });

  it("drops alpha when it is off", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Picker onValueChange={onValueChange} />);
    const { dialog } = await openPicker(user);
    expect(within(dialog).queryByRole("slider", { name: "Opacity", hidden: true })).toBeNull();
    const input = within(dialog).getByRole("textbox", { name: "Colour value", hidden: true });
    await user.type(input, "#0f766e80{Enter}");
    expect(onValueChange).toHaveBeenLastCalledWith("#0f766e");
  });

  it("offers the eyedropper only where the browser has one, and commits what it picks", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { unmount } = render(<Picker onValueChange={onValueChange} />);
    let { dialog } = await openPicker(user);
    expect(within(dialog).queryByRole("button", { name: "Pick a colour from the screen", hidden: true })).toBeNull();
    unmount();

    const open = vi.fn().mockResolvedValue({ sRGBHex: "#112233" });
    vi.stubGlobal(
      "EyeDropper",
      class {
        open = open;
      },
    );
    try {
      render(<Picker onValueChange={onValueChange} />);
      ({ dialog } = await openPicker(user));
      await user.click(within(dialog).getByRole("button", { name: "Pick a colour from the screen", hidden: true }));
      await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith("#112233"));
      expect(open).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not open when disabled or read-only", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Field disabled>
          <Field.Label>Disabled colour</Field.Label>
          <ColorPicker defaultValue="#0f766e" />
        </Field>
        <Field readOnly>
          <Field.Label>Fixed colour</Field.Label>
          <ColorPicker defaultValue="#0f766e" />
        </Field>
      </>,
    );
    expect(screen.getByRole("button", { name: /^Disabled colour/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^Fixed colour/ }));
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });

  it("binds through a Field in a Form: the form owns the value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    function Settings() {
      const form = useForm<{ brand: string }>({ defaultValues: { brand: "#0f766e" }, onSubmit });
      return (
        <Form form={form}>
          <Field name="brand">
            <Field.Label>Brand colour</Field.Label>
            <ColorPicker swatches={BRAND} />
          </Field>
          <button type="submit">Save</button>
        </Form>
      );
    }
    const { container } = render(<Settings />);
    expect(trigger()).toHaveAccessibleName("Brand colour #0f766e · Teal");
    expect(container.querySelector<HTMLInputElement>("input[type=hidden][name=brand]")?.value).toBe("#0f766e");
    const { dialog } = await openPicker(user);
    await user.click(within(dialog).getByRole("radio", { name: "Amber", hidden: true }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toEqual({ brand: "#b45309" });
  });

  it("follows a controlled value that moves for another reason", () => {
    const { rerender } = render(<Picker value="#0f766e" />);
    expect(trigger()).toHaveAccessibleName("Brand colour #0f766e");
    rerender(<Picker value="#b45309" />);
    expect(trigger()).toHaveAccessibleName("Brand colour #b45309");
    expect(submitted()).toBe("#b45309");
  });
});
