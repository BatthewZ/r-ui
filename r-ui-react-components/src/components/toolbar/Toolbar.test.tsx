import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bold, Italic, Link, Redo, Underline, Undo } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Input, Select } from "../form";
import { DropdownMenu } from "../overlays";
import { stubPopover } from "../overlays/overlay-stubs.test.helpers";
import { Button, IconButton } from "../primitives";
import { ToggleGroup } from "./ToggleGroup";
import { Toolbar } from "./Toolbar";

function Editor({ onLink = () => {} }: { onLink?: () => void }) {
  return (
    <Toolbar aria-label="Formatting">
      <ToggleGroup type="multiple" aria-label="Style" data-w="96">
        <ToggleGroup.Item value="bold" icon={<Bold />} label="Bold" />
        <ToggleGroup.Item value="italic" icon={<Italic />} label="Italic" />
        <ToggleGroup.Item value="underline" icon={<Underline />} label="Underline" />
      </ToggleGroup>
      <Toolbar.Separator />
      <Select aria-label="Font" data-w="120" defaultValue="sans">
        <option value="sans">Sans</option>
        <option value="serif">Serif</option>
      </Select>
      <Toolbar.Separator />
      <ToggleGroup type="single" aria-label="Alignment" defaultValue="left" data-w="64">
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup>
      <Toolbar.Item
        menu={
          <DropdownMenu.Item icon={<Link />} onSelect={onLink}>
            Insert link
          </DropdownMenu.Item>
        }
      >
        <IconButton label="Insert link" icon={<Link />} onClick={onLink} data-w="32" />
      </Toolbar.Item>
    </Toolbar>
  );
}

const stops = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[tabindex="0"]')];

describe("Toolbar: one tab stop, arrows between controls", () => {
  it("is a named toolbar whose controls, toggles included, share one tab stop", () => {
    render(<Editor />);
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
    expect(stops(toolbar)).toEqual([screen.getByRole("button", { name: "Bold" })]);
    // Every control is in the walk, the select and the radios too.
    for (const name of ["Italic", "Underline", "Insert link"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("tabindex", "-1");
    }
    expect(screen.getByRole("combobox", { name: "Font" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("tabindex", "-1");
  });

  it("walks every control in order with the arrows, Home and End, and wraps", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    screen.getByRole("button", { name: "Bold" }).focus();
    const walk: (string | null)[] = [];
    for (let i = 0; i < 7; i += 1) {
      await user.keyboard("{ArrowRight}");
      walk.push(document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? null);
    }
    expect(walk).toEqual(["Italic", "Underline", "Font", "Left", "Right", "Insert link", "Bold"]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Insert link" }));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Bold" }));
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Insert link" }));
  });

  it("the toolbar's arrows only move across a single group; Space checks", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    screen.getByRole("radio", { name: "Left" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Right" }));
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard(" ");
    expect(screen.getByRole("radio", { name: "Right" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "false");
  });

  it("Tab leaves and comes back to the control that last had focus", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Editor />
        <button>After</button>
      </>,
    );
    screen.getByRole("button", { name: "Bold" }).focus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "After" }));
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Underline" }));
  });

  it("a text input keeps its caret; the arrows leave it only from its edges", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Find">
        <Button variant="ghost">Previous</Button>
        <Input aria-label="Find text" defaultValue="needle" />
        <Button variant="ghost">Next</Button>
      </Toolbar>,
    );
    const input = screen.getByRole("textbox", { name: "Find text" }) as HTMLInputElement;
    await user.click(input);
    input.setSelectionRange(3, 3);
    await user.keyboard("{ArrowLeft}{Home}");
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Previous" }));
  });

  it("vertical: Up and Down move, and a separator lies across", async () => {
    const user = userEvent.setup();
    render(
      <Toolbar aria-label="Tools" orientation="vertical">
        <IconButton label="Undo" icon={<Undo />} />
        <Toolbar.Separator />
        <IconButton label="Redo" icon={<Redo />} />
      </Toolbar>,
    );
    expect(screen.getByRole("toolbar")).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
    screen.getByRole("button", { name: "Undo" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Redo" }));
    // A vertical toolbar never overflows: there is no More.
    expect(screen.queryByRole("button", { name: "More", hidden: true })).toBeNull();
  });

  it("does not print by default; a caller can override", () => {
    const { rerender } = render(<Toolbar aria-label="A" />);
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-print", "hide");
    rerender(<Toolbar aria-label="A" data-print="avoid-break" />);
    expect(screen.getByRole("toolbar")).toHaveAttribute("data-print", "avoid-break");
  });
});

