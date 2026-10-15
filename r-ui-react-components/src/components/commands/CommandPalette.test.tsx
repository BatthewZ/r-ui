import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CommandPalette, type CommandPaletteCommand, type CommandPaletteProps } from "./CommandPalette";
import { useCommandPaletteShortcut } from "./command-shortcut";
import { stubDialog } from "../overlays/overlay-stubs.test.helpers";

let restoreDialog: () => void;
beforeEach(() => {
  restoreDialog = stubDialog().restore;
});
afterEach(() => {
  restoreDialog();
  vi.useRealTimers();
});

const log: string[] = [];
const cmd = (id: string, label: string, extra: Partial<CommandPaletteCommand> = {}): CommandPaletteCommand => ({
  id,
  label,
  onSelect: () => log.push(id),
  ...extra,
});

const COMMANDS: CommandPaletteCommand[] = [
  cmd("overview", "Go to Overview", { group: "Pages" }),
  cmd("dashboard", "Go to Dashboard", { group: "Pages", shortcut: ["G", "D"] }),
  cmd("archive", "Archive project", { group: "Actions", disabled: true }),
  cmd("invite", "Invite people", { group: "Actions", keywords: ["team", "share"] }),
  {
    id: "theme",
    label: "Change theme…",
    group: "Preferences",
    page: {
      commands: [cmd("theme-light", "Light"), cmd("theme-dark", "Dark"), cmd("theme-aurora", "Aurora")],
    },
  },
];

function Palette(props: Partial<CommandPaletteProps>) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open palette
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} commands={COMMANDS} {...props} />
    </>
  );
}

/** The search field. jsdom's showModal stub does not focus it the way a browser does. */
function field() {
  const input = screen.getByRole("combobox", { name: "Search commands" });
  input.focus();
  return input;
}

const activeLabel = () => {
  const id = screen.getByRole("combobox").getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : null;
};
const optionLabels = () => screen.getAllByRole("option").map((o) => o.textContent);

beforeEach(() => {
  log.length = 0;
});

