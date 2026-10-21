/**
 * A document's `theme`: which colour roles it may set, in what grammar, what
 * the host's policy lets through, and the contrast floors the result must
 * meet. The roles and the pairs are generated from the CSS package's theme
 * template and contrast check (`scripts/derive-theme.mjs`); the schema, the
 * validator and the renderer all read them here.
 */

import { contrastRatio, parseColour, relativeLuminance } from "./color";
import { isOneOf, isPlainObject } from "./guards";
import { makeIssue } from "./issue";
import { appendPointer } from "./pointer";
import contract from "./theme-contract.json";
import { type HostPolicy, type Issue, THEME_KEYS, THEME_SCHEMES, type ThemeScheme, type ThemeSpec } from "./types";

/** One colour role a document's theme may set. */
export interface ThemeToken {
  /** The custom property: `--C-CANVAS`. */
  readonly name: string;
  /** What it paints, in the theme template's words. */
  readonly role: string;
  /** The class vocabulary's utilities that paint with it. */
  readonly utilities: readonly string[];
  /** The template writes it translucent, so a document's value may carry alpha. No contrast pair measures it. */
  readonly translucent: boolean;
}

export interface ContrastPair {
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
  readonly kind: string;
}

/** Every colour role, in the theme template's order. */
export const THEME_TOKENS: readonly ThemeToken[] = contract.tokens;

/** Every pair the CSS package's contrast check measures, with its floor. */
export const THEME_CONTRAST_PAIRS: readonly ContrastPair[] = contract.pairs;

/** The text and canvas roles whose order the scheme must agree with: a dark scheme's text is lighter than its canvas. */
export const THEME_SCHEME_PAIR: { readonly text: string; readonly canvas: string } = contract.scheme;

const TOKENS = new Map(THEME_TOKENS.map((token) => [token.name, token]));

// ---------------------------------------------------------------------------
// The value grammar: hex, or one of six colour functions with numeric
// channels in the space-separated syntax. No var(), calc(), color-mix(),
// url() and no keyword but `none`; alpha only on translucent roles.

const NUMBER = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
const NUM_OR_PERCENT = `(?:${NUMBER}%?|none)`;
const PERCENT = `(?:${NUMBER}%|none)`;
const HUE = `(?:${NUMBER}(?:deg|grad|rad|turn)?|none)`;

// CSS whitespace only: JavaScript's \s also takes U+00A0, U+2028 and the like, which CSS does not.
const WS = "[ \\t\\n\\r\\f]";

const fn = (name: string, channels: readonly string[], alpha: boolean) =>
  `${name}\\(${WS}*${channels.join(`${WS}+`)}${alpha ? `(?:${WS}*\\/${WS}*${NUM_OR_PERCENT})?` : ""}${WS}*\\)`;

function colourPattern(alpha: boolean): string {
  const hex = alpha ? "#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})" : "#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})";
  const functions = [
    fn("rgb", [NUM_OR_PERCENT, NUM_OR_PERCENT, NUM_OR_PERCENT], alpha),
    fn("hsl", [HUE, PERCENT, PERCENT], alpha),
    fn("oklch", [NUM_OR_PERCENT, NUM_OR_PERCENT, HUE], alpha),
    fn("oklab", [NUM_OR_PERCENT, NUM_OR_PERCENT, NUM_OR_PERCENT], alpha),
    fn("lab", [NUM_OR_PERCENT, NUM_OR_PERCENT, NUM_OR_PERCENT], alpha),
    fn("lch", [NUM_OR_PERCENT, NUM_OR_PERCENT, HUE], alpha),
  ];
  return `^(?:${hex}|${functions.join("|")})$`;
}

/** An opaque colour, the grammar of every role a contrast pair measures. */
export const OPAQUE_COLOUR_PATTERN = colourPattern(false);
/** A colour that may carry alpha (`#rgba`, `/ 0.4`): translucent roles only. */
export const COLOUR_PATTERN = colourPattern(true);

const OPAQUE = new RegExp(OPAQUE_COLOUR_PATTERN, "u");
const ANY = new RegExp(COLOUR_PATTERN, "u");

/** Whether `value` is in the grammar of the role `token` (an unknown role takes nothing). */
export function isThemeColour(token: string, value: string): boolean {
  const known = TOKENS.get(token);
  return known !== undefined && (known.translucent ? ANY : OPAQUE).test(value);
}

// ---------------------------------------------------------------------------
// What a document asks for, and what the host lets through

const THEME_PATH = "/theme";
const TOKENS_PATH = `${THEME_PATH}/tokens`;
const tokenPath = (name: string) => appendPointer(TOKENS_PATH, name);

