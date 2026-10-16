import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../../util/locale";

import { Kanban, type KanbanMove } from "./Kanban";

interface Ticket {
  id: string;
  columnId: string;
  title: string;
}

const COLUMNS = [
  { id: "todo", title: "To do", limit: 3 },
  { id: "doing", title: "Doing", limit: 2 },
  { id: "done", title: "Done" },
];
const TICKETS: Ticket[] = [
  { id: "a", columnId: "todo", title: "Alpha" },
  { id: "b", columnId: "todo", title: "Bravo" },
  { id: "c", columnId: "doing", title: "Charlie" },
  { id: "d", columnId: "doing", title: "Delta" },
];

type BoardProps = Partial<ComponentProps<typeof Kanban<Ticket>>> & { onMove?: (next: Ticket[], move: KanbanMove) => void };

/** A controlled board, as a caller writes one: the value applies every move. */
function Board({ onMove, value: initial = TICKETS, ...props }: BoardProps) {
  const [value, setValue] = useState<readonly Ticket[]>(initial);
  return (
    <Kanban<Ticket>
      aria-label="Tickets"
      columns={COLUMNS}
      value={value}
      onValueChange={(next, move) => {
        onMove?.(next, move);
        setValue(next);
      }}
      cardLabel={(t) => t.title}
      renderCard={(t) => (
        <>
          <span>{t.title}</span> <a href={`#/t/${t.id}`}>Open {t.title}</a>
        </>
      )}
      {...props}
    />
  );
}

const card = (title: string) => screen.getByText(title, { selector: "[data-kanban-card] > span" }).closest("li") as HTMLElement;
const status = () => document.querySelector("[data-kanban-status]")?.textContent;
const column = (name: RegExp) => screen.getByRole("group", { name });
const titlesIn = (name: RegExp) =>
  within(column(name))
    .queryAllByRole("listitem")
    .map((li) => li.querySelector("span")?.textContent);

afterEach(() => {
  vi.useRealTimers();
});

