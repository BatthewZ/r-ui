/**
 * "Did you mean": the candidate nearest a misspelling by optimal string
 * alignment distance (Levenshtein plus adjacent transpositions, each
 * substring edited once), close enough to be the likely intent.
 */

/** Edits between `a` and `b`: insertions, deletions, substitutions and adjacent swaps. */
export function osaDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[] = new Array<number>(rows * cols).fill(0);
  const at = (i: number, j: number) => d[i * cols + j] as number;
  for (let i = 0; i < rows; i += 1) d[i * cols] = i;
  for (let j = 0; j < cols; j += 1) d[j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(at(i - 1, j) + 1, at(i, j - 1) + 1, at(i - 1, j - 1) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) best = Math.min(best, at(i - 2, j - 2) + 1);
      d[i * cols + j] = best;
    }
  }
  return at(a.length, b.length);
}

/**
 * The candidate `input` most likely meant, or undefined when `input` is one
 * or none is close:
 * a case-insensitive match first, then the one candidate containing it
 * (`toast` → `showToast`), then the nearest within a third of the input's
 * length (at least 1, at most 3 edits), a unique nearest only.
 */
export function closest(input: string, candidates: Iterable<string>): string | undefined {
  const list = [...candidates];
  if (list.includes(input)) return undefined;
  const lower = input.toLowerCase();
  const sameCase = list.filter((candidate) => candidate.toLowerCase() === lower && candidate !== input);
  if (sameCase.length === 1) return sameCase[0];
  if (input.length >= 4) {
    const containing = list.filter((candidate) => candidate.toLowerCase().includes(lower) && candidate !== input);
    if (containing.length === 1) return containing[0];
  }

  const limit = Math.min(3, Math.max(1, Math.floor(input.length / 3)));
  let best: string | undefined;
  let bestDistance = Infinity;
  let tied = false;
  for (const candidate of list) {
    if (candidate === input || Math.abs(candidate.length - input.length) > limit) continue;
    const distance = osaDistance(lower, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
      tied = false;
    } else if (distance === bestDistance) tied = true;
  }
  return best !== undefined && bestDistance <= limit && !tied ? best : undefined;
}

/** `closest`, quoted as an issue's `suggestion` (`"showToast"`). */
export function suggest(input: string, candidates: Iterable<string>): string | undefined {
  const nearest = closest(input, candidates);
  return nearest === undefined ? undefined : JSON.stringify(nearest);
}

/** `suggest` for a value outside a closed set: only a string value, among the string members. */
export function suggestValue(value: unknown, allowed: readonly unknown[]): string | undefined {
  if (typeof value !== "string") return undefined;
  return suggest(value, allowed.filter((item): item is string => typeof item === "string"));
}
