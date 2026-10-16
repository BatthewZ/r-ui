/** A password's strength, as the strength meter shows it. */
export interface PasswordStrength {
  /** 0 (very weak) to 4 (very strong). */
  score: 0 | 1 | 2 | 3 | 4;
  /** The score in words ("Weak"). Shown beside the meter and spoken as its value. */
  label: string;
  /** What would make it stronger, most useful first. Empty when nothing would. */
  hints: string[];
}

/** Scores a password. Plug in a real estimator (zxcvbn, a server check) through `PasswordInput`'s `strength`. */
export type PasswordStrengthEstimator = (value: string) => PasswordStrength;

/** The words the built-in estimator uses. Part of `PasswordInputLabels`. */
export interface PasswordStrengthLabels {
  /** Index = score. */
  scores: readonly [string, string, string, string, string];
  tooShort: (minLength: number) => string;
  common: string;
  patterns: string;
  mixCase: string;
  addDigitOrSymbol: string;
  longer: string;
}

export const DEFAULT_PASSWORD_STRENGTH_LABELS: PasswordStrengthLabels = {
  scores: ["Very weak", "Weak", "Fair", "Strong", "Very strong"],
  tooShort: (minLength) => `Use at least ${minLength} characters.`,
  common: "Avoid common passwords and words.",
  patterns: "Avoid repeated characters and sequences like “abc” or “123”.",
  mixCase: "Mix upper and lower case letters.",
  addDigitOrSymbol: "Add a number or a symbol.",
  longer: "A few more characters, or a few words together, make it much stronger.",
};

/** The short list every guessing tool tries first (lowercase, with digits and symbols stripped). */
const COMMON = [
  "password",
  "passwort",
  "qwerty",
  "azerty",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "sunshine",
  "princess",
  "master",
  "shadow",
  "login",
  "abc",
  "secret",
  "trustno",
];

const ROWS = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Characters that only continue a run (aaa) or a sequence (abc, 321, qwe) of three or more. */
function patternedCount(value: string): number {
  const chars = Array.from(value.toLowerCase());
  let patterned = 0;
  for (let i = 2; i < chars.length; i++) {
    const [a, b, c] = [chars[i - 2] ?? "", chars[i - 1] ?? "", chars[i] ?? ""];
    const run = a === b && b === c;
    const sequence = ROWS.some((row) => {
      const ia = row.indexOf(a);
      const ib = row.indexOf(b);
      const ic = row.indexOf(c);
      return ia >= 0 && ib >= 0 && ic >= 0 && ((ib === ia + 1 && ic === ib + 1) || (ib === ia - 1 && ic === ib - 1));
    });
    if (run || sequence) patterned++;
  }
  return patterned;
}

/**
 * The built-in estimator: no dependency, no word list beyond the most common
 * passwords, so it is a nudge, not a guarantee. It estimates the guessing
 * space (length × the classes of character used), discounting runs,
 * sequences and the common list, and maps it onto 0–4.
 */
export function estimatePasswordStrength(
  value: string,
  labels: PasswordStrengthLabels = DEFAULT_PASSWORD_STRENGTH_LABELS,
  minLength = 8,
): PasswordStrength {
  const length = Array.from(value).length;
  const lower = /\p{Ll}/u.test(value);
  const upper = /\p{Lu}/u.test(value);
  const digit = /\p{Nd}/u.test(value);
  const symbol = /[^\p{L}\p{Nd}]/u.test(value);
  const pool = (lower ? 26 : 0) + (upper ? 26 : 0) + (digit ? 10 : 0) + (symbol ? 33 : 0);
  const patterned = patternedCount(value);
  const letters = value.toLowerCase().replace(/[^\p{L}]/gu, "");
  const common = letters.length > 0 && COMMON.some((word) => letters.includes(word) && word.length >= letters.length / 2);

  // Each patterned character adds about as much as a quarter of a free one.
  const effective = Math.max(0, length - patterned * 0.75);
  const bits = effective * Math.log2(Math.max(pool, 1));
  let score: PasswordStrength["score"] = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  if (length < minLength) score = Math.min(score, 1) as PasswordStrength["score"];
  if (common) score = Math.min(score, 1) as PasswordStrength["score"];

  const hints: string[] = [];
  if (length < minLength) hints.push(labels.tooShort(minLength));
  if (common) hints.push(labels.common);
  if (patterned > 0 && score < 4) hints.push(labels.patterns);
  if (score < 3) {
    if (lower !== upper && (lower || upper)) hints.push(labels.mixCase);
    if (!digit && !symbol) hints.push(labels.addDigitOrSymbol);
    if (length >= minLength) hints.push(labels.longer);
  }
  return { score, label: labels.scores[score], hints };
}