describe("Kanban: structure", () => {
  it("names each column with its count and limit, lists its cards, and marks an empty one", () => {
    render(<Board value={[...TICKETS, { id: "e", columnId: "doing", title: "Echo" }]} />);
    expect(screen.getByRole("group", { name: "Tickets" })).toBeInTheDocument();
    expect(column(/^To do 2 cards, limit 3$/)).toBeInTheDocument();
    // Over its limit: the name says so, and so does a visible mark (not colour alone).
    const doing = column(/^Doing 3 cards, limit 2 Over limit$/);
    expect(doing).toHaveAttribute("data-over-limit");
    expect(within(doing).getByText("Over limit")).toBeVisible();
    expect(within(doing).getByText("3 / 2")).toBeInTheDocument();
    expect(titlesIn(/^Doing/)).toEqual(["Charlie", "Delta", "Echo"]);
    const done = column(/^Done 0 cards$/);
    expect(within(done).getByText("No cards")).toBeInTheDocument();
    expect(column(/^To do/)).not.toHaveAttribute("data-over-limit");
  });

  it("makes every card a tab stop described by the instructions; links inside stay links", async () => {
    const user = userEvent.setup();
    render(<Board />);
    const alpha = card("Alpha");
    await user.tab();
    expect(alpha).toHaveFocus();
    expect(alpha).toHaveAccessibleDescription(/Press Space or Enter to pick up this card/);
    await user.tab();
    expect(screen.getByRole("link", { name: "Open Alpha" })).toHaveFocus();
    // Enter on the link is the link's: nothing is picked up.
    await user.keyboard("{Enter}");
    expect(alpha).not.toHaveAttribute("data-drag-source");
    expect(status()).toBe("");
  });

  it("says it is loading, with placeholders and no cards to move", () => {
    render(<Board loading />);
    expect(screen.getByRole("group", { name: "Tickets" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Loading cards");
    expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  });
});

describe("Kanban: keyboard", () => {
  it("picks up, moves within and across columns, drops once with the move, and keeps focus on the card", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    card("Alpha").focus();
    await user.keyboard(" ");
    expect(status()).toBe("Picked up Alpha. To do, position 1 of 2.");
    expect(card("Alpha")).toHaveAttribute("data-drag-source");
    await user.keyboard("{ArrowDown}");
    expect(status()).toBe("Moved to To do, position 2 of 2.");
    // Past the end nothing moves (and nothing new is said).
    await user.keyboard("{ArrowDown}");
    expect(status()).toBe("Moved to To do, position 2 of 2.");
    await user.keyboard("{ArrowRight}");
    expect(status()).toBe("Moved to Doing, position 2 of 3. Doing is over its limit: 3 of 2.");
    expect(column(/^Doing/)).toHaveAttribute("data-drop-target");
    expect(column(/^Doing/)).toHaveAttribute("data-drop-over-limit");
    await user.keyboard("{ArrowUp}");
    expect(status()).toBe("Moved to Doing, position 1 of 3. Doing is over its limit: 3 of 2.");
    expect(onMove).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[1]).toEqual({ id: "a", from: { column: "todo", index: 0 }, to: { column: "doing", index: 0 } });
    expect(status()).toBe("Dropped Alpha in Doing, position 1 of 3. Doing is over its limit: 3 of 2.");
    expect(titlesIn(/^Doing/)).toEqual(["Alpha", "Charlie", "Delta"]);
    expect(titlesIn(/^To do/)).toEqual(["Bravo"]);
    // The card re-rendered in another list; focus followed it.
    expect(card("Alpha")).toHaveFocus();
    expect(card("Alpha")).not.toHaveAttribute("data-drag-source");
  });

  it("Home and End go to the column's ends; Escape cancels and puts nothing back through onValueChange", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    card("Delta").focus();
    await user.keyboard("{Enter}");
    expect(status()).toBe("Picked up Delta. Doing, position 2 of 2.");
    await user.keyboard("{Home}");
    expect(status()).toBe("Moved to Doing, position 1 of 2.");
    await user.keyboard("{ArrowLeft}{End}");
    expect(status()).toBe("Moved to To do, position 3 of 3.");
    await user.keyboard("{Escape}");
    expect(status()).toBe("Cancelled. Delta is back in Doing, position 2 of 2.");
    expect(onMove).not.toHaveBeenCalled();
    expect(card("Delta")).not.toHaveAttribute("data-drag-source");
    expect(card("Delta")).toHaveFocus();
    expect(titlesIn(/^Doing/)).toEqual(["Charlie", "Delta"]);
  });

  it("dropping where it started calls nothing", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    card("Bravo").focus();
    await user.keyboard(" ");
    await user.keyboard("{ArrowUp}{ArrowDown}");
    await user.keyboard(" ");
    expect(onMove).not.toHaveBeenCalled();
    expect(status()).toBe("Dropped Bravo in To do, position 2 of 2.");
    expect(card("Bravo")).not.toHaveAttribute("data-drag-source");
  });

  it("leaving the card cancels the move", async () => {
    const user = userEvent.setup();
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    card("Alpha").focus();
    await user.keyboard(" {ArrowRight}");
    await user.tab();
    expect(status()).toBe("Cancelled. Alpha is back in To do, position 1 of 2.");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("mirrors Left and Right right to left", async () => {
    const user = userEvent.setup();
    render(
      <div style={{ direction: "rtl" }}>
        <Board />
      </div>,
    );
    card("Alpha").focus();
    await user.keyboard(" {ArrowLeft}");
    expect(status()).toBe("Moved to Doing, position 1 of 3. Doing is over its limit: 3 of 2.");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(status()).toBe("Moved to To do, position 1 of 2.");
  });

  it("does nothing while disabled, and the cards are not described as movable", async () => {
    const user = userEvent.setup();
    render(<Board disabled />);
    card("Alpha").focus();
    await user.keyboard(" ");
    expect(status()).toBe("");
    expect(card("Alpha")).not.toHaveAttribute("aria-describedby");
  });

  it("reads its words from a LocaleProvider, under the instance's own", async () => {
    const user = userEvent.setup();
    render(
      <LocaleProvider labels={{ Kanban: { moved: (c, p, t) => `${c}: ${p}/${t}`, empty: "Leer" } }}>
        <Board labels={{ empty: "Nichts" }} />
      </LocaleProvider>,
    );
    expect(within(column(/^Done/)).getByText("Nichts")).toBeInTheDocument();
    card("Alpha").focus();
    await user.keyboard(" {ArrowDown}");
    expect(status()).toBe("To do: 2/2");
  });
});

describe("Kanban: collapsible columns", () => {
  it("folds a column, which still takes a card at its end", async () => {
    const user = userEvent.setup();
    const onCollapsedChange = vi.fn();
    const onMove = vi.fn();
    render(<Board collapsible onCollapsedChange={onCollapsedChange} onMove={onMove} value={[...TICKETS, { id: "z", columnId: "done", title: "Zulu" }]} />);
    const fold = screen.getByRole("button", { name: "Collapse Done" });
    expect(fold).toHaveAttribute("aria-expanded", "true");
    await user.click(fold);
    expect(onCollapsedChange).toHaveBeenCalledTimes(1);
    expect(onCollapsedChange).toHaveBeenLastCalledWith(["done"]);
    const unfold = screen.getByRole("button", { name: "Expand Done" });
    expect(unfold).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(unfold.getAttribute("aria-controls") ?? "")).not.toBeVisible();
    expect(screen.queryByText("Zulu")).not.toBeVisible();

    card("Delta").focus();
    await user.keyboard(" {ArrowRight}");
    expect(status()).toBe("Moved to Done, position 2 of 2.");
    // In a folded column there is nowhere else to go.
    await user.keyboard("{Home}");
    expect(status()).toBe("Moved to Done, position 2 of 2.");
    await user.keyboard("{Enter}");
    expect(onMove.mock.calls[0]?.[1]).toEqual({ id: "d", from: { column: "doing", index: 1 }, to: { column: "done", index: 1 } });
  });

  it("starts folded from defaultCollapsed, and only when collapsible", () => {
    const { unmount } = render(<Board collapsible defaultCollapsed={["todo"]} />);
    expect(screen.getByRole("button", { name: "Expand To do" })).toBeInTheDocument();
    expect(screen.queryByText("Alpha")).not.toBeVisible();
    unmount();
    render(<Board defaultCollapsed={["todo"]} />);
    expect(screen.queryByRole("button", { name: /To do/ })).not.toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeVisible();
  });
});

