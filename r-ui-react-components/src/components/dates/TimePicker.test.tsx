import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Field } from "../form";
import { TimePicker } from "./TimePicker";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 14, 10));
});
afterEach(() => vi.useRealTimers());

const activeOption = () => {
  const list = screen.getByRole("listbox");
  const id = list.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id) : null;
};
const optionTexts = () => within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent?.replace(/\s/g, " "));

async function openList(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Choose time" }));
  const list = screen.getByRole("listbox", { name: "Choose time" });
  await waitFor(() => expect(list).toHaveFocus());
  return list;
}

describe("TimePicker", () => {
  it("lists the day at `step` in the locale's clock, the chosen time active and selected", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start" locale="en-US" defaultValue="09:30" />);
    await openList(user);
    expect(screen.getByRole("dialog", { name: "Choose time" })).toBeInTheDocument();
    const texts = optionTexts();
    expect(texts).toHaveLength(48);
    expect([texts[0], texts[19], texts.at(-1)]).toEqual(["12:00 AM", "9:30 AM", "11:30 PM"]);
    expect(activeOption()).toHaveTextContent(/^9:30\sAM$/);
    expect(activeOption()).toHaveAttribute("aria-selected", "true");
    expect(activeOption()).toHaveAttribute("data-active", "keyboard");
    expect(within(screen.getByRole("listbox")).getAllByRole("option", { selected: true })).toHaveLength(1);
  });

  it("arrows move, Enter chooses and closes, focus returns to the button", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<TimePicker aria-label="Start" locale="de-DE" defaultValue="09:30" onValueChange={onValueChange} />);
    await openList(user);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    expect(activeOption()).toHaveTextContent("10:00");
    await user.keyboard("{Enter}");
    expect(onValueChange.mock.calls).toEqual([["10:00"]]);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Choose time" })).toHaveFocus();
    expect(screen.getByRole("spinbutton", { name: "Start Hours" })).toHaveAttribute("aria-valuetext", "10");

    // The next opening starts at the new time; Home / End reach the ends; Escape keeps the value.
    await openList(user);
    expect(activeOption()).toHaveTextContent("10:00");
    await user.keyboard("{End}");
    expect(activeOption()).toHaveTextContent("23:30");
    await user.keyboard("{ArrowDown}");
    expect(activeOption()).toHaveTextContent("23:30");
    await user.keyboard("{Home}");
    expect(activeOption()).toHaveTextContent("00:00");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("with no value, the time nearest now is active and nothing is selected", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start" locale="de-DE" />);
    await openList(user);
    expect(activeOption()).toHaveTextContent("14:00");
    expect(within(screen.getByRole("listbox")).queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("a typed time off the stride still opens on the nearest option", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start" locale="de-DE" step={15} defaultValue="09:52" />);
    await openList(user);
    expect(activeOption()).toHaveTextContent("09:45");
    expect(within(screen.getByRole("listbox")).queryAllByRole("option", { selected: true })).toEqual([]);
  });

  it("typing digits jumps to the time that starts with them", async () => {
    const user = userEvent.setup();
    render(<TimePicker aria-label="Start" locale="de-DE" defaultValue="09:30" />);
    await openList(user);
    await user.keyboard("13");
    expect(activeOption()).toHaveTextContent("13:00");
    await user.keyboard("{PageDown}");
    expect(activeOption()).toHaveTextContent("17:00");
  });

  it("min / max bound the list (a window across midnight too), and option ids follow the times", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TimePicker aria-label="Active" locale="en-US" min="09:00" max="17:30" defaultValue="12:00" />);
    await openList(user);
    const texts = optionTexts();
    expect(texts).toHaveLength(18);
    expect([texts[0], texts.at(-1)]).toEqual(["9:00 AM", "5:30 PM"]);
    const noon = activeOption();
    expect(noon?.id).toMatch(/t120000$/);
    await user.keyboard("{ArrowDown}");
    expect(activeOption()?.id).toMatch(/t123000$/);
    unmount();

    render(<TimePicker aria-label="Quiet" locale="de-DE" min="22:00" max="02:00" step={60} />);
    await openList(user);
    expect(optionTexts()).toEqual(["22:00", "23:00", "00:00", "01:00", "02:00"]);
  });

  it("a press on an option chooses it; `open` is controllable", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const { rerender } = render(
      <TimePicker aria-label="Start" locale="de-DE" open onOpenChange={onOpenChange} onValueChange={onValueChange} />,
    );
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "08:30" }));
    expect(onValueChange.mock.calls).toEqual([["08:30"]]);
    expect(onOpenChange.mock.calls).toEqual([[false]]);
    // Still open: the parent owns it.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    rerender(<TimePicker aria-label="Start" locale="de-DE" open={false} onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("is a Field control that submits HH:mm, and takes the provider's locale and labels", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider locale="en-US" labels={{ TimePicker: { chooseTime: "Pick a time", hour: "Hour" } }}>
        <form aria-label="form">
          <Field name="opens">
            <Field.Label>Opens</Field.Label>
            <TimePicker />
          </Field>
        </form>
      </LocaleProvider>,
    );
    const submitted = () => new FormData(screen.getByRole("form", { name: "form" }) as HTMLFormElement).getAll("opens");
    expect(submitted()).toEqual([""]);
    await user.click(screen.getByRole("button", { name: "Pick a time" }));
    const list = screen.getByRole("listbox", { name: "Pick a time" });
    await waitFor(() => expect(list).toHaveFocus());
    await user.keyboard("{ArrowDown}{Enter}");
    // Now is 14:10: the nearest is 2:00 PM, one down is 2:30 PM. One hidden input, 24-hour.
    expect(submitted()).toEqual(["14:30"]);
    expect(screen.getByRole("spinbutton", { name: "Opens Hour" })).toHaveAttribute("aria-valuetext", "02");
  });

  it("disabled and read-only keep the list shut", () => {
    render(
      <>
        <TimePicker aria-label="Off" locale="de-DE" disabled />
        <TimePicker aria-label="Fixed" locale="de-DE" readOnly defaultValue="09:00" />
      </>,
    );
    for (const button of screen.getAllByRole("button", { name: "Choose time" })) expect(button).toBeDisabled();
  });
});