/*
 * jsdom lays nothing out, so the overflow tests give the toolbar a width and
 * each unit the width its control declares in `data-w` (separators 1px, More
 * 32px). The real layout is the toolbar-layout browser check's.
 */
describe("Toolbar: overflow into More", () => {
  let width = 1000;
  let popover: ReturnType<typeof stubPopover>;
  const rect = (w: number) => ({ width: w, height: 32, top: 0, left: 0, right: w, bottom: 32, x: 0, y: 0, toJSON: () => ({}) });

  beforeEach(() => {
    popover = stubPopover();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute("data-toolbar-more")) return rect(32) as DOMRect;
      if (this.hasAttribute("data-toolbar-unit")) {
        if (this.dataset.kind === "separator") return rect(1) as DOMRect;
        const declared = this.querySelector("[data-w]")?.getAttribute("data-w");
        return rect(Number(declared ?? 0)) as DOMRect;
      }
      return rect(0) as DOMRect;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("role") === "toolbar" ? width : 0;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    popover.restore();
  });

  const unitStates = () =>
    [...screen.getByRole("toolbar").querySelectorAll<HTMLElement>("[data-toolbar-unit]")].map((u) =>
      u.hasAttribute("data-overflowed") ? "out" : "in",
    );

  it("everything fits: no More, nothing moved", () => {
    width = 1000;
    render(<Editor />);
    expect(unitStates()).toEqual(["in", "in", "in", "in", "in", "in"]);
    // More is laid out (to be measured) but parked: inert, unseen, out of the Tab order.
    const more = screen.getByRole("toolbar").querySelector("[data-toolbar-more]");
    expect(more).toHaveAttribute("inert");
    expect(more).toHaveAttribute("data-overflowed");
    expect(screen.getByRole("button", { name: "More" })).toHaveAttribute("tabindex", "-1");
  });

  it("narrow: trailing units move into More in order; the pinned select stays", async () => {
    const user = userEvent.setup();
    // Style 96 + sep 1 + Font 120 + More 32 = 249: the alignment and the link move,
    // and the separator before them would trail, so it goes too.
    width = 250;
    render(<Editor />);
    expect(unitStates()).toEqual(["in", "in", "in", "out", "out", "out"]);
    // Moved controls are inert (out of the walk and the accessibility tree); More is not.
    for (const moved of [screen.getByRole("radio", { name: "Left" }), screen.getByRole("button", { name: "Insert link" })]) {
      expect(moved.closest("[inert]")).not.toBeNull();
      expect(moved).toHaveAttribute("tabindex", "-1");
    }
    expect(screen.getByRole("button", { name: "More" }).closest("[inert]")).toBeNull();

    await user.click(screen.getByRole("button", { name: "More" }));
    const menu = screen.getByRole("menu", { hidden: true });
    // Named by its trigger.
    expect(menu).toHaveAttribute("aria-labelledby", screen.getByRole("button", { name: "More" }).id);
    const items = [...menu.querySelectorAll('[role^="menuitem"]')].map((i) => `${i.getAttribute("role")}:${i.textContent}`);
    expect(items).toEqual(["menuitemradio:Left", "menuitemradio:Right", "menuitem:Insert link"]);
    expect(within(menu).getByRole("group", { name: "Alignment", hidden: true })).toBeInTheDocument();
    // The separator before them did not come along to lead the menu.
    expect(within(menu).queryAllByRole("separator", { hidden: true })).toHaveLength(0);
  });

  it("narrower still: the style toggles move too, before the alignment, as checkbox items, with a divider between", async () => {
    const user = userEvent.setup();
    // Only the select and More fit: 120 + 32 = 152.
    width = 160;
    render(<Editor />);
    expect(unitStates()).toEqual(["out", "out", "in", "out", "out", "out"]);
    await user.click(screen.getByRole("button", { name: "More" }));
    const menu = screen.getByRole("menu", { hidden: true });
    const parts = [...menu.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
      (el) => `${el.getAttribute("role")}:${el.textContent}`,
    );
    expect(parts).toEqual([
      "menuitemcheckbox:Bold",
      "menuitemcheckbox:Italic",
      "menuitemcheckbox:Underline",
      "separator:",
      "menuitemradio:Left",
      "menuitemradio:Right",
      "menuitem:Insert link",
    ]);
  });

  it("the menu and the bar share an uncontrolled group's value", async () => {
    const user = userEvent.setup();
    width = 160;
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "More" }));
    const menu = screen.getByRole("menu", { hidden: true });
    const right = within(menu).getByRole("menuitemradio", { name: "Right", hidden: true });
    expect(right).toHaveAttribute("aria-checked", "false");
    await user.click(right);
    expect(right).toHaveAttribute("aria-checked", "true");
    await user.click(within(menu).getByRole("menuitemcheckbox", { name: "Italic", hidden: true }));

    // Widen: the bar's own toggles show what the menu chose.
    // Any render re-measures (closing the menu is one); the ResizeObserver is the browser's trigger.
    width = 1000;
    await user.keyboard("{Escape}");
    expect(screen.getByRole("radio", { name: "Right" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Left" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Italic" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a moved item's menu form does what the control did", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    width = 250;
    render(<Editor onLink={onLink} />);
    await user.click(screen.getByRole("button", { name: "More" }));
    await user.click(screen.getByRole("menuitem", { name: "Insert link", hidden: true }));
    expect(onLink).toHaveBeenCalledTimes(1);
  });

  it("a focused control that leaves the bar hands focus to More", () => {
    width = 1000;
    const { rerender } = render(<Editor />);
    screen.getByRole("button", { name: "Insert link" }).focus();
    width = 250;
    // Any render re-measures; the ResizeObserver is the browser's trigger.
    act(() => rerender(<Editor />));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "More" }));
  });

  it("names More from its labels, through a LocaleProvider or the instance", () => {
    width = 160;
    const { rerender } = render(
      <LocaleProvider labels={{ Toolbar: { more: "Mehr" } }}>
        <Editor />
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Mehr" })).toBeInTheDocument();
    rerender(
      <LocaleProvider labels={{ Toolbar: { more: "Mehr" } }}>
        <Toolbar aria-label="X" labels={{ more: "Plus" }}>
          <ToggleGroup type="multiple" aria-label="Style" data-w="400">
            <ToggleGroup.Item value="b">B</ToggleGroup.Item>
          </ToggleGroup>
        </Toolbar>
      </LocaleProvider>,
    );
    expect(screen.getByRole("button", { name: "Plus" })).toBeInTheDocument();
  });

  it("overflow={false} keeps everything in the bar", () => {
    width = 100;
    render(
      <Toolbar aria-label="Fixed" overflow={false}>
        <ToggleGroup type="multiple" aria-label="Style" data-w="400">
          <ToggleGroup.Item value="b">B</ToggleGroup.Item>
        </ToggleGroup>
      </Toolbar>,
    );
    expect(unitStates()).toEqual(["in"]);
    expect(screen.queryByRole("button", { name: "More", hidden: true })).toBeNull();
  });
});