/** The colour roles the host lets a document set: all (`true`, the default), none, or the listed names. */
export function allowedThemeTokens(policy: HostPolicy): ReadonlySet<string> {
  const allowed = policy.themeOverrides ?? true;
  if (allowed === true) return new Set(TOKENS.keys());
  if (allowed === false) return new Set();
  return new Set(allowed.filter((name) => TOKENS.has(name)));
}

/**
 * Why `theme` does not conform, as the schema would report it first; undefined
 * when it does. The renderer refuses a non-conforming theme whole, so a half
 * palette never applies.
 */
export function themeProblem(theme: unknown): Issue | undefined {
  if (!isPlainObject(theme)) return makeIssue("invalid-type", THEME_PATH, "`theme` is an object: { \"scheme\"?, \"tokens\"? }.");
  for (const key of Object.keys(theme)) {
    if (!isOneOf(THEME_KEYS, key)) return makeIssue("unknown-key", appendPointer(THEME_PATH, key), `Unknown key \`${key}\`; \`theme\` takes \`scheme\` and \`tokens\`.`);
  }
  if (theme.scheme !== undefined && !isOneOf(THEME_SCHEMES, theme.scheme)) {
    return makeIssue("invalid-value", `${THEME_PATH}/scheme`, `\`scheme\` is one of ${THEME_SCHEMES.map((s) => `"${s}"`).join(", ")}.`);
  }
  if (theme.tokens === undefined) return undefined;
  if (!isPlainObject(theme.tokens)) return makeIssue("invalid-type", TOKENS_PATH, "`tokens` is an object of colour roles.");
  for (const [name, value] of Object.entries(theme.tokens)) {
    if (!TOKENS.has(name)) return makeIssue("unknown-key", tokenPath(name), `\`${name}\` is not a colour role a theme may set.`);
    if (typeof value !== "string") return makeIssue("invalid-type", tokenPath(name), "A colour is a string.");
    if (!isThemeColour(name, value)) return makeIssue("invalid-value", tokenPath(name), COLOUR_MESSAGE);
  }
  return undefined;
}

export const COLOUR_MESSAGE =
  "A colour is #rgb, #rrggbb, or rgb(), hsl(), oklch(), oklab(), lab() or lch() with space-separated numbers (`none` allowed); " +
  "alpha only on the translucent roles; no var(), calc(), color-mix(), url() or colour names.";

/** The part of a conforming theme the host lets through, and the warnings for what it holds back. */
export interface ThemeRequest {
  readonly scheme: ThemeScheme | undefined;
  /** Role → colour, in the document's order. */
  readonly tokens: ReadonlyMap<string, string>;
  readonly issues: readonly Issue[];
}

const NOTHING: ThemeRequest = { scheme: undefined, tokens: new Map(), issues: [] };

/** What a conforming `theme` asks for under `policy`. */
export function themeRequest(theme: { readonly scheme?: unknown; readonly tokens?: unknown } | undefined, policy: HostPolicy): ThemeRequest {
  if (theme === undefined) return NOTHING;
  if (policy.themeOverrides === false) {
    const message = "The host does not allow theme overrides; the view renders in the host's theme.";
    return { ...NOTHING, issues: [makeIssue("theme-disabled", THEME_PATH, message)] };
  }
  const allowed = allowedThemeTokens(policy);
  const tokens = new Map<string, string>();
  const issues: Issue[] = [];
  for (const [name, value] of Object.entries(isPlainObject(theme.tokens) ? theme.tokens : {})) {
    if (typeof value !== "string") continue;
    if (allowed.has(name)) tokens.set(name, value);
    else issues.push(makeIssue("theme-disabled", tokenPath(name), `The host does not let a document set \`${name}\`; it keeps the host's value.`));
  }
  return { scheme: isOneOf(THEME_SCHEMES, theme.scheme) ? theme.scheme : undefined, tokens, issues };
}

// ---------------------------------------------------------------------------
// The contrast contract

export interface ContrastFailure {
  /** A pair below its floor, or the scheme row: text and canvas in the wrong order for the scheme. */
  readonly kind: "pair" | "scheme";
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
  /** Undefined when a side could not be measured. */
  readonly ratio: number | undefined;
}

/** What the palette is judged with: every role's colour text, and the scheme when one is known. */
export interface Palette {
  readonly colours: ReadonlyMap<string, string>;
  /** `--SCHEME-DARK` as 0 or 1; the coherence row is skipped when undefined. */
  readonly schemeDark: 0 | 1 | undefined;
}

/**
 * Every failing pair of the contract that `judged` selects, measured on
 * `palette`; a colour this package cannot read fails its pairs unmeasured. The
 * scheme row (a dark scheme's text lighter than its canvas) is judged when
 * `judgeScheme` is set and the scheme is known.
 */