describe("CommandPalette", () => {
  it("is a named modal with a combobox driving a grouped listbox", () => {
    render(<Palette />);
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    const input = field();
    const listbox = screen.getByRole("listbox", { name: "Commands" });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(input).toHaveAttribute("aria-controls", listbox.id);
    expect(screen.getByRole("group", { name: "Pages" })).toContainElement(screen.getByRole("option", { name: /Go to Dashboard/ }));
    expect(screen.getByRole("group", { name: "Actions" })).toBeInTheDocument();
    // The first enabled command is highlighted, and selected for assistive tech.
    expect(activeLabel()).toBe("Go to Overview");
    expect(screen.getByRole("option", { name: /Go to Overview/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /Archive/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("typing filters and ranks, highlights the match and moves the cursor to the best one", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    await user.type(field(), "dash");
    expect(optionLabels()).toEqual(["Go to DashboardGD"]);
    expect(screen.getByRole("option").querySelector("mark")?.textContent).toBe("Dash");
    await user.clear(field());
    // A keyword finds "Invite people"; scattered letters find "Go to Overview".
    await user.type(field(), "team");
    expect(optionLabels()).toEqual(["Invite people"]);
    await user.clear(field());
    await user.type(field(), "gto");
    expect(activeLabel()).toBe("Go to Overview");
    expect(screen.getByRole("status")).toHaveTextContent(/command/);
  });

  it("shows an empty state that says what was searched", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    await user.type(field(), "zzz");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No commands match “zzz”")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("0 commands");
  });

  it("arrows move and wrap, landing on disabled commands (which Enter does not run); Home and End jump", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    field();
    await user.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("Go to DashboardGD");
    await user.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("Archive project");
    await user.keyboard("{Enter}");
    expect(log).toEqual([]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(activeLabel()).toBe("Archive project");
    await user.keyboard("{ArrowDown}");
    expect(activeLabel()).toBe("Invite people");
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(activeLabel()).toBe("Go to Overview");
    await user.keyboard("{ArrowUp}");
    expect(activeLabel()).toBe("Change theme…");
    await user.keyboard("{Home}");
    expect(activeLabel()).toBe("Go to Overview");
    await user.keyboard("{End}");
    expect(activeLabel()).toBe("Change theme…");
  });

  it("an option's id comes from its command, not its position, so it survives a re-filter", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    const before = screen.getByRole("option", { name: /Invite/ }).id;
    expect(before).not.toBe("");
    await user.type(field(), "invite");
    expect(optionLabels()).toEqual(["Invite people"]);
    expect(screen.getByRole("option", { name: /Invite/ }).id).toBe(before);
    expect(screen.getByRole("combobox")).toHaveAttribute("aria-activedescendant", before);
  });

  it("Enter closes the palette, then runs the command", async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    const onOpenChange = vi.fn((open: boolean) => order.push(`open:${open}`));
    render(
      <CommandPalette
        defaultOpen
        onOpenChange={onOpenChange}
        commands={[cmd("a", "Alpha", { onSelect: () => order.push("ran") })]}
      />,
    );
    field();
    await user.keyboard("{Enter}");
    expect(order).toEqual(["open:false", "ran"]);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("a click runs a command; a disabled command does nothing", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    await user.click(screen.getByRole("option", { name: /Archive/ }));
    expect(log).toEqual([]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Invite/ }));
    expect(log).toEqual(["invite"]);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("an Enter while an IME is composing does nothing", () => {
    render(<Palette />);
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });
    expect(log).toEqual([]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape (the dialog's cancel) closes it", () => {
    render(<Palette />);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("a page command opens a nested list; Backspace in the empty field returns with the query and cursor restored", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    await user.type(field(), "theme");
    expect(activeLabel()).toBe("Change theme…");
    await user.keyboard("{Enter}");
    expect(log).toEqual([]);
    expect(field()).toHaveValue("");
    expect(screen.getByText("Change theme")).toBeInTheDocument();
    expect(optionLabels()).toEqual(["Light", "Dark", "Aurora"]);
    await user.type(field(), "d");
    await user.keyboard("{Backspace}");
    // The first Backspace edits; only one on an empty field goes back.
    expect(optionLabels()).toEqual(["Light", "Dark", "Aurora"]);
    await user.keyboard("{Backspace}");
    expect(field()).toHaveValue("theme");
    expect(activeLabel()).toBe("Change theme…");
  });

  it("the back button returns too, and keeps focus in the field", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    field();
    await user.keyboard("{End}{Enter}");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(optionLabels()).toContain("Change theme…");
  });

  it("running a nested command closes and runs it", async () => {
    const user = userEvent.setup();
    render(<Palette />);
    field();
    await user.keyboard("{End}{Enter}{ArrowDown}{Enter}");
    expect(log).toEqual(["theme-dark"]);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("remembers recent commands in memory, newest first, with the page they came from", async () => {
    const user = userEvent.setup();
    const onRecentChange = vi.fn();
    render(<Palette onRecentChange={onRecentChange} />);
    await user.type(field(), "invite{Enter}");
    await user.click(screen.getByRole("button", { name: "Open palette" }));
    field();
    await user.keyboard("{End}{Enter}{End}{Enter}");
    expect(onRecentChange).toHaveBeenLastCalledWith(["theme-aurora", "invite"]);
    await user.click(screen.getByRole("button", { name: "Open palette" }));
    const recent = screen.getByRole("group", { name: "Recent" });
    expect(within(recent).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Change theme › Aurora",
      "Invite people",
    ]);
    // Typing leaves the recent list.
    await user.type(field(), "a");
    expect(screen.queryByRole("group", { name: "Recent" })).toBeNull();
  });

  it("restores persisted recent ids, including a nested command, and drops unknown ones", () => {
    render(<Palette defaultRecent={["theme-dark", "gone", "dashboard"]} />);
    const recent = screen.getByRole("group", { name: "Recent" });
    expect(within(recent).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Change theme › Dark",
      "Go to DashboardGD",
    ]);
  });

  it("loads a page's commands once, with a loading state, and lists them", async () => {
    const user = userEvent.setup();
    let resolve!: (list: CommandPaletteCommand[]) => void;
    const loader = vi.fn(() => new Promise<CommandPaletteCommand[]>((r) => (resolve = r)));
    const commands = [{ id: "sections", label: "Go to section…", page: { commands: loader } }];
    render(<Palette commands={commands} />);
    field();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Loading…", { selector: "div:not([role=status])" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    await act(async () => resolve([cmd("button", "Button"), cmd("card", "Card")]));
    expect(optionLabels()).toEqual(["Button", "Card"]);
    await user.type(field(), "car");
    expect(optionLabels()).toEqual(["Card"]);

    // Closed and reopened: the page is cached.
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    await user.click(screen.getByRole("button", { name: "Open palette" }));
    field();
    await user.keyboard("{Enter}");
    expect(optionLabels()).toEqual(["Button", "Card"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("a failed load says so", async () => {
    const user = userEvent.setup();
    const commands = [{ id: "s", label: "Sections…", page: { commands: () => Promise.reject(new Error("offline")) } }];
    render(<Palette commands={commands} />);
    field();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Could not load commands.", { selector: "p span" })).toBeInTheDocument();
  });

  it("searches after a pause, aborting a superseded request, and lists the results with a highlight", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const signals: AbortSignal[] = [];
    const search = vi.fn(async (query: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return [cmd(`person-${query}`, `Ada ${query}`, { group: "People" })];
    });
    render(<Palette search={search} />);
    await user.type(field(), "lov");
    expect(search).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(150));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenLastCalledWith("lov", expect.anything());
    await waitFor(() => expect(screen.getByRole("group", { name: "People" })).toBeInTheDocument());
    expect(screen.getByRole("option", { name: "Ada lov" }).querySelector("mark")?.textContent).toBe("lov");

    await user.type(field(), "e");
    await act(async () => vi.advanceTimersByTime(150));
    expect(search).toHaveBeenLastCalledWith("love", expect.anything());
    expect(signals[0]?.aborted).toBe(true);
    await waitFor(() => expect(screen.getByRole("option", { name: "Ada love" })).toBeInTheDocument());
  });

  it("a nested page never lists the page before's search results, nor searches with its query", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const rootSearch = vi.fn(async () => [cmd("root-hit", "Root result", { group: "People" })]);
    const roomSearch = vi.fn((_query: string, _options: { signal: AbortSignal }) => new Promise<CommandPaletteCommand[]>(() => {}));
    render(<Palette commands={[{ id: "rooms", label: "Rooms…", page: { search: roomSearch } }]} search={rootSearch} />);
    await user.type(field(), "ro");
    await act(async () => vi.advanceTimersByTime(150));
    await waitFor(() => expect(screen.getByRole("option", { name: "Root result" })).toBeInTheDocument());
    expect(activeLabel()).toBe("Rooms…");

    await user.keyboard("{Enter}");
    await user.type(field(), "z");
    expect(screen.queryByRole("option", { name: "Root result" })).toBeNull();
    await act(async () => vi.advanceTimersByTime(150));
    expect(screen.queryByRole("option", { name: "Root result" })).toBeNull();
    expect(roomSearch.mock.calls.map(([query]) => query)).toEqual(["z"]);
  });

  it("shows the caller's loading state for the root commands", () => {
    render(<Palette commands={[]} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
    expect(screen.queryByText(/No commands/)).toBeNull();
  });
});

describe("useCommandPaletteShortcut", () => {
  function press(init: KeyboardEventInit, target: EventTarget = document.body) {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  }

  it("Ctrl+K calls it and takes the chord from the browser; the chord is reported for display", () => {
    const onShortcut = vi.fn();
    const { result } = renderHook(() => useCommandPaletteShortcut(onShortcut));
    expect(result.current).toEqual({ keys: ["Ctrl", "K"], ariaKeyShortcuts: "Control+K" });
    const event = press({ key: "k", ctrlKey: true });
    expect(onShortcut).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    // Plain K, Ctrl+Shift+K and another key do nothing.
    press({ key: "k" });
    press({ key: "K", ctrlKey: true, shiftKey: true });
    press({ key: "j", ctrlKey: true });
    expect(onShortcut).toHaveBeenCalledTimes(1);
  });

  it("ignores typing in a field, an IME composition and key repeat", () => {
    const onShortcut = vi.fn();
    renderHook(() => useCommandPaletteShortcut(onShortcut));
    const input = document.createElement("input");
    document.body.append(input);
    press({ key: "k", ctrlKey: true }, input);
    press({ key: "k", ctrlKey: true, isComposing: true });
    press({ key: "k", ctrlKey: true, keyCode: 229 });
    press({ key: "k", ctrlKey: true, repeat: true });
    expect(onShortcut).toHaveBeenCalledTimes(0);
    input.remove();
  });

  it("takes another key, may fire in fields, and can be disabled", () => {
    const onShortcut = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useCommandPaletteShortcut(onShortcut, { key: "p", allowInEditable: true, enabled }), {
      initialProps: { enabled: true },
    });
    const input = document.createElement("textarea");
    document.body.append(input);
    press({ key: "p", ctrlKey: true }, input);
    expect(onShortcut).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    press({ key: "p", ctrlKey: true });
    expect(onShortcut).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it("is Cmd+K on Apple platforms, where Ctrl+K is left alone", () => {
    const platform = vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
    const onShortcut = vi.fn();
    const { result } = renderHook(() => useCommandPaletteShortcut(onShortcut));
    expect(result.current.keys).toEqual(["⌘", "K"]);
    press({ key: "k", ctrlKey: true });
    expect(onShortcut).toHaveBeenCalledTimes(0);
    press({ key: "k", metaKey: true });
    expect(onShortcut).toHaveBeenCalledTimes(1);
    platform.mockRestore();
  });
});
