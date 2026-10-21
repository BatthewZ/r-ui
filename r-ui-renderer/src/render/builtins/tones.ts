import { RENDERER_CLASSES } from "../../diagnostics";
import { isOneOf } from "../../spec/guards";
import { TEXT_TONES } from "../../spec/types";

/** The tone's class when `tone` is one, else none. */
export function toneClass(tone: unknown): string | undefined {
  return isOneOf(TEXT_TONES, tone) ? `${RENDERER_CLASSES.tone}-${tone}` : undefined;
}

/** Class names joined, leaving out the absent ones. A document's `className` goes last, untouched. */
export function classes(...names: readonly unknown[]): string | undefined {
  const present = names.filter((name): name is string => typeof name === "string" && name.length > 0);
  return present.length > 0 ? present.join(" ") : undefined;
}