/** Lays out two columns side by side, cards 50px tall every 60px, so the pointer maths has geometry. */
function layOut() {
  const rect = (left: number, top: number, width: number, height: number) => () =>
    ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
  document.querySelectorAll<HTMLElement>("[data-kanban-column]").forEach((col, c) => {
    col.getBoundingClientRect = rect(c * 220, 0, 200, 600);
    col.querySelectorAll<HTMLElement>("[data-kanban-card]").forEach((li, i) => {
      li.getBoundingClientRect = rect(c * 220 + 10, 50 + i * 60, 180, 50);
    });
  });
}

const mouse = { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0 };

describe("Kanban: pointer", () => {
  it("a press that moves past the threshold drags; the drop updates the value once, at the pointer's place", async () => {
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    layOut();
    fireEvent.pointerDown(card("Alpha"), { ...mouse, clientX: 100, clientY: 75 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 101, clientY: 76 });
    expect(card("Alpha")).not.toHaveAttribute("data-drag-source");
    fireEvent.pointerMove(window, { ...mouse, clientX: 300, clientY: 120 });
    expect(card("Alpha")).toHaveAttribute("data-drag-source");
    expect(status()).toBe("Picked up Alpha. To do, position 1 of 2.");
    expect(document.querySelector(".r-boards-kanban-preview")).toBeInTheDocument();
    // Between Charlie (mid 75) and Delta (mid 135).
    expect(column(/^Doing/)).toHaveAttribute("data-drop-target");
    expect(column(/^Doing/).querySelector(".r-boards-kanban-indicator")).toBeInTheDocument();
    fireEvent.pointerMove(window, { ...mouse, clientX: 310, clientY: 125 });
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.pointerUp(window, { ...mouse, clientX: 310, clientY: 125 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[1]).toEqual({ id: "a", from: { column: "todo", index: 0 }, to: { column: "doing", index: 1 } });
    expect(status()).toBe("Dropped Alpha in Doing, position 2 of 3. Doing is over its limit: 3 of 2.");
    expect(titlesIn(/^Doing/)).toEqual(["Charlie", "Alpha", "Delta"]);
    expect(document.querySelector(".r-boards-kanban-preview")).not.toBeInTheDocument();
    // A later move is no drag.
    fireEvent.pointerMove(window, { ...mouse, clientX: 50, clientY: 50 });
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it("the release's click after a drag is swallowed; a plain click on a link inside still works", async () => {
    const clicked = vi.fn((event: MouseEvent) => event.preventDefault());
    render(<Board />);
    layOut();
    document.addEventListener("click", clicked);
    const link = screen.getByRole("link", { name: "Open Bravo" });
    fireEvent.pointerDown(link, { ...mouse, clientX: 100, clientY: 135 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 100, clientY: 400 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 100, clientY: 400 });
    fireEvent.click(link);
    expect(clicked).toHaveBeenCalledTimes(0);
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    fireEvent.pointerDown(link, { ...mouse, clientX: 100, clientY: 135 });
    fireEvent.pointerUp(window, { ...mouse, clientX: 100, clientY: 135 });
    fireEvent.click(link);
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(status()).toBe("Dropped Bravo in To do, position 2 of 2.");
    document.removeEventListener("click", clicked);
  });

  it("Escape cancels a pointer drag: the release changes nothing", () => {
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    layOut();
    fireEvent.pointerDown(card("Alpha"), { ...mouse, clientX: 100, clientY: 75 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 300, clientY: 300 });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(status()).toBe("Cancelled. Alpha is back in To do, position 1 of 2.");
    expect(card("Alpha")).not.toHaveAttribute("data-drag-source");
    fireEvent.pointerUp(window, { ...mouse, clientX: 300, clientY: 300 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("a press inside a form control is the control's", () => {
    render(<Board renderCard={(t) => <input aria-label={`Note for ${t.title}`} />} />);
    layOut();
    const input = screen.getByRole("textbox", { name: "Note for Alpha" });
    fireEvent.pointerDown(input, { ...mouse, clientX: 100, clientY: 75 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 300, clientY: 300 });
    expect(input.closest("li")).not.toHaveAttribute("data-drag-source");
  });

  it("touch: a held touch picks the card up; one that moves first is a scroll", () => {
    vi.useFakeTimers();
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    layOut();
    const touch = { pointerId: 7, pointerType: "touch", isPrimary: true, button: 0 };
    fireEvent.pointerDown(card("Bravo"), { ...touch, clientX: 100, clientY: 135 });
    fireEvent.pointerMove(window, { ...touch, clientX: 100, clientY: 160 });
    act(() => vi.advanceTimersByTime(600));
    expect(card("Bravo")).not.toHaveAttribute("data-drag-source");
    fireEvent.pointerCancel(window, touch);

    fireEvent.pointerDown(card("Bravo"), { ...touch, clientX: 100, clientY: 135 });
    act(() => vi.advanceTimersByTime(399));
    expect(card("Bravo")).not.toHaveAttribute("data-drag-source");
    act(() => vi.advanceTimersByTime(1));
    expect(card("Bravo")).toHaveAttribute("data-drag-source");
    expect(status()).toBe("Picked up Bravo. To do, position 2 of 2.");
    fireEvent.pointerMove(window, { ...touch, clientX: 300, clientY: 20 });
    fireEvent.pointerUp(window, { ...touch, clientX: 300, clientY: 20 });
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove.mock.calls[0]?.[1]).toEqual({ id: "b", from: { column: "todo", index: 1 }, to: { column: "doing", index: 0 } });
  });

  it("a cancelled pointer (the browser took the gesture) cancels the drag", () => {
    const onMove = vi.fn();
    render(<Board onMove={onMove} />);
    layOut();
    fireEvent.pointerDown(card("Alpha"), { ...mouse, clientX: 100, clientY: 75 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 300, clientY: 300 });
    fireEvent.pointerCancel(window, mouse);
    expect(status()).toBe("Cancelled. Alpha is back in To do, position 1 of 2.");
    expect(onMove).not.toHaveBeenCalled();
  });

  it("does not drag while disabled", () => {
    render(<Board disabled />);
    layOut();
    fireEvent.pointerDown(card("Alpha"), { ...mouse, clientX: 100, clientY: 75 });
    fireEvent.pointerMove(window, { ...mouse, clientX: 300, clientY: 300 });
    expect(card("Alpha")).not.toHaveAttribute("data-drag-source");
  });
});
