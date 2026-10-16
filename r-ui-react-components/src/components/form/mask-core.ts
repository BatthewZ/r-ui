/**
 * The editing model behind `MaskedInput`, free of React and the DOM.
 *
 * A mask is a row of SLOTS (a token: `9` a digit, `A` a letter, `*` either)
 * and LITERALS (everything else; `\9` is a literal 9). The value is RAW: the
 * slot characters only, in order. The text shown is the mask filled up to the
 * first empty slot, so the literals before it are already there for the caret.
 * An edit is read as "this range of the shown text became this text", mapped
 * onto raw positions, and the raw characters after it are refitted to their
 * new slots.
 */

export interface MaskToken {
  /** Whether a typed character may fill the slot. */
  test: (char: string) => boolean;
  /** What the slot keeps (e.g. upper case). */
  transform?: (char: string) => string;
  /** The on-screen keyboard this slot wants: a mask of only numeric slots asks for the number pad. */
  numeric?: boolean;
}

export type MaskTokens = Readonly<Record<string, MaskToken>>;

export const DEFAULT_MASK_TOKENS: MaskTokens = {
  "9": { test: (char) => /^[0-9]$/.test(char), numeric: true },
  A: { test: (char) => /^\p{L}$/u.test(char) },
  "*": { test: (char) => /^[\p{L}0-9]$/u.test(char) },
};

export type MaskPart = { kind: "slot"; token: MaskToken } | { kind: "literal"; char: string };

export function parseMask(mask: string, tokens: MaskTokens = DEFAULT_MASK_TOKENS): MaskPart[] {
  const parts: MaskPart[] = [];
  const chars = Array.from(mask);
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i] ?? "";
    if (char === "\\" && i + 1 < chars.length) {
      parts.push({ kind: "literal", char: chars[++i] ?? "" });
      continue;
    }
    const token = Object.hasOwn(tokens, char) ? tokens[char] : undefined;
    parts.push(token ? { kind: "slot", token } : { kind: "literal", char });
  }
  return parts;
}

const slotsOf = (parts: readonly MaskPart[]) =>
  parts.flatMap((part) => (part.kind === "slot" ? [part.token] : []));

export const slotCount = (parts: readonly MaskPart[]) => slotsOf(parts).length;

export const isNumericMask = (parts: readonly MaskPart[]) => {
  const slots = slotsOf(parts);
  return slots.length > 0 && slots.every((token) => token.numeric === true);
};

/**
 * `chars` placed into the slots from `fromSlot` on: each one a slot refuses is
 * skipped (a pasted "(555) 123-4567" keeps its digits), and what does not fit
 * is dropped.
 */
export function fitChars(parts: readonly MaskPart[], chars: string, fromSlot = 0): string {
  const slots = slotsOf(parts);
  let slot = fromSlot;
  let out = "";
  for (const char of Array.from(chars)) {
    const token = slots[slot];
    if (!token) break;
    if (!token.test(char)) continue;
    // A slot holds one character: a transform that returns more ("ß" → "SS") keeps the typed one.
    const kept = token.transform?.(char) ?? char;
    out += Array.from(kept).length === 1 ? kept : char;
    slot++;
  }
  return out;
}

/**
 * The text shown for `raw`: literals and filled slots up to the first empty
 * slot, the literals before it included ("555" → "(555) "). Empty for an empty
 * value, so the placeholder shows.
 */
export function formatMask(parts: readonly MaskPart[], raw: string): string {
  const chars = Array.from(raw);
  if (chars.length === 0) return "";
  let out = "";
  let slot = 0;
  for (const part of parts) {
    if (part.kind === "literal") {
      out += part.char;
      continue;
    }
    const char = chars[slot++];
    if (char === undefined) break;
    out += char;
  }
  return out;
}

/** The mask with every slot drawn as `char`: "(___) ___-____". */
export const maskPlaceholder = (parts: readonly MaskPart[], char = "_") =>
  parts.map((part) => (part.kind === "literal" ? part.char : char)).join("");

/**
 * Slots before UTF-16 offset `index` of the shown text. The shown text has one
 * code point per mask part (a literal or a slot's character), in order.
 */
function slotsBefore(parts: readonly MaskPart[], shown: string, index: number): number {
  const points = Array.from(shown);
  let count = 0;
  let offset = 0;
  for (let i = 0; i < points.length && offset < index; i++) {
    if (parts[i]?.kind === "slot") count++;
    offset += points[i]?.length ?? 0;
  }
  return count;
}

/** Where the caret goes for raw position `rawCaret`: on the slot it would fill next, or at the end. */
export function caretFor(parts: readonly MaskPart[], raw: string, rawCaret: number): number {
  const shown = formatMask(parts, raw);
  if (rawCaret >= Array.from(raw).length) return shown.length;
  const points = Array.from(shown);
  let slot = 0;
  let offset = 0;
  for (let i = 0; i < points.length; i++) {
    if (parts[i]?.kind === "slot" && slot++ === rawCaret) return offset;
    offset += points[i]?.length ?? 0;
  }
  return shown.length;
}

export interface MaskEdit {
  /** The raw value before the edit, and the text that showed it. */
  raw: string;
  shown: string;
  /** The text after the edit and its caret. */
  next: string;
  caret: number;
  /** The edit deleted forward (Delete), not backward (Backspace). */
  forward?: boolean;
}

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * Applies one edit (a keystroke, a deletion, a paste, a replaced selection, an
 * IME commit) to the raw value. Returns the new raw value and its caret.
 *
 * The edit is read from the two texts and the caret alone, never from a
 * selection remembered beforehand (which mobile keyboards and IMEs do not
 * report reliably): the text after the caret is the unchanged tail, and the
 * changed range starts where the texts first differ, no later than the caret.
 * Where that is ambiguous (typing a "5" beside another "5") every reading
 * gives the same value.
 */
export function applyMaskEdit(parts: readonly MaskPart[], edit: MaskEdit): { raw: string; caret: number } {
  const { raw, shown, next } = edit;
  const caret = Math.max(0, Math.min(edit.caret, next.length));
  const prevEnd = Math.max(0, Math.min(shown.length, shown.length - (next.length - caret)));
  const start = Math.min(commonPrefix(shown, next), caret, prevEnd);
  const inserted = next.slice(start, caret);
  let rawStart = slotsBefore(parts, shown, start);
  let rawEnd = slotsBefore(parts, shown, prevEnd);
  const rawChars = Array.from(raw);
  // A deletion of literals alone ("(555) |" ← Backspace) deletes the slot beside them.
  if (inserted === "" && rawStart === rawEnd && prevEnd > start) {
    if (edit.forward) rawEnd = Math.min(rawChars.length, rawEnd + 1);
    else rawStart = Math.max(0, rawStart - 1);
  }
  const head = rawChars.slice(0, rawStart).join("");
  const added = fitChars(parts, inserted, rawStart);
  const headLength = rawStart + Array.from(added).length;
  const rest = fitChars(parts, rawChars.slice(rawEnd).join(""), headLength);
  const nextRaw = head + added + rest;
  // Delete leaves the caret where it was; anything else puts it on the next slot to fill.
  const caretAfter =
    inserted === "" && edit.forward
      ? Math.min(start, formatMask(parts, nextRaw).length)
      : caretFor(parts, nextRaw, headLength);
  return { raw: nextRaw, caret: caretAfter };
}
