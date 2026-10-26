import type { CalendarEvent } from "../../../../src/components/dates";

/*
 * An operations team's October 2026, as such a team keeps it: all-day windows
 * as calendar dates, everything else as local instants, some with no end.
 * In a subfolder, which the section registry does not glob.
 */

/** The demo's clock: Thursday 15 October 2026, 10:40 local. */
export const NOW = new Date(2026, 9, 15, 10, 40);

const at = (month: number, date: number, hour: number, minute = 0) => new Date(2026, month - 1, date, hour, minute);

/** The weekdays of October with a 09:30 stand-up. */
const standups: CalendarEvent[] = Array.from({ length: 31 }, (_, i) => new Date(2026, 9, i + 1))
  .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
  .map((d) => ({
    id: `standup-${d.getDate()}`,
    title: "Stand-up",
    start: at(10, d.getDate(), 9, 30),
    end: at(10, d.getDate(), 9, 45),
    slot: 1,
    category: "Platform team",
  }));

export const OPS_EVENTS: CalendarEvent[] = [
  {
    id: "maintenance",
    title: "Datacenter maintenance window",
    start: "2026-10-06",
    end: "2026-10-08",
    slot: 3,
    category: "Infrastructure",
    tone: "info",
    location: "Frankfurt DC2",
    description: "Rolling hardware replacement; expect brief failovers.",
  },
  { id: "oncall-ada", title: "On call: Ada", start: "2026-10-12", end: "2026-10-18", slot: 4, category: "On call" },
  { id: "oncall-grace", title: "On call: Grace", start: "2026-10-19", end: "2026-10-25", slot: 4, category: "On call" },
  {
    id: "freeze",
    title: "Release freeze",
    start: "2026-10-29",
    end: "2026-11-03",
    slot: 5,
    category: "Releases",
    tone: "warning",
    statusLabel: "Freeze",
  },
  { id: "offsite", title: "Company offsite", start: "2026-10-30", category: "Company" },
  ...standups,
  { id: "deploy-41", title: "Deploy api-gateway 4.1", start: at(10, 6, 14), end: at(10, 6, 14, 30), slot: 2, category: "Releases" },
  { id: "deploy-42", title: "Deploy api-gateway 4.2", start: at(10, 13, 14), end: at(10, 13, 14, 30), slot: 2, category: "Releases" },
  {
    id: "deploy-43",
    title: "Deploy api-gateway 4.3",
    start: at(10, 20, 14),
    end: at(10, 20, 14, 30),
    slot: 2,
    category: "Releases",
    tone: "error",
    statusLabel: "Rolled back",
  },
  { id: "deploy-44", title: "Deploy api-gateway 4.4", start: at(10, 27, 14), end: at(10, 27, 14, 30), slot: 2, category: "Releases" },
  // Thursday the 15th: three meetings that overlap, then a quiet afternoon.
  {
    id: "incident-review",
    title: "Incident review: checkout latency",
    start: at(10, 15, 10),
    end: at(10, 15, 11),
    slot: 1,
    category: "Platform team",
    location: "Room 4.12",
  },
  { id: "design-sync", title: "Design sync", start: at(10, 15, 10, 30), end: at(10, 15, 11, 30), slot: 6, category: "Product" },
  { id: "one-on-one", title: "1:1 with Lin", start: at(10, 15, 10, 30), end: at(10, 15, 11), category: "Personal" },
  { id: "capacity", title: "Capacity planning", start: at(10, 15, 15), end: at(10, 15, 16, 30), slot: 1, category: "Platform team" },
  // Friday night into Saturday.
  {
    id: "migration",
    title: "Database migration",
    start: at(10, 16, 23),
    end: at(10, 17, 2, 30),
    slot: 3,
    category: "Infrastructure",
    tone: "warning",
    statusLabel: "Needs sign-off",
    description: "orders-db to the new cluster; read-only during the cut-over.",
  },
  // A busy Wednesday: more than a month cell shows.
  { id: "vendor", title: "Vendor call", start: at(10, 21, 11), end: at(10, 21, 11, 30), category: "Company" },
  { id: "lunch-learn", title: "Lunch & learn: tracing", start: at(10, 21, 12), end: at(10, 21, 13), slot: 6, category: "Product" },
  { id: "interview", title: "Interview: SRE candidate", start: at(10, 21, 15), end: at(10, 21, 16), category: "Hiring" },
  { id: "retro", title: "Sprint retro", start: at(10, 21, 16), end: at(10, 21, 17), slot: 1, category: "Platform team" },
  // Nothing but a title and a time: the slimmest row an agenda draws.
  { id: "early-close", title: "Office closes early", start: at(10, 23, 15) },
  // No end: a moment.
  { id: "cert", title: "TLS certificate expires", start: at(10, 22, 12), slot: 3, category: "Infrastructure", tone: "serious" },
  {
    id: "qbr",
    title: "Quarterly business review with the regional leadership and finance partners",
    start: at(10, 27, 13),
    end: at(10, 27, 15),
    category: "Company",
  },
  { id: "deploy-45", title: "Deploy api-gateway 4.5", start: at(11, 10, 14), end: at(11, 10, 14, 30), slot: 2, category: "Releases" },
];
