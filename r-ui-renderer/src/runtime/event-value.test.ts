import { afterEach, describe, expect, it } from "vitest";

import { readEventArgs, readEventValue, toJsonValue } from "./event-value";

const originalTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = originalTz;
});

function changeEventOn(element: HTMLElement): Event {
  const event = new Event("change");
  Object.defineProperty(event, "target", { value: element });
  return event;
}

describe("readEventValue", () => {
  it("unwraps a DOM event to its control's value, checked for a checkbox or radio", () => {
    const text = document.createElement("input");
    text.value = "hello";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.checked = false;
    const number = document.createElement("input");
    number.type = "number";
    number.value = "42";

    expect(readEventValue([changeEventOn(text)])).toBe("hello");
    expect(readEventValue([changeEventOn(box)])).toBe(true);
    expect(readEventValue([changeEventOn(radio)])).toBe(false);
    expect(readEventValue([changeEventOn(number)])).toBe(42);
  });

  it("unwraps a React synthetic event through its target", () => {
    const area = document.createElement("textarea");
    area.value = "notes";
    expect(readEventValue([{ nativeEvent: new Event("input"), target: area }])).toBe("notes");
  });

  it("reports nothing for an event whose target holds no value (a button click)", () => {
    const button = document.createElement("button");
    expect(readEventValue([changeEventOn(button)])).toBeUndefined();
  });

  it("turns Sets into arrays and drops what JSON cannot hold", () => {
    const value = readEventValue([{ keys: new Set(["a", "b"]), run: () => 1, nan: Number.NaN, node: document.body }]);
    expect(value).toEqual({ keys: ["a", "b"], nan: null });
  });

  it("converts Dates inside a record deeply (FilterBar reports date ranges by filter id)", () => {
    process.env.TZ = "America/Los_Angeles";
    const value = readEventValue([
      { when: { start: new Date(2026, 10, 2), end: new Date(2026, 10, 9), preset: "week" }, status: ["open"] },
    ]);
    expect(value).toEqual({ when: { start: "2026-11-02", end: "2026-11-09", preset: "week" }, status: ["open"] });
  });

  it("writes an instant with its offset, and a date kind as the calendar day", () => {
    process.env.TZ = "Asia/Tokyo";
    const instant = new Date(2026, 10, 2, 9, 30, 15);
    expect(readEventValue([instant])).toBe("2026-11-02T09:30:15+09:00");
    expect(readEventValue([instant], "date")).toBe("2026-11-02");
    expect(readEventValue([new Date(2026, 10, 2)], "datetime")).toBe("2026-11-02T00:00:00+09:00");
    expect(readEventValue([{ start: new Date(2026, 0, 1, 12), end: null }], "dateRange")).toEqual({ start: "2026-01-01", end: null });
  });

  it("never shifts a calendar day east of Greenwich (Date#toJSON would)", () => {
    process.env.TZ = "Pacific/Auckland";
    const day = new Date(2026, 10, 2);
    expect(JSON.stringify(day)).toContain("2026-11-01");
    expect(readEventValue([day])).toBe("2026-11-02");
  });

  it("reads checked for the checked kind", () => {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = false;
    expect(readEventValue([changeEventOn(box)], "checked")).toBe(false);
    expect(readEventValue([true], "checked")).toBe(true);
  });

  it("gives every argument as event.args, missing ones as null", () => {
    expect(readEventArgs(["a", new Set([1]), undefined])).toEqual(["a", [1], null]);
    expect(readEventValue([])).toBeUndefined();
  });

  it("drops forbidden keys and bounds a cyclic value", () => {
    const cyclic: Record<string, unknown> = { name: "x" };
    cyclic.self = cyclic;
    const parsed = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}') as unknown;
    expect(toJsonValue(parsed)).toEqual({ ok: 1 });
    expect(() => toJsonValue(cyclic)).not.toThrow();
  });
});
