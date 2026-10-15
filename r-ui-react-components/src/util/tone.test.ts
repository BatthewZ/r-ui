import { describe, expect, it } from "vitest";

import { TONE_LABELS } from "./tone";

describe("TONE_LABELS", () => {
  it("is one plain word per tone: no punctuation a component would double", () => {
    for (const word of Object.values(TONE_LABELS)) expect(word).toMatch(/^[A-Z]?[a-z]*$/);
    expect(TONE_LABELS.error).toBe("Error");
    expect(TONE_LABELS.neutral).toBe("");
  });
});
