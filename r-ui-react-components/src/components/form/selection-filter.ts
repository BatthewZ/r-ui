/**
 * Matching for the selection inputs (Combobox, MultiSelect, TagInput):
 * case- and diacritic-insensitive "contains", plus where the match sits in the
 * ORIGINAL label so it can be highlighted.
 */

/** Folds one string for comparison: decomposed, combining marks dropped, locale-lowercased. */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

/**
 * Where `query` first occurs in `text`, ignoring case and diacritics, as a
 * `[start, end)` range of `text` itself. Folding changes lengths ("É" is two
 * code units decomposed, "ß" may lowercase to itself or not), so each code
 * point is folded on its own and every folded unit remembers the original
 * index it came from.
 */
export function findMatch(text: string, query: string): [number, number] | null {
  const needle = foldText(query.trim());
  if (needle === "") return null;
  let folded = "";
  const origin: number[] = [];
  let index = 0;
  for (const char of text) {
    const part = foldText(char);
    for (let i = 0; i < part.length; i++) origin.push(index);
    folded += part;
    index += char.length;
  }
  const at = folded.indexOf(needle);
  if (at < 0) return null;
  const last = at + needle.length - 1;
  const start = origin[at] ?? 0;
  const lastOrigin = origin[last] ?? start;
  // The end is past the whole original code point the last folded unit came from,
  // and past any combining marks after it (they folded to nothing), so the
  // highlight never splits a character from its accent.
  let end = lastOrigin + ((text.codePointAt(lastOrigin) ?? 0) > 0xffff ? 2 : 1);
  for (const char of text.slice(end)) {
    if (foldText(char) !== "") break;
    end += char.length;
  }
  return [start, end];
}

/** The default filter: the label contains the query, case- and diacritic-insensitively. */
export function defaultFilter(option: { label: string }, query: string): boolean {
  return foldText(option.label).includes(foldText(query.trim()));
}
