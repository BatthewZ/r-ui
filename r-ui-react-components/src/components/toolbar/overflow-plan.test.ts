import { describe, expect, it } from "vitest";

import { planOverflow, tidySeparators, type UnitKind } from "./overflow-plan";

const plan = (widths: number[], kinds: UnitKind[], available: number, gap = 4, moreWidth = 32) =>
  planOverflow({ widths, kinds, available, gap, moreWidth });

describe("planOverflow", () => {
  // Five 40px items with a 4px gap span 5 × 40 + 4 × 4 = 216px.
  const five: UnitKind[] = ["item", "item", "item", "item", "item"];

  it("hides nothing while everything fits, to the pixel", () => {
    expect(plan([40, 40, 40, 40, 40], five, 216)).toEqual([]);
  });

  it("moves units from the end until the rest plus More fits", () => {
    // 215px: one short. Hiding the last leaves 4 × 40 + 32 + 4 × 4 = 208.
    expect(plan([40, 40, 40, 40, 40], five, 215)).toEqual([4]);
    // 150px: 2 × 40 + 32 + 2 × 4 = 120 fits, 3 × 40 + 32 + 3 × 4 = 164 does not.
    expect(plan([40, 40, 40, 40, 40], five, 150)).toEqual([2, 3, 4]);
  });

  it("keeps pinned units in the bar and moves the ones around them", () => {
    // The Select (pinned, 120px) stays; the items after and before it go.
    expect(plan([40, 120, 40, 40], ["item", "pinned", "item", "item"], 200)).toEqual([2, 3]);
    expect(plan([40, 120, 40, 40], ["item", "pinned", "item", "item"], 160)).toEqual([0, 2, 3]);
  });

  it("takes a separator stranded at the end of the bar with the units after it", () => {
    const kinds: UnitKind[] = ["item", "item", "separator", "item", "item"];
    // Hiding the last two leaves a trailing separator: it goes too.
    expect(plan([40, 40, 1, 40, 40], kinds, 130)).toEqual([2, 3, 4]);
  });

  it("hides everything it can when nothing fits", () => {
    expect(plan([40, 40], ["item", "item"], 10)).toEqual([0, 1]);
  });
});

describe("tidySeparators", () => {
  it("drops leading, trailing and doubled separators and keeps the ones between items", () => {
    const kinds: UnitKind[] = ["separator", "item", "separator", "separator", "item", "separator"];
    expect(tidySeparators(kinds.map(() => true), kinds)).toEqual([false, true, true, false, true, false]);
  });

  it("counts only shown items on either side", () => {
    const kinds: UnitKind[] = ["item", "separator", "item"];
    expect(tidySeparators([true, true, false], kinds)).toEqual([true, false, false]);
  });
});
