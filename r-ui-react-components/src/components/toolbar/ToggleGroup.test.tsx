import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bold, TextAlignCenter, TextAlignEnd, TextAlignStart } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Field, Form, useForm } from "../form";
import { ToggleGroup } from "./ToggleGroup";

function Style(props: { onValueChange?: (value: string[]) => void; defaultValue?: string[] }) {
  return (
    <ToggleGroup type="multiple" aria-label="Style" {...props}>
      <ToggleGroup.Item value="bold" icon={<Bold />} label="Bold" />
      <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      <ToggleGroup.Item value="underline">Underline</ToggleGroup.Item>
    </ToggleGroup>
  );
}

function Align(props: { onValueChange?: (value: string) => void; defaultValue?: string; disabledRight?: boolean }) {
  const { disabledRight, ...rest } = props;
  return (
    <ToggleGroup type="single" aria-label="Alignment" {...rest}>
      <ToggleGroup.Item value="left" icon={<TextAlignStart />} label="Left" />
      <ToggleGroup.Item value="center" icon={<TextAlignCenter />} label="Center" />
      <ToggleGroup.Item value="right" icon={<TextAlignEnd />} label="Right" disabled={disabledRight} />
    </ToggleGroup>
  );
}

const pressedNames = () =>
  screen
    .getAllByRole("button")
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.getAttribute("aria-label") ?? b.textContent);

describe("ToggleGroup type=multiple", () => {
  it("is a named group of independent aria-pressed toggles", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Style onValueChange={onValueChange} defaultValue={["italic"]} />);
    expect(screen.getByRole("group", { name: "Style" })).toBeInTheDocument();
    // An icon-only toggle is named by its label.
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "false");
    expect(pressedNames()).toEqual(["Italic"]);

    await user.click(screen.getByRole("button", { name: "Bold" }));
    expect(pressedNames()).toEqual(["Bold", "Italic"]);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenLastCalledWith(["italic", "bold"]);

    await user.click(screen.getByRole("button", { name: "Italic" }));
    expect(pressedNames()).toEqual(["Bold"]);
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange).toHaveBeenLastCalledWith(["bold"]);
  });

  it("controlled: shows the caller's value and asks for changes", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <ToggleGroup type="multiple" aria-label="Style" value={["bold"]} onValueChange={onValueChange}>
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup>,
    );
    await user.click(screen.getByRole("button", { name: "Italic" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith(["bold", "italic"]);
    // The caller did not take it: the shown value stays the caller's.
    expect(pressedNames()).toEqual(["Bold"]);
  });

  it("standalone: one tab stop, arrows only move, Space presses", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Before</button>
        <Style />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }));
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Italic" }));
    expect(pressedNames()).toEqual([]);
    await user.keyboard(" ");
    expect(pressedNames()).toEqual(["Italic"]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Underline" }));
    // Leaving and coming back lands on the last toggle used.
    await user.tab({ shift: true });
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Underline" }));
  });
});

