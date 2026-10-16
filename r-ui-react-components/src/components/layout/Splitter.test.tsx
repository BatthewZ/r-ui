import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";
import { Splitter } from "./Splitter";

const valueOf = (el: HTMLElement) => Number(el.getAttribute("aria-valuenow"));
const growOf = (el: HTMLElement) => Number(el.style.flexGrow);

/**
 * jsdom lays nothing out: give each pane its drawn length (its share of `available`
 * px, read from the flex-grow the splitter renders) and each probe the length its
 * `inline-size` names, from `lengths`.
 */
function layOut(available: number, lengths: Record<string, number> = {}) {
  const real = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-splitter-pane")) {
      const length = (Number(this.style.flexGrow) / 100) * available;
      return DOMRect.fromRect({ width: length, height: length });
    }
    if (this.hasAttribute("data-splitter-probe")) return DOMRect.fromRect({ width: lengths[this.style.inlineSize] ?? 0, height: 0 });
    return real.call(this);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

function Mail(props: Partial<Parameters<typeof Splitter>[0]>) {
  return (
    <Splitter aria-label="Mail" defaultSizes={[20, 30, 50]} {...props}>
      <Splitter.Pane label="Folders" min={10} max={40} collapsible>
        <button type="button">Inbox</button>
      </Splitter.Pane>
      <Splitter.Pane label="Messages" min={20}>
        list
      </Splitter.Pane>
      <Splitter.Pane id="reading" min={25}>
        message
      </Splitter.Pane>
    </Splitter>
  );
}

