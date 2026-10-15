/**
 * The UI spacing scale as a prop value (`gap="r3"`): 1 is the largest step, and
 * every step follows density. Raw lengths are not accepted, on purpose.
 */
export type Space = "r1" | "r2" | "r3" | "r4" | "r5" | "r6";

// Literal class names, so Tailwind's scanner sees every utility.
export const GAP: Record<Space, string> = {
  r1: "gap-r1",
  r2: "gap-r2",
  r3: "gap-r3",
  r4: "gap-r4",
  r5: "gap-r5",
  r6: "gap-r6",
};

export const ROW_GAP: Record<Space, string> = {
  r1: "gap-y-r1",
  r2: "gap-y-r2",
  r3: "gap-y-r3",
  r4: "gap-y-r4",
  r5: "gap-y-r5",
  r6: "gap-y-r6",
};

export type Align = "start" | "center" | "end" | "stretch" | "baseline";

export const ALIGN_ITEMS: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

export type Justify = "start" | "center" | "end" | "between";

export const JUSTIFY: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};
