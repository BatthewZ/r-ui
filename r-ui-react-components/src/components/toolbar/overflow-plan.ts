/**
 * What a toolbar unit is to the overflow plan:
 * - `item`: can move into the menu (it has a menu form);
 * - `pinned`: has no menu form, so it always stays in the bar;
 * - `separator`: divides items; never left leading, trailing or doubled.
 */
export type UnitKind = "item" | "pinned" | "separator";

export interface OverflowInput {
  /** Each unit's inline size, in order. */
  widths: readonly number[];
  kinds: readonly UnitKind[];
  /** The toolbar's content box inline size. */
  available: number;
  /** The gap between neighbouring units. */
  gap: number;
  /** The "More" trigger's inline size. */
  moreWidth: number;
}

/** Sub-pixel layout rounds both ways; a row that fits to within this fits. */
const TOLERANCE = 0.5;

/**
 * Hides each shown separator that has no shown non-separator unit before it
 * (since the last kept separator) or none after it: no leading, trailing or
 * doubled lines.
 */
export function tidySeparators(shown: boolean[], kinds: readonly UnitKind[]): boolean[] {
  const out = [...shown];
  let itemSinceLastKept = false;
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i]) continue;
    if (kinds[i] !== "separator") {
      itemSinceLastKept = true;
      continue;
    }
    const itemAfter = out.some((on, j) => j > i && on && kinds[j] !== "separator");
    if (!itemSinceLastKept || !itemAfter) out[i] = false;
    else itemSinceLastKept = false;
  }
  return out;
}

/**
 * Which units leave the bar for the overflow menu, as sorted indices. None if
 * everything fits; otherwise units go from the end, one at a time (pinned ones
 * stay), until what is left plus the "More" trigger fits. The menu lists them
 * in their bar order. Separators stranded by the move go with them.
 */
export function planOverflow({ widths, kinds, available, gap, moreWidth }: OverflowInput): number[] {
  const count = widths.length;
  const span = (shown: boolean[], withMore: boolean) => {
    let sum = withMore ? moreWidth : 0;
    let n = withMore ? 1 : 0;
    shown.forEach((on, i) => {
      if (!on) return;
      sum += widths[i] ?? 0;
      n += 1;
    });
    return sum + gap * Math.max(0, n - 1);
  };

  let shown = tidySeparators(new Array<boolean>(count).fill(true), kinds);
  if (span(shown, false) <= available + TOLERANCE) return hiddenOf(shown);

  const keep = new Array<boolean>(count).fill(true);
  for (let i = count - 1; i >= 0; i -= 1) {
    if (kinds[i] === "pinned") continue;
    keep[i] = false;
    shown = tidySeparators(keep, kinds);
    if (span(shown, true) <= available + TOLERANCE) break;
  }
  return hiddenOf(shown);
}

function hiddenOf(shown: boolean[]): number[] {
  return shown.flatMap((on, i) => (on ? [] : [i]));
}