export function contrastFailures(palette: Palette, judged: (pair: ContrastPair) => boolean, judgeScheme: boolean): ContrastFailure[] {
  const read = (name: string) => {
    const text = palette.colours.get(name);
    return text === undefined ? undefined : parseColour(text);
  };
  const failures: ContrastFailure[] = [];
  const canvas = read(THEME_SCHEME_PAIR.canvas);
  for (const pair of THEME_CONTRAST_PAIRS) {
    if (!judged(pair)) continue;
    const fg = read(pair.fg);
    const bg = read(pair.bg);
    // The canvas sits under a translucent background; an opaque one needs no backdrop.
    const backdrop = bg !== undefined && bg.alpha >= 1 ? bg : canvas;
    if (fg === undefined || bg === undefined || backdrop === undefined) {
      failures.push({ kind: "pair", fg: pair.fg, bg: pair.bg, min: pair.min, ratio: undefined });
      continue;
    }
    const measured = contrastRatio(fg, bg, backdrop);
    // An infinite channel can measure as NaN, which no `<` comparison fails.
    const ratio = Number.isFinite(measured) ? measured : undefined;
    if (ratio === undefined || ratio < pair.min) failures.push({ kind: "pair", fg: pair.fg, bg: pair.bg, min: pair.min, ratio });
  }
  const text = read(THEME_SCHEME_PAIR.text);
  if (judgeScheme && palette.schemeDark !== undefined && text !== undefined && canvas !== undefined) {
    const lighter = relativeLuminance(text) > relativeLuminance(canvas);
    if (lighter !== (palette.schemeDark === 1)) failures.push({ kind: "scheme", fg: THEME_SCHEME_PAIR.text, bg: THEME_SCHEME_PAIR.canvas, min: 0, ratio: undefined });
  }
  return failures;
}

function describe(failure: ContrastFailure, scheme: ThemeScheme | undefined): string {
  if (failure.kind === "scheme") {
    const which = scheme === undefined ? "the scheme" : `\`scheme: "${scheme}"\``;
    return `\`${failure.fg}\` must be ${scheme === "dark" ? "lighter" : "darker"} than \`${failure.bg}\` under ${which}`;
  }
  const measured = failure.ratio === undefined ? "could not be measured" : `is ${failure.ratio.toFixed(2)}:1`;
  return `\`${failure.fg}\` on \`${failure.bg}\` ${measured} (the floor is ${failure.min}:1)`;
}

/**
 * The failures as issues, one per document location: a pair is reported at
 * the foreground's role when the document sets it, else at the background's,
 * and the scheme row at `scheme` when the document sets one.
 */
export function contrastIssues(failures: readonly ContrastFailure[], request: Pick<ThemeRequest, "scheme" | "tokens">): Issue[] {
  const scheme = request.scheme;
  const where = (failure: ContrastFailure) => {
    if (failure.kind === "scheme" && scheme !== undefined) return `${THEME_PATH}/scheme`;
    if (request.tokens.has(failure.fg)) return tokenPath(failure.fg);
    return request.tokens.has(failure.bg) ? tokenPath(failure.bg) : THEME_PATH;
  };
  const grouped = new Map<string, string[]>();
  for (const failure of failures) {
    const path = where(failure);
    grouped.set(path, [...(grouped.get(path) ?? []), describe(failure, scheme)]);
  }
  return [...grouped].map(([path, lines]) =>
    makeIssue("theme-contrast", path, `Below the contrast contract: ${lines.join("; ")}. The whole theme is refused; the host's theme stands.`),
  );
}

/**
 * The validator's half: what the host holds back, and the floors whose roles
 * the document sets on both sides (the host's palette is unknown to it).
 * Nothing for a theme that does not conform: the schema reports that.
 */
export function adviseTheme(theme: unknown, policy: HostPolicy): Issue[] {
  if (theme === undefined || themeProblem(theme) !== undefined) return [];
  const request = themeRequest(theme as ThemeSpec, policy);
  return [...request.issues, ...contrastIssues(documentFailures(request), request)];
}

/** The failures a request decides alone: the floors whose roles it sets on both sides, and its scheme against its own text and canvas. */
export function documentFailures(request: Pick<ThemeRequest, "scheme" | "tokens">): ContrastFailure[] {
  const { tokens, scheme } = request;
  const schemeDark = scheme === undefined ? undefined : scheme === "dark" ? 1 : 0;
  return contrastFailures({ colours: tokens, schemeDark }, (pair) => tokens.has(pair.fg) && tokens.has(pair.bg), true);
}