describe("ToggleGroup type=single", () => {
  it("is a radiogroup whose choice moves but never clears", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<Align onValueChange={onValueChange} defaultValue="left" />);
    const group = screen.getByRole("radiogroup", { name: "Alignment" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Center" })).toHaveAttribute("aria-checked", "false");
    // A radio is not a pressed toggle as well.
    expect(screen.getByRole("radio", { name: "Left" })).not.toHaveAttribute("aria-pressed");

    await user.click(screen.getByRole("radio", { name: "Center" }));
    expect(screen.getByRole("radio", { name: "Center" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "false");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("center");

    await user.click(screen.getByRole("radio", { name: "Center" }));
    expect(screen.getByRole("radio", { name: "Center" })).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("standalone: the tab stop is the checked radio and the arrows check as they move, over a disabled one", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <button>Before</button>
        <Align defaultValue="center" onValueChange={onValueChange} disabledRight />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Center" }));
    await user.keyboard("{ArrowRight}");
    // Right is disabled: the walk wraps to Left and checks it.
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Left" }));
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "true");
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("left");
  });

  it("with nothing chosen, Tab lands on the first radio without choosing it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <>
        <button>Before</button>
        <Align onValueChange={onValueChange} />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Before" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Left" }));
    expect(screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true")).toHaveLength(0);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("right to left, the arrows mirror", () => {
    render(
      <div style={{ direction: "rtl" }}>
        <Align defaultValue="left" />
      </div>,
    );
    screen.getByRole("radio", { name: "Left" }).focus();
    fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Center" }));
    // Standalone, the arrows check as they move, mirrored too.
    expect(screen.getByRole("radio", { name: "Center" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("ToggleGroup as a form control", () => {
  it("binds a single group to the form through Field, submitting its value under the Field's name", async () => {
    const user = userEvent.setup();
    let read: () => unknown = () => undefined;
    function Settings() {
      const form = useForm({ defaultValues: { align: "right" } });
      read = () => form.getValues().align;
      return (
        <Form form={form}>
          <Field name="align">
            <Field.Label>Alignment</Field.Label>
            <Align />
          </Field>
        </Form>
      );
    }
    const { container } = render(<Settings />);
    // Named by the Field's label (the instance's aria-label is the fallback).
    expect(screen.getByRole("radiogroup", { name: "Alignment" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Right" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "Left" }));
    expect(read()).toBe("left");
    const hidden = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(hidden.map((i) => [i.name, i.value])).toEqual([["align", "left"]]);
  });

  it("binds a multiple group as a list, one hidden input per pressed value", async () => {
    const user = userEvent.setup();
    let read: () => unknown = () => undefined;
    function Settings() {
      const form = useForm({ defaultValues: { style: ["bold"] } });
      read = () => form.getValues().style;
      return (
        <Form form={form}>
          <Field name="style">
            <Field.Label>Style</Field.Label>
            <Style />
          </Field>
        </Form>
      );
    }
    const { container } = render(<Settings />);
    expect(pressedNames()).toEqual(["Bold"]);
    await user.click(screen.getByRole("button", { name: "Underline" }));
    expect(read()).toEqual(["bold", "underline"]);
    const hidden = [...container.querySelectorAll<HTMLInputElement>('input[type="hidden"]')];
    expect(hidden.map((i) => `${i.name}=${i.value}`)).toEqual(["style=bold", "style=underline"]);
  });

  it("invalid and disabled from the Field: described, marked, and nothing submitted while disabled", () => {
    const { container } = render(
      <Field invalid disabled>
        <Field.Label>Alignment</Field.Label>
        <ToggleGroup type="single" name="align" defaultValue="left">
          <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
          <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
        </ToggleGroup>
        <Field.Error>Pick an alignment.</Field.Error>
      </Field>,
    );
    const group = screen.getByRole("radiogroup", { name: "Alignment" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Pick an alignment.");
    expect(group).toHaveAttribute("data-invalid");
    expect(group).toHaveAttribute("aria-disabled", "true");
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    expect(container.querySelectorAll('input[type="hidden"]')).toHaveLength(0);
  });

  it("controlled: a parent's state is the value, and its changes show", async () => {
    const user = userEvent.setup();
    function Parent() {
      const [value, setValue] = useState("left");
      return (
        <>
          <ToggleGroup type="single" aria-label="Alignment" value={value} onValueChange={setValue}>
            <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
            <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
          </ToggleGroup>
          <button onClick={() => setValue("left")}>Reset</button>
        </>
      );
    }
    render(<Parent />);
    await user.click(screen.getByRole("radio", { name: "Right" }));
    expect(screen.getByRole("radio", { name: "Right" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Right" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("ToggleGroup.Item types", () => {
  it("an icon-only item must have a label", () => {
    render(
      <ToggleGroup type="multiple" aria-label="Style">
        {/* @ts-expect-error an icon says nothing: an icon-only item needs `label` */}
        <ToggleGroup.Item value="bold" icon={<Bold />} />
      </ToggleGroup>,
    );
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });
});
