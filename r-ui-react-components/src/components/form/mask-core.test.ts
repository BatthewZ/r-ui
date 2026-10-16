import { describe, expect, it } from "vitest";

import {
  applyMaskEdit,
  caretFor,
  DEFAULT_MASK_TOKENS,
  fitChars,
  formatMask,
  isNumericMask,
  maskPlaceholder,
  parseMask,
  slotCount,
} from "./mask-core";

const PHONE = parseMask("(999) 999-9999");
const PLATE = parseMask("AAA-9999", {
  ...DEFAULT_MASK_TOKENS,
  A: { test: (c) => /^[a-z]$/i.test(c), transform: (c) => c.toUpperCase() },
});

/**
 * One edit, written as a browser reports it: the text before (`|` the caret or
 * `[ ]` the selection, for the reader: the edit is read from the texts) and
 * after, with `|` at the caret.
 */
function edit(parts: ReturnType<typeof parseMask>, raw: string, before: string, after: string, forward = false) {
  const shown = before.replace(/[|[\]]/g, "");
  const next = after.replace("|", "");
  const caret = after.indexOf("|");
  // The harness reads what a browser would show for `raw`: the test's "before" must be it.
  expect(shown).toBe(formatMask(parts, raw));
  const result = applyMaskEdit(parts, { raw, shown, next, caret, forward });
  const out = formatMask(parts, result.raw);
  return { raw: result.raw, shown: `${out.slice(0, result.caret)}|${out.slice(result.caret)}` };
}

describe("parseMask / formatMask", () => {
  it("reads slots, literals and escapes", () => {
    expect(slotCount(PHONE)).toBe(10);
    expect(maskPlaceholder(PHONE)).toBe("(___) ___-____");
    const escaped = parseMask("\\9-99");
    expect(slotCount(escaped)).toBe(2);
    expect(maskPlaceholder(escaped, "#")).toBe("9-##");
    expect(isNumericMask(PHONE)).toBe(true);
    expect(isNumericMask(PLATE)).toBe(false);
  });

  it("shows the literals up to the next empty slot, and nothing for an empty value", () => {
    expect(formatMask(PHONE, "")).toBe("");
    expect(formatMask(PHONE, "5")).toBe("(5");
    expect(formatMask(PHONE, "555")).toBe("(555) ");
    expect(formatMask(PHONE, "5551234567")).toBe("(555) 123-4567");
    expect(formatMask(parseMask("99/99"), "12")).toBe("12/");
  });

  it("fits pasted text into slots, dropping what they refuse and what does not fit", () => {
    expect(fitChars(PHONE, "(555) 123-4567 ext 89")).toBe("5551234567");
    expect(fitChars(PLATE, "abc 1234")).toBe("ABC1234");
    expect(fitChars(PLATE, "1234")).toBe("");
  });
});

describe("applyMaskEdit", () => {
  it("types at the end and steps past the literals", () => {
    expect(edit(PHONE, "55", "(55|", "(555|")).toEqual({ raw: "555", shown: "(555) |" });
    expect(edit(PHONE, "555", "(555) |", "(555) 1|")).toEqual({ raw: "5551", shown: "(555) 1|" });
  });

  it("inserts mid-string and keeps the caret after the inserted character", () => {
    expect(edit(PHONE, "5551234", "(5|55) 123-4", "(59|55) 123-4")).toEqual({ raw: "59551234", shown: "(59|5) 512-34" });
  });

  it("refuses a character the slot does not take, leaving value and caret", () => {
    expect(edit(PHONE, "5551", "(55|5) 1", "(55x|5) 1")).toEqual({ raw: "5551", shown: "(55|5) 1" });
  });

  it("deletes backward and forward mid-string", () => {
    expect(edit(PHONE, "5551234", "(555) 12|3-4", "(555) 1|3-4")).toEqual({ raw: "555134", shown: "(555) 1|34-" });
    expect(edit(PHONE, "5551234", "(555) 1|23-4", "(555) 1|3-4", true)).toEqual({ raw: "555134", shown: "(555) 1|34-" });
  });

  it("Backspace over a literal deletes the slot before it; Delete over one deletes the slot after it", () => {
    expect(edit(PHONE, "5551", "(555) |1", "(555)|1")).toEqual({ raw: "551", shown: "(55|1) " });
    expect(edit(PHONE, "5551", "(555|) 1", "(555| 1", true)).toEqual({ raw: "555", shown: "(555|) " });
    expect(edit(parseMask("99/99"), "12", "12/|", "12|")).toEqual({ raw: "1", shown: "1|" });
  });

  it("pastes over a selection, filtering the pasted literals", () => {
    expect(edit(PHONE, "5551234567", "([555) 123]-4567", "(212-867|-4567")).toEqual({
      raw: "2128674567",
      shown: "(212) 867-|4567",
    });
  });

  it("refits the characters after an edit to their new slots", () => {
    // A deleted letter would pull a digit into a letter slot: the digits that no longer fit are dropped.
    expect(edit(PLATE, "ABC1234", "AB|C-1234", "A|C-1234")).toEqual({ raw: "AC", shown: "A|C" });
    expect(edit(PLATE, "AB", "AB|", "ABx|")).toEqual({ raw: "ABX", shown: "ABX-|" });
  });

  it("reads a repeated character typed beside its twin at the caret", () => {
    expect(edit(PHONE, "555", "(5|55) ", "(55|55) ")).toEqual({ raw: "5555", shown: "(55|5) 5" });
  });

  it("drops what overflows a full mask", () => {
    expect(edit(PHONE, "5551234567", "(|555) 123-4567", "(9|555) 123-4567")).toEqual({ raw: "9555123456", shown: "(9|55) 512-3456" });
  });

  it("puts the caret on the slot it would fill next", () => {
    expect(caretFor(PHONE, "5551234", 3)).toBe(6);
    expect(caretFor(PHONE, "5551234", 0)).toBe(1);
    expect(caretFor(PHONE, "5551234", 7)).toBe("(555) 123-4".length);
  });
});
