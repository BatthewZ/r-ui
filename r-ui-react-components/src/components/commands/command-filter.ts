/**
 * Ranking for CommandPalette: forgiving ("thm" finds "Change theme"), but the
 * closer the match, the higher it sorts. Case and diacritics are ignored
 * through the shared folding (`util/text-match`), so a palette and a Combobox
 * agree on what matches.
 */
import { findMatch, foldText, type MatchRange } from "../../util/text-match";
import type { CommandPaletteCommand } from "./CommandPalette";

export interface CommandMatch {
  /** Higher sorts first. 0 for an empty query. */
  score: number;
  ranges: MatchRange[];
}

/** Scores, best first. A label match always beats a keyword-only one, which beats a scattered one. */
const SCORE = {
  labelStart: 100,
  labelWordStart: 80,
  labelInside: 60,
  allWords: 50,
  allWordsWithKeywords: 40,
  keyword: 30,
  acronym: 25,
  scattered: 20,
} as const;

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** Whether `index` in `text` starts a word (start of text, or after a space or punctuation). */
function startsWord(text: string, index: number) {
  if (index === 0) return true;
  // A low surrogate before `index` ends an astral character: read it from its high half.
  const unit = text.charCodeAt(index - 1);
  const start = unit >= 0xdc00 && unit <= 0xdfff && index >= 2 ? index - 2 : index - 1;
  return !isWordChar(String.fromCodePoint(text.codePointAt(start) ?? 0));
}

/**
 * The query's characters in order anywhere in `text` ("cht" in "Change theme"),
 * as ranges of `text`; null when they are not all there. Each code point is
 * folded on its own, so an accented letter matches its plain form and the range
 * covers the whole original character.
 */
function scatteredMatch(text: string, needle: string): { ranges: MatchRange[]; wordStarts: boolean } | null {
  let at = 0;
  let index = 0;
  let wordStarts = true;
  const ranges: [number, number][] = [];
  for (const char of text) {
    if (at >= needle.length) break;
    const folded = foldText(char);
    if (folded !== "" && needle.startsWith(folded, at)) {
      at += folded.length;
      if (!startsWord(text, index)) wordStarts = false;
      const last = ranges[ranges.length - 1];
      if (last && last[1] === index) last[1] = index + char.length;
      else ranges.push([index, index + char.length]);
    }
    index += char.length;
  }
  return at >= needle.length ? { ranges, wordStarts } : null;
}

/** How well `query` matches a command; null when it does not. */
export function matchCommand(label: string, keywords: readonly string[] | undefined, query: string): CommandMatch | null {
  const trimmed = query.trim();
  if (trimmed === "") return { score: 0, ranges: [] };

  const whole = findMatch(label, trimmed);
  if (whole) {
    const score = whole[0] === 0 ? SCORE.labelStart : startsWord(label, whole[0]) ? SCORE.labelWordStart : SCORE.labelInside;
    return { score, ranges: [whole] };
  }

  const foldedKeywords = (keywords ?? []).map(foldText);
  const words = trimmed.split(/\s+/u);
  if (words.length > 1) {
    const ranges: MatchRange[] = [];
    let viaKeyword = false;
    const every = words.every((word) => {
      const range = findMatch(label, word);
      if (range) {
        ranges.push(range);
        return true;
      }
      viaKeyword = true;
      const folded = foldText(word);
      return foldedKeywords.some((keyword) => keyword.includes(folded));
    });
    if (every) {
      ranges.sort((a, b) => a[0] - b[0]);
      return { score: viaKeyword ? SCORE.allWordsWithKeywords : SCORE.allWords, ranges };
    }
  }

  const needle = foldText(trimmed);
  if (foldedKeywords.some((keyword) => keyword.includes(needle))) return { score: SCORE.keyword, ranges: [] };

  const scattered = scatteredMatch(label, needle.replace(/\s+/gu, ""));
  if (scattered) return { score: scattered.wordStarts ? SCORE.acronym : SCORE.scattered, ranges: scattered.ranges };
  return null;
}

/** One listed command. `trail`: the titles of the pages it was found on. */
export interface ListItem {
  key: string;
  command: CommandPaletteCommand;
  ranges: readonly MatchRange[];
  trail: string[];
}

export interface ListGroup {
  key: string;
  label: string | undefined;
  items: ListItem[];
}

/** Groups in order of first appearance; while searching, groups and their items by best match (stable). */
function groupCommands(scored: { item: ListItem; score: number }[], rank: boolean): ListGroup[] {
  const groups = new Map<string, { group: ListGroup; best: number; order: number }>();
  for (const { item, score } of scored) {
    const label = item.command.group;
    const key = `g:${label ?? ""}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = { group: { key, label, items: [] }, best: score, order: groups.size };
      groups.set(key, entry);
    }
    entry.best = Math.max(entry.best, score);
    entry.group.items.push(item);
  }
  const list = [...groups.values()];
  if (rank) {
    const scoreOf = new Map(scored.map(({ item, score }) => [item.key, score]));
    for (const { group } of list) group.items.sort((a, b) => (scoreOf.get(b.key) ?? 0) - (scoreOf.get(a.key) ?? 0));
    list.sort((a, b) => b.best - a.best || a.order - b.order);
  }
  return list.map(({ group }) => group);
}

/**
 * The palette's list for a (trimmed) query: the page's own commands that match,
 * then `found` (a search's results), grouped; with no query, `recent` first
 * under `recentLabel`.
 */
export function listCommands({
  own,
  found,
  query,
  trail,
  recent,
  recentLabel,
}: {
  own: readonly CommandPaletteCommand[];
  found: readonly CommandPaletteCommand[];
  query: string;
  trail: string[];
  recent: readonly { command: CommandPaletteCommand; trail: string[] }[];
  recentLabel: string;
}): ListGroup[] {
  const scored: { item: ListItem; score: number }[] = [];
  for (const command of own) {
    const match = matchCommand(command.label, command.keywords, query);
    if (match) scored.push({ item: { key: `c:${command.id}`, command, ranges: match.ranges, trail }, score: match.score });
  }
  // Search results were chosen for this query already: listed after local
  // matches, highlighted where the label shows the query.
  for (const command of found) {
    const match = matchCommand(command.label, command.keywords, query);
    scored.push({ item: { key: `s:${command.id}`, command, ranges: match?.ranges ?? [], trail }, score: -1 });
  }
  const list = groupCommands(scored, query !== "");
  if (query === "" && recent.length > 0) {
    list.unshift({
      key: "recent",
      label: recentLabel,
      items: recent.map(({ command, trail: from }) => ({ key: `r:${command.id}`, command, ranges: [], trail: from })),
    });
  }
  return list;
}