describe("Splitter", () => {
  it("puts a named, valued separator between each pair of panes, controlling the pane it resizes", () => {
    render(<Mail />);
    const separators = screen.getAllByRole("separator");
    expect(separators).toHaveLength(2);
    const [folders, messages] = separators as [HTMLElement, HTMLElement];
    expect(folders).toHaveAccessibleName("Resize Folders");
    expect(messages).toHaveAccessibleName("Resize Messages");
    expect(folders).toHaveAttribute("aria-orientation", "vertical");
    expect(folders).toHaveAttribute("tabindex", "0");
    // Collapsible: its range starts at 0, though it cannot be open below 10; it can
    // grow to 30, where Messages reaches its 20 (before its own max of 40).
    expect(folders).toHaveAttribute("aria-valuenow", "20");
    expect(folders).toHaveAttribute("aria-valuemin", "0");
    expect(folders).toHaveAttribute("aria-valuemax", "30");
    // Messages can grow until the reading pane is at its 25.
    expect(messages).toHaveAttribute("aria-valuenow", "30");
    expect(messages).toHaveAttribute("aria-valuemin", "20");
    expect(messages).toHaveAttribute("aria-valuemax", "55");

    const panes = document.querySelectorAll<HTMLElement>("[data-splitter-pane]");
    expect([...panes].map(growOf)).toEqual([20, 30, 50]);
    expect(folders).toHaveAttribute("aria-controls", panes[0]!.id);
    expect(panes[0]!.id).not.toBe("");
    // A caller's id is kept.
    expect(panes[2]).toHaveAttribute("id", "reading");
    // In DOM order: pane, separator, pane, separator, pane.
    expect(panes[0]!.nextElementSibling).toBe(folders);
    expect(folders.nextElementSibling).toBe(panes[1]);
  });

  it("names a pane without a label by its position, and translates through the labels", () => {
    render(
      <LocaleProvider labels={{ Splitter: { resize: (pane) => `${pane} anpassen` } }}>
        <Splitter defaultSizes={[50, 50]}>
          <Splitter.Pane>a</Splitter.Pane>
          <Splitter.Pane>b</Splitter.Pane>
        </Splitter>
      </LocaleProvider>,
    );
    expect(screen.getByRole("separator")).toHaveAccessibleName("Pane 1 anpassen");
  });

  it("moves by the arrows on its axis, stops at the bounds, and Home / End jump to them", async () => {
    const user = userEvent.setup();
    const onSizesChange = vi.fn();
    render(<Mail onSizesChange={onSizesChange} />);
    const messages = screen.getAllByRole("separator")[1]!;
    messages.focus();
    await user.keyboard("{ArrowRight}");
    expect(valueOf(messages)).toBe(35);
    expect(onSizesChange).toHaveBeenLastCalledWith([20, 35, 45]);
    // The other axis belongs to the page.
    await user.keyboard("{ArrowDown}{ArrowUp}");
    expect(valueOf(messages)).toBe(35);
    await user.keyboard("{End}");
    expect(valueOf(messages)).toBe(55);
    await user.keyboard("{ArrowRight}");
    expect(valueOf(messages)).toBe(55);
    await user.keyboard("{Home}");
    expect(valueOf(messages)).toBe(20);
    await user.keyboard("{ArrowLeft}");
    expect(valueOf(messages)).toBe(20);
    // Only the two panes beside it moved.
    const panes = document.querySelectorAll<HTMLElement>("[data-splitter-pane]");
    expect([...panes].map(growOf)).toEqual([20, 20, 60]);
    // One change per press that moved something.
    expect(onSizesChange).toHaveBeenCalledTimes(3);
  });

  it("commits once per key press that changed something, for persisting", async () => {
    const user = userEvent.setup();
    const onSizesCommit = vi.fn();
    render(<Mail onSizesCommit={onSizesCommit} />);
    screen.getAllByRole("separator")[1]!.focus();
    await user.keyboard("{ArrowRight>3}");
    expect(onSizesCommit).not.toHaveBeenCalled();
    await user.keyboard("{/ArrowRight}");
    expect(onSizesCommit).toHaveBeenCalledExactlyOnceWith([20, 45, 35]);
    await user.keyboard("{End}{ArrowRight}");
    expect(onSizesCommit).toHaveBeenCalledTimes(2);
    expect(onSizesCommit).toHaveBeenLastCalledWith([20, 55, 25]);
  });

  it("mirrors the arrows in RTL", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ direction: "rtl" }}>
        <Mail />
      </div>,
    );
    const messages = screen.getAllByRole("separator")[1]!;
    messages.focus();
    await user.keyboard("{ArrowLeft}");
    expect(valueOf(messages)).toBe(35);
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(valueOf(messages)).toBe(25);
  });

  it("stacked: the separator lies flat and moves with Up and Down", async () => {
    const user = userEvent.setup();
    render(
      <Splitter orientation="vertical" defaultSizes={[60, 40]}>
        <Splitter.Pane label="Editor">e</Splitter.Pane>
        <Splitter.Pane label="Preview">p</Splitter.Pane>
      </Splitter>,
    );
    const separator = screen.getByRole("separator", { name: "Resize Editor" });
    expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    separator.focus();
    await user.keyboard("{ArrowDown}");
    expect(valueOf(separator)).toBe(65);
    await user.keyboard("{ArrowRight}{ArrowUp}{ArrowUp}");
    expect(valueOf(separator)).toBe(55);
  });

  it("Enter collapses a collapsible pane and restores it to where it was", async () => {
    const user = userEvent.setup();
    const onSizesCommit = vi.fn();
    render(<Mail onSizesCommit={onSizesCommit} />);
    const folders = screen.getAllByRole("separator")[0]!;
    const pane = document.querySelector<HTMLElement>("[data-splitter-pane]")!;
    folders.focus();
    await user.keyboard("{ArrowRight}");
    expect(valueOf(folders)).toBe(25);
    await user.keyboard("{Enter}");
    expect(valueOf(folders)).toBe(0);
    expect(pane).toHaveAttribute("data-collapsed");
    expect(pane).toHaveAttribute("inert");
    expect(growOf(pane)).toBe(0);
    // The space went to the pane beside it.
    expect(onSizesCommit).toHaveBeenLastCalledWith([0, 50, 50]);
    await user.keyboard("{Enter}");
    expect(valueOf(folders)).toBe(25);
    expect(pane).not.toHaveAttribute("data-collapsed");
    expect(pane).not.toHaveAttribute("inert");
    expect(onSizesCommit).toHaveBeenLastCalledWith([25, 25, 50]);
    expect(onSizesCommit).toHaveBeenCalledTimes(3);
  });

  it("collapses by stepping down from the minimum, and opens again at the minimum", async () => {
    const user = userEvent.setup();
    render(<Mail defaultSizes={[13, 37, 50]} />);
    const folders = screen.getAllByRole("separator")[0]!;
    folders.focus();
    await user.keyboard("{ArrowLeft}");
    expect(valueOf(folders)).toBe(10);
    await user.keyboard("{ArrowLeft}");
    expect(valueOf(folders)).toBe(0);
    await user.keyboard("{ArrowRight}");
    expect(valueOf(folders)).toBe(10);
    await user.keyboard("{Home}");
    expect(valueOf(folders)).toBe(0);
  });

  it("Enter does nothing where neither pane can collapse", async () => {
    const user = userEvent.setup();
    render(<Mail />);
    const messages = screen.getAllByRole("separator")[1]!;
    messages.focus();
    await user.keyboard("{Enter}");
    expect(valueOf(messages)).toBe(30);
  });

  it("reports and collapses the pane after it when only that one is collapsible", async () => {
    const user = userEvent.setup();
    render(
      <Splitter defaultSizes={[70, 30]}>
        <Splitter.Pane label="Editor" min={30}>
          e
        </Splitter.Pane>
        <Splitter.Pane label="Preview" min={20} collapsible>
          p
        </Splitter.Pane>
      </Splitter>,
    );
    const separator = screen.getByRole("separator", { name: "Resize Preview" });
    const preview = document.querySelectorAll<HTMLElement>("[data-splitter-pane]")[1]!;
    expect(separator).toHaveAttribute("aria-controls", preview.id);
    expect(valueOf(separator)).toBe(30);
    separator.focus();
    // Moving toward the end shrinks the pane after it.
    await user.keyboard("{ArrowRight}");
    expect(valueOf(separator)).toBe(25);
    await user.keyboard("{Enter}");
    expect(preview).toHaveAttribute("data-collapsed");
    await user.keyboard("{Enter}");
    expect(valueOf(separator)).toBe(25);
  });

  it("draws sizes outside the bounds inside them", () => {
    render(<Mail defaultSizes={[5, 15, 80]} />);
    const [folders, messages] = screen.getAllByRole("separator") as [HTMLElement, HTMLElement];
    expect(valueOf(folders)).toBe(10);
    expect(valueOf(messages)).toBe(20);
  });

  it("drags: the separator follows the pointer, stops at the bounds, and commits once on release", () => {
    layOut(1000);
    const onSizesCommit = vi.fn();
    render(<Mail onSizesCommit={onSizesCommit} />);
    const messages = screen.getAllByRole("separator")[1]!;
    fireEvent.pointerDown(messages, { button: 0, clientX: 500, pointerId: 1 });
    expect(messages).toHaveFocus();
    expect(messages).toHaveAttribute("data-resizing");
    fireEvent.pointerMove(messages, { clientX: 600, pointerId: 1 });
    expect(valueOf(messages)).toBe(40);
    fireEvent.pointerMove(messages, { clientX: 0, pointerId: 1 });
    expect(valueOf(messages)).toBe(20);
    expect(onSizesCommit).not.toHaveBeenCalled();
    fireEvent.pointerUp(messages, { pointerId: 1 });
    expect(onSizesCommit).toHaveBeenCalledExactlyOnceWith([20, 20, 60]);
    expect(messages).not.toHaveAttribute("data-resizing");
    // Released: a move no longer drags.
    fireEvent.pointerMove(messages, { clientX: 900, pointerId: 1 });
    expect(valueOf(messages)).toBe(20);
  });

  it("drags in RTL toward the left to grow the pane before it", () => {
    layOut(1000);
    render(
      <div style={{ direction: "rtl" }}>
        <Mail />
      </div>,
    );
    const messages = screen.getAllByRole("separator")[1]!;
    fireEvent.pointerDown(messages, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(messages, { clientX: 400, pointerId: 1 });
    fireEvent.pointerUp(messages, { pointerId: 1 });
    expect(valueOf(messages)).toBe(40);
  });

  it("collapses a collapsible pane dragged below half its minimum", () => {
    layOut(1000);
    render(<Mail />);
    const folders = screen.getAllByRole("separator")[0]!;
    fireEvent.pointerDown(folders, { button: 0, clientX: 200, pointerId: 1 });
    fireEvent.pointerMove(folders, { clientX: 160, pointerId: 1 });
    expect(valueOf(folders)).toBe(16);
    fireEvent.pointerMove(folders, { clientX: 60, pointerId: 1 });
    expect(valueOf(folders)).toBe(10);
    fireEvent.pointerMove(folders, { clientX: 40, pointerId: 1 });
    expect(valueOf(folders)).toBe(0);
    fireEvent.pointerUp(folders, { pointerId: 1 });
    expect(document.querySelector("[data-splitter-pane]")).toHaveAttribute("data-collapsed");
  });

  it("a double click collapses and restores, committing each", () => {
    const onSizesCommit = vi.fn();
    render(<Mail onSizesCommit={onSizesCommit} />);
    const folders = screen.getAllByRole("separator")[0]!;
    fireEvent.doubleClick(folders);
    expect(valueOf(folders)).toBe(0);
    expect(onSizesCommit).toHaveBeenCalledExactlyOnceWith([0, 50, 50]);
    fireEvent.doubleClick(folders);
    expect(valueOf(folders)).toBe(20);
    expect(onSizesCommit).toHaveBeenCalledTimes(2);
  });

  it("resolves a token bound inside the splitter at the gesture's start", async () => {
    // 220px of 1000: the token min is 22% of the space.
    layOut(1000, { "var(--COLUMN-SM)": 220 });
    const user = userEvent.setup();
    render(
      <Splitter defaultSizes={[40, 60]}>
        <Splitter.Pane label="Nav" min="var(--COLUMN-SM)">
          n
        </Splitter.Pane>
        <Splitter.Pane>m</Splitter.Pane>
      </Splitter>,
    );
    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-valuemin", "22");
    separator.focus();
    await user.keyboard("{Home}");
    expect(valueOf(separator)).toBe(22);
  });

  it("controlled: reports changes and draws only what the parent passes back", async () => {
    const user = userEvent.setup();
    const onSizesChange = vi.fn();
    function Controlled() {
      const [sizes, setSizes] = useState([50, 50]);
      return (
        <>
          <Splitter sizes={sizes} onSizesChange={onSizesChange}>
            <Splitter.Pane label="A">a</Splitter.Pane>
            <Splitter.Pane>b</Splitter.Pane>
          </Splitter>
          <button type="button" onClick={() => setSizes([30, 70])}>
            Reset
          </button>
        </>
      );
    }
    render(<Controlled />);
    const separator = screen.getByRole("separator");
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(onSizesChange).toHaveBeenCalledExactlyOnceWith([55, 45]);
    expect(valueOf(separator)).toBe(50);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(valueOf(separator)).toBe(30);
  });

  it("nests: each splitter's separators move its own panes only", async () => {
    const user = userEvent.setup();
    render(
      <Splitter defaultSizes={[30, 70]}>
        <Splitter.Pane label="Sidebar">s</Splitter.Pane>
        <Splitter.Pane label="Main">
          <Splitter orientation="vertical" defaultSizes={[50, 50]}>
            <Splitter.Pane label="Editor">e</Splitter.Pane>
            <Splitter.Pane label="Terminal">t</Splitter.Pane>
          </Splitter>
        </Splitter.Pane>
      </Splitter>,
    );
    const outer = screen.getByRole("separator", { name: "Resize Sidebar" });
    const inner = screen.getByRole("separator", { name: "Resize Editor" });
    inner.focus();
    await user.keyboard("{ArrowDown}");
    expect(valueOf(inner)).toBe(55);
    expect(valueOf(outer)).toBe(30);
    outer.focus();
    await user.keyboard("{ArrowRight}");
    expect(valueOf(outer)).toBe(35);
    expect(valueOf(inner)).toBe(55);
  });
});
