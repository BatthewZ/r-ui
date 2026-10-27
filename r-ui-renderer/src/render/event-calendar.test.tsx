// West of Greenwich before any local Date is built: a calendar day must not move a day.
process.env.TZ = "America/New_York";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ViewSpec } from "../spec/types";
import { validateViewSpec } from "../spec/validate";
import { ViewRenderer } from "../ViewRenderer";

/** A week in a document, its picked range in document state and back in `selection`. */
const PICKING: ViewSpec = {
  version: 2,
  title: "Room bookings",
  state: { pick: null },
  root: {
    component: "Stack",
    children: [
      {
        component: "EventCalendar",
        props: {
          "aria-label": "Room 4.12",
          events: [],
          now: "2026-10-15T10:40:00-04:00",
          defaultView: "week",
          defaultDate: "2026-10-15",
          scrollToHour: 9,
          selection: { $ref: "state.pick" },
          onSelectionChange: { action: "setState", payload: { path: "state.pick", value: { $ref: "event.value" } } },
        },
      },
      { component: "Stack", props: { "data-testid": "pick-start" }, children: [{ component: "Text", children: [{ $ref: "state.pick.start" }] }] },
      { component: "Stack", props: { "data-testid": "pick-end" }, children: [{ component: "Text", children: [{ $ref: "state.pick.end" }] }] },
    ],
  },
};

describe("EventCalendar in a document", () => {
  it("validates with no issue", () => {
    expect(validateViewSpec(PICKING).issues).toEqual([]);
  });

  it("picks a range into document state as ISO text, and draws it back from there on its day", async () => {
    const user = userEvent.setup();
    const { container } = render(<ViewRenderer spec={PICKING} />);
    const slots = await screen.findByRole("grid", { name: "Time slots" });
    // Nothing picked: no piece drawn.
    expect(container.querySelectorAll("[data-selection-piece]")).toHaveLength(0);
    slots.focus();
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}{Enter}");
    // The cursor starts at 09:00 on Thursday: two slots, 09:00–10:00, said as instants.
    await waitFor(() => expect(screen.getByTestId("pick-start").textContent).not.toBe(""));
    expect(new Date(screen.getByTestId("pick-start").textContent ?? "").getTime()).toBe(new Date(2026, 9, 15, 9).getTime());
    expect(new Date(screen.getByTestId("pick-end").textContent ?? "").getTime()).toBe(new Date(2026, 9, 15, 10).getTime());
    // Back through `selection` (ISO text made Dates): drawn as one piece on Thursday's column.
    const pieces = container.querySelectorAll<HTMLElement>("[data-selection-piece]");
    expect(pieces).toHaveLength(1);
    expect(pieces[0]?.style.gridColumn).toBe("5 / span 1");
  });
});
