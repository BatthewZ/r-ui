import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActivityFeed, Timeline, type TimelineEvent } from "./Timeline";

const NOW = new Date(2026, 9, 15, 12, 0);
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);

const EVENTS: TimelineEvent[] = [
  { id: "a", time: at(14, 9), title: "Deploy started", actor: "Jon Tate" },
  { id: "b", time: at(15, 11, 55), title: "Elevated 5xx on checkout", tone: "error", actor: { name: "Mia Rossi" } },
  { id: "c", time: at(15, 8), title: "Certificate renewed", tone: "success", statusLabel: "Renewed" },
  { id: "d", time: at(14, 18), title: "Note added" },
];

const items = () => screen.getAllByRole("listitem");
const titles = () => items().map((li) => li.querySelector("[id]")?.textContent);

describe("Timeline", () => {
  it("is an ordered list per local day, each named by its sticky day header", () => {
    render(<Timeline events={EVENTS} now={NOW} locale="en" />);
    const lists = screen.getAllByRole("list");
    expect(lists.map((l) => l.tagName)).toEqual(["OL", "OL"]);
    expect(screen.getByRole("list", { name: "Today" })).toBeInTheDocument();
    const yesterday = screen.getByRole("list", { name: "Yesterday" });
    expect(within(yesterday).getAllByRole("listitem")).toHaveLength(2);
    const header = screen.getByText("Today").closest("[data-timeline-day]");
    expect(header).toHaveClass("sticky", "top-0", "z-raised");
    expect(screen.getByText("Today")).toHaveAttribute("datetime", "2026-10-15");
  });

  it("orders newest first by default, oldest first on request, groups following", () => {
    const { rerender } = render(<Timeline events={EVENTS} now={NOW} locale="en" />);
    expect(titles()).toEqual(["Elevated 5xx on checkout", "Certificate renewed", "Note added", "Deploy started"]);
    rerender(<Timeline events={EVENTS} now={NOW} locale="en" order="oldest-first" />);
    expect(titles()).toEqual(["Deploy started", "Note added", "Certificate renewed", "Elevated 5xx on checkout"]);
    expect(screen.getAllByRole("list").map((l) => l.getAttribute("aria-labelledby") && document.getElementById(l.getAttribute("aria-labelledby") ?? "")?.textContent)).toEqual(["Yesterday", "Today"]);
  });

  it("writes every time as <time datetime>, relative by default, with the full reading on keyboard focus", async () => {
    render(<Timeline events={EVENTS} now={NOW} locale="en" />);
    const time = screen.getByText("5 minutes ago");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", at(15, 11, 55).toISOString());
    await userEvent.tab();
    expect(time).toHaveFocus();
    expect(time).toHaveAccessibleDescription(/Thursday, October 15, 2026/);
    expect(screen.getAllByRole("listitem").every((li) => li.querySelector("time[datetime]"))).toBe(true);
  });

  it("shows the time of day under a day header in absolute mode, and the date too without headers", () => {
    const { rerender } = render(<Timeline events={EVENTS} now={NOW} locale="en-GB" timeFormat="absolute" />);
    expect(screen.getByText("11:55")).toHaveAttribute("datetime", at(15, 11, 55).toISOString());
    rerender(<Timeline events={EVENTS} now={NOW} locale="en-GB" timeFormat="absolute" groupByDay={false} label="Audit log" />);
    expect(screen.getByText("15 Oct 2026, 11:55")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Audit log" })).toBeInTheDocument();
    expect(screen.queryByText("Today")).toBeNull();
  });

  it("reads a future event as future", () => {
    render(<Timeline events={[{ id: "f", time: at(17, 12), title: "Maintenance window" }]} now={NOW} locale="en" />);
    expect(screen.getByText("in 2 days")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Sat, Oct 17/ })).toBeInTheDocument();
  });

  it("draws a status as a toned mark with its glyph AND a visible word; a stateless event as a dot with no word", () => {
    render(<Timeline events={EVENTS} now={NOW} locale="en" />);
    const [error, renewed, note] = items();
    const errorMark = error?.querySelector("[data-timeline-mark]");
    expect(errorMark).toHaveClass("bg-status-error-bg", "text-status-error");
    expect(errorMark?.querySelector("svg")).not.toBeNull();
    expect(within(error as HTMLElement).getByText("Error")).toHaveClass("text-fg-error");
    // The caller's word wins over the tone's.
    expect(within(renewed as HTMLElement).getByText("Renewed")).toBeInTheDocument();
    expect(within(renewed as HTMLElement).queryByText("Success")).toBeNull();
    expect(note?.querySelector("[data-timeline-mark] svg")).toBeNull();
    expect(note?.querySelector(".r-data-timeline-dot")).not.toBeNull();
    expect(note?.querySelector("[data-timeline-status]")).toBeNull();
  });

  it("shows the actor's name with a decorative avatar, and nothing for a missing or blank actor", () => {
    render(
      <Timeline
        now={NOW}
        events={[
          { id: "1", time: at(15, 9), title: "With actor", actor: { name: "Mia Rossi" } },
          { id: "2", time: at(15, 8), title: "No actor" },
          { id: "3", time: at(15, 7), title: "Blank actor", actor: "  " },
        ]}
      />,
    );
    const [withActor, none, blank] = items();
    expect(within(withActor as HTMLElement).getByText("Mia Rossi")).toBeInTheDocument();
    expect(withActor?.querySelector(".r-primitives-avatar")).toHaveAttribute("aria-hidden", "true");
    expect(none?.querySelector(".r-primitives-avatar")).toBeNull();
    expect(blank?.querySelector(".r-primitives-avatar")).toBeNull();
  });

  it("renders a missing time as — in a last 'Date unknown' group", () => {
    render(
      <Timeline
        now={NOW}
        locale="en"
        events={[
          { id: "x", time: "garbage", title: "Imported row" },
          { id: "y", time: at(15, 9), title: "Real event" },
        ]}
      />,
    );
    const lists = screen.getAllByRole("list");
    expect(lists[1]).toHaveAccessibleName("Date unknown");
    expect(within(lists[1] as HTMLElement).getByText("—")).toBeInTheDocument();
    expect(lists[1]?.querySelector("time")).toBeNull();
  });

  it("renders an epoch number outside the Date range as a missing time instead of throwing", () => {
    render(
      <Timeline
        now={NOW}
        locale="en"
        events={[
          { id: "ns", time: 1.7e18, title: "Nanosecond stamp" },
          { id: "ok", time: at(15, 9), title: "Real event" },
        ]}
      />,
    );
    const lists = screen.getAllByRole("list");
    expect(lists[0]).toHaveAccessibleName("Today");
    expect(lists[1]).toHaveAccessibleName("Date unknown");
    expect(within(lists[1] as HTMLElement).getByText("Nanosecond stamp")).toBeInTheDocument();
    expect(within(lists[1] as HTMLElement).getByText("—")).toBeInTheDocument();
  });

  it("uses headings for day headers only when given a level", () => {
    const { rerender } = render(<Timeline events={EVENTS} now={NOW} locale="en" />);
    expect(screen.queryAllByRole("heading")).toHaveLength(0);
    rerender(<Timeline events={EVENTS} now={NOW} locale="en" headingLevel={3} />);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Today", "Yesterday"]);
  });

  it("is a named, focusable scroll region only when scrollable", () => {
    const { rerender } = render(<Timeline events={EVENTS} now={NOW} label="Deploy history" />);
    expect(screen.queryByRole("region")).toBeNull();
    rerender(<Timeline events={EVENTS} now={NOW} label="Deploy history" scrollable />);
    const region = screen.getByRole("region", { name: "Deploy history" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("overflow-y-auto");
  });

  it("names an unlabelled scroll region from labels.region", () => {
    const { rerender } = render(<Timeline events={EVENTS} now={NOW} scrollable />);
    expect(screen.getByRole("region", { name: "Timeline" })).toBeInTheDocument();
    rerender(<Timeline events={EVENTS} now={NOW} scrollable labels={{ region: "Chronologie" }} />);
    expect(screen.getByRole("region", { name: "Chronologie" })).toBeInTheDocument();
  });

  it("shows an empty state for no events, and one item with no connector issue", () => {
    const { rerender } = render(<Timeline events={[]} now={NOW} />);
    expect(screen.getByText("No events yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
    rerender(<Timeline events={[]} now={NOW} empty={<p>Nothing deployed</p>} />);
    expect(screen.getByText("Nothing deployed")).toBeInTheDocument();
    rerender(<Timeline events={EVENTS.slice(0, 1)} now={NOW} />);
    expect(items()).toHaveLength(1);
  });

  it("announces one status while loading and hides the skeleton rows", () => {
    render(<Timeline events={EVENTS} now={NOW} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading events");
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText("Elevated 5xx on checkout")).toBeNull();
    expect(document.querySelector("[data-timeline]")).toHaveAttribute("aria-busy", "true");
  });

  it("pages locally, then focuses the first new event once the button is gone", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 5 }, (_, i): TimelineEvent => ({ id: `e${i}`, time: at(15, 10 - i), title: `Event ${i}` }));
    render(<Timeline events={many} now={NOW} pageSize={2} />);
    expect(items()).toHaveLength(2);
    const more = screen.getByRole("button", { name: "Show more" });
    expect(more.closest("[data-print~='hide']")).not.toBeNull();
    await user.click(more);
    expect(items()).toHaveLength(4);
    expect(more).toHaveFocus();
    await user.click(more);
    expect(items()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(items()[4]).toHaveFocus();
    expect(items()[4]).toHaveTextContent("Event 4");
  });

  it("asks for more exactly once per press after the local pages, busy while loading", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const { rerender } = render(<Timeline events={EVENTS} now={NOW} hasMore onLoadMore={onLoadMore} />);
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<Timeline events={EVENTS} now={NOW} hasMore onLoadMore={onLoadMore} loadingMore />);
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-busy", "true");
    expect(document.querySelector("[data-timeline]")).toHaveAttribute("aria-busy", "true");
    // Without a handler, `hasMore` alone shows no dead button.
    rerender(<Timeline events={EVENTS} now={NOW} hasMore />);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("with pageSize, shows the events a remote press loaded once they land", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    const page = (from: number) =>
      Array.from({ length: 2 }, (_, i): TimelineEvent => ({ id: `r${from + i}`, time: at(15, 10 - from - i), title: `Remote ${from + i}` }));
    const first = page(0);
    const { rerender } = render(<Timeline events={first} now={NOW} pageSize={2} hasMore onLoadMore={onLoadMore} />);
    expect(items()).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
    rerender(<Timeline events={[...first, ...page(2)]} now={NOW} pageSize={2} onLoadMore={onLoadMore} />);
    expect(items().map((li) => li.querySelector("[id]")?.textContent)).toEqual(["Remote 0", "Remote 1", "Remote 2", "Remote 3"]);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(items()[2]).toHaveFocus();
  });

  describe("long descriptions", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });
    const overflow = (scroll: number, client: number) => {
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(scroll);
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(client);
    };
    const event: TimelineEvent = { id: "l", time: at(15, 9), title: "Postmortem", description: "A long story." };

    it("offers a toggle only when the clamped text runs over, described by its event's title", async () => {
      const user = userEvent.setup();
      overflow(120, 54);
      render(<Timeline events={[event]} now={NOW} />);
      const toggle = screen.getByRole("button", { name: "Read more" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAccessibleDescription("Postmortem");
      const text = screen.getByText("A long story.");
      expect(toggle).toHaveAttribute("aria-controls", text.id);
      expect(text).toHaveAttribute("data-clamped");
      await user.click(toggle);
      expect(screen.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true");
      expect(text).not.toHaveAttribute("data-clamped");
    });

    it("shows no toggle for text that fits", () => {
      overflow(54, 54);
      render(<Timeline events={[event]} now={NOW} />);
      expect(screen.getByText("A long story.")).toHaveAttribute("data-clamped");
      expect(screen.queryByRole("button")).toBeNull();
    });
  });

  it("forwards ref, className and props to the root, behind the caller's class", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(<Timeline events={EVENTS} now={NOW} ref={ref} className="mt-r2" data-testid="tl" />);
    expect(ref.current).toBe(screen.getByTestId("tl"));
    expect(ref.current).toHaveClass("flex", "mt-r2")
    expect(ref.current).toHaveAttribute("data-timeline");
  });
});

describe("ActivityFeed", () => {
  it("is a Timeline whose titles read actor, verb, object", () => {
    render(
      <ActivityFeed
        now={NOW}
        locale="en"
        items={[{ id: "1", time: at(15, 11), actor: "Mia Rossi", verb: "merged", object: "PR 482", tone: "success" }]}
      />,
    );
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent(/Mia Rossi\s*merged\s*PR 482/);
    expect(screen.getByRole("list", { name: "Today" })).toBeInTheDocument();
    // The actor is in the sentence, not repeated in the meta line.
    expect(within(item).getAllByText("Mia Rossi")).toHaveLength(1);
    expect(within(item).getByText("Success")).toBeInTheDocument();
  });
});
