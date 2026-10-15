import { describe, expect, it } from "vitest";

import { mergeLabels } from "./labels";

const DEFAULTS = {
  close: "Close",
  count: (n: number) => `${n} items`,
  tones: { error: "Error", success: "Success" },
};

describe("mergeLabels", () => {
  it("returns the defaults untouched when nothing is given", () => {
    expect(mergeLabels(DEFAULTS, undefined)).toBe(DEFAULTS);
  });

  it("overrides strings and functions, and merges a map key by key", () => {
    const count = (n: number) => `${n} Einträge`;
    const merged = mergeLabels(DEFAULTS, { close: "Schließen", count, tones: { error: "Fehler" } });
    expect(merged).toEqual({ close: "Schließen", count, tones: { error: "Fehler", success: "Success" } });
    expect(DEFAULTS.tones.error).toBe("Error");
  });

  it("keeps the default for an explicit undefined, but honours an empty string", () => {
    const merged = mergeLabels(DEFAULTS, { close: undefined, tones: { error: "" } });
    expect(merged.close).toBe("Close");
    expect(merged.tones.error).toBe("");
  });
});
