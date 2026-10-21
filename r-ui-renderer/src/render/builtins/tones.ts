import type { TextTone } from "../../spec/types";

/** Each text tone's colour utility: the contract's text roles and the library's status inks. */
const TONE_CLASSES: { readonly [T in TextTone]: string } = {
  primary: "text-fg-primary",
  secondary: "text-fg-secondary",
  muted: "text-fg-muted",
  error: "text-fg-error",
  success: "text-fg-success",
  warning: "text-fg-warning",
  info: "text-fg-info",
  serious: "text-fg-serious",
  stale: "text-fg-stale",
};

/** The tone's class when `tone` is one, else none. */
export function toneClass(tone: unknown): string | undefined {
  return typeof tone === "string" && Object.hasOwn(TONE_CLASSES, tone) ? TONE_CLASSES[tone as TextTone] : undefined;
}

/** Class names joined, leaving out the absent ones. A document's `className` goes last, untouched. */
export function classes(...names: readonly (string | false | undefined)[]): string | undefined {
  const present = names.filter((name): name is string => typeof name === "string" && name.length > 0);
  return present.length > 0 ? present.join(" ") : undefined;
}

/** `value` when `list` holds it, else undefined: a document's prop read as one of a closed set. */
export function oneOf<T>(list: readonly T[], value: unknown): T | undefined {
  return list.find((item) => item === value);
}
