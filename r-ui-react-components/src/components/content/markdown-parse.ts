/**
 * Markdown -> tree, for `Markdown.tsx`. Internal: not exported from any barrel.
 *
 * Ported from the previous generation's own parser, with every recorded finding
 * kept beside the code it explains. It parses a **closed GFM subset** rather
 * than CommonMark: ATX headings, paragraphs, emphasis / strong / strikethrough,
 * links and angle autolinks, inline code, lists (nested, ordered, loose, task
 * items), blockquotes, fenced code, pipe tables, thematic breaks and images.
 * Building it instead of taking a dependency buys the property that matters most:
 * the output is a tree the renderer turns into React elements, so nothing here
 * produces an HTML string and there is no sanitizer to misconfigure. The XSS
 * surface of injected markup is not mitigated, it is absent.
 *
 * Deliberately NOT here, each a well of complexity with no demand behind it:
 * reference links and their definitions, setext headings, lazy continuation
 * lines, indented (4-space) code blocks, footnotes and raw HTML. Raw HTML stays
 * literal text (React escapes it); see `stripComments` for the one exception.
 * URLs pass `safeUrl` here, so a refused scheme never reaches the tree.
 */

import { safeUrl } from "../../util/url";

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "del"; children: InlineNode[] }
  | { type: "break" }
  | { type: "link"; href: string; title?: string; children: InlineNode[] }
  | { type: "image"; src: string; alt: string; title?: string };

/** `checked` is set only on a GFM task item (`- [ ]` / `- [x]`). */
export type ListItem = { children: BlockNode[]; checked?: boolean };

export type TableAlign = "left" | "center" | "right" | null;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type BlockNode =
  | { type: "heading"; level: HeadingLevel; children: InlineNode[] }
  | { type: "paragraph"; children: InlineNode[] }
  | { type: "code"; value: string; lang?: string }
  /** `loose`: a blank line separated two items, so each item is a paragraph. */
  | { type: "list"; ordered: boolean; start: number; loose: boolean; items: ListItem[] }
  | { type: "blockquote"; children: BlockNode[] }
  | { type: "table"; align: TableAlign[]; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: "hr" };

/* ------------------------------------------------------------------ */
/*  Preprocessing                                                      */
/* ------------------------------------------------------------------ */

/**
 * HTML comments are dropped rather than escaped. Every other tag renders as
 * literal text, which is the honest reading of "no raw HTML" — but a comment
 * has no visible rendering under CommonMark either, so escaping it would put
 * `<!-- GENERATED:components -->` on the page, which is the one outcome no
 * author ever wants. Dropping is both safe (a comment cannot execute) and what
 * the author meant.
 *
 * Runs before block splitting so a multi-line comment cannot fragment a table
 * or a list.
 */
function stripComments(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let pending: string[] = [];
  let closer: RegExp | null = null;

  const flush = () => {
    if (!pending.length) return;
    out.push(dropComments(pending.join("\n")));
    pending = [];
  };

  // Fence bodies are skipped entirely. A global regex over the source deleted
  // `<!-- keep -->` out of a fenced markdown sample, which is the one place the
  // characters are content rather than metadata.
  for (const line of lines) {
    if (closer) {
      out.push(line);
      if (closer.test(line)) closer = null;
      continue;
    }
    const open = FENCE.exec(line);
    if (open) {
      flush();
      out.push(line);
      closer = fenceCloser(open[1] ?? "```");
      continue;
    }
    pending.push(line);
  }
  flush();
  return out.join("\n");
}

const OWN_LINE_END = /[ \t]*\n/y;
const isBlank = (s: string) => /^[ \t]*$/.test(s);

/**
 * Removes each `<!-- … -->` in one left-to-right pass. A comment alone on its
 * line(s) takes its indent and line break with it: the blank line left behind
 * would be a block terminator, so a comment between two table rows would split
 * the table. The pass replaced a whole-line regex that, lazy across lines,
 * matched from one comment to a later line's and deleted the text between
 * them, and that rescanned to the end at every unclosed `<!--` (quadratic).
 */
function dropComments(text: string): string {
  const kept: string[] = [];
  // Nothing but spaces and tabs kept since the last line break.
  let lineBlank = true;
  const keep = (part: string) => {
    if (!part) return;
    kept.push(part);
    const lastBreak = part.lastIndexOf("\n");
    lineBlank = lastBreak === -1 ? lineBlank && isBlank(part) : isBlank(part.slice(lastBreak + 1));
  };
  const dropIndent = () => {
    for (let last = kept.at(-1); last !== undefined; last = kept.at(-1)) {
      let end = last.length;
      while (end > 0 && (last[end - 1] === " " || last[end - 1] === "\t")) end--;
      if (end === last.length) return;
      if (end > 0) {
        kept[kept.length - 1] = last.slice(0, end);
        return;
      }
      kept.pop();
    }
  };

  let at = 0;
  for (;;) {
    const open = text.indexOf("<!--", at);
    if (open === -1) break;
    const close = text.indexOf("-->", open + 4);
    // Unclosed: no later comment can close either, so the rest stays text.
    if (close === -1) break;
    keep(text.slice(at, open));
    at = close + 3;
    OWN_LINE_END.lastIndex = at;
    if (lineBlank && OWN_LINE_END.test(text)) {
      at = OWN_LINE_END.lastIndex;
      dropIndent();
    }
  }
  keep(text.slice(at));
  return kept.join("");
}

/** The closing run for an opening fence: same character, at least as long. */
function fenceCloser(open: string): RegExp {
  return new RegExp(`^ {0,3}${open[0] === "`" ? "`" : "~"}{${open.length},}\\s*$`);
}

/**
 * Tabs expand to four spaces before any indentation is measured. List nesting
 * here is decided by leading-space count, and a tab that stayed a tab would
 * count as one — so a tab-indented sub-item would silently flatten into its
 * parent's list rather than nesting.
 */
function normalise(src: string): string {
  return stripComments(src.replace(/\r\n?/g, "\n")).replace(/\t/g, "    ");
}

/* ------------------------------------------------------------------ */
/*  Inline                                                             */
/* ------------------------------------------------------------------ */

/** CommonMark's escapable set: any ASCII punctuation, and nothing else. */
const ESCAPABLE = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/;

const AUTOLINK = /^<((?:https?|mailto|tel):[^\s<>]+)>/i;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/**
 * Scans forward from an opening `[` to its matching `]`, honouring nesting and
 * backslash escapes. Returns -1 when unmatched, which is what makes a stray `[`
 * render as a literal bracket instead of eating the rest of the paragraph.
 *
 * The scan is capped at CommonMark's own limit — a link label may hold at most
 * 999 characters. Uncapped, a run of `[` is quadratic: each one rescans to the
 * end of the string and fails. Measured before the cap, 100 000 brackets took
 * 8.6 s and a million would have taken about fourteen minutes of blocked main
 * thread, on the "stray brackets" input this parser is supposed to shrug off.
 */
const MAX_LINK_LABEL = 1000;

function findClosingBracket(src: string, open: number): number {
  let depth = 0;
  const limit = Math.min(src.length, open + MAX_LINK_LABEL);
  for (let i = open; i < limit; i++) {
    const ch = src[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * cmark's own cap on parenthesis nesting in a destination (CommonMark allows a
 * limit). Uncapped, every `[a](` in a run of them rescanned to the end of the
 * string looking for its `)`: 160 000 characters took 4.3s under Bun. Capped, a scan
 * fails once 32 openers are pending, so the scans overlap at most 32 deep.
 */
const MAX_PAREN_DEPTH = 32;

/**
 * Reads the `(url "title")` half of a link. Returns null when it is not there,
 * so `[text]` with no destination falls back to literal text rather than
 * silently swallowing the label — the failure mode of a greedy link parser.
 */
function readDestination(
  src: string,
  start: number
): { href: string; title?: string; end: number } | null {
  if (src[start] !== "(") return null;
  let depth = 0;
  let i = start;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "(") {
      if (++depth > MAX_PAREN_DEPTH) return null;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) return null;

  const inner = src.slice(start + 1, i);
  const titled = /^(\S*)\s+["'(]([\s\S]*)["')]$/.exec(inner);
  if (titled) return { href: unwrapAngles(unescape(titled[1] ?? "")), title: titled[2], end: i + 1 };
  return { href: unwrapAngles(unescape(inner.trim())), end: i + 1 };
}

/**
 * `<…>` around a destination is CommonMark's way of allowing spaces in it.
 * Unwrapped here rather than left alone, because leaving it means the brackets
 * ride into the `href` — which produces a scheme no browser recognises, so the
 * link silently becomes a relative path to nowhere AND slips past `safeUrl`
 * unexamined. Unwrapping makes it an ordinary URL that the gate then judges.
 */
function unwrapAngles(href: string): string {
  return href.startsWith("<") && href.endsWith(">") ? href.slice(1, -1).trim() : href;
}

/** Resolves backslash escapes in a raw run of text. */
function unescape(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const next = value[i + 1];
    if (value[i] === "\\" && next !== undefined && ESCAPABLE.test(next)) {
      out += value[i + 1];
      i++;
    } else {
      out += value[i];
    }
  }
  return out;
}

/**
 * Matches a run of N backticks with the next run of exactly N, which is what
 * lets ``` ``a ` b`` ``` hold a backtick. Returns null when there is no closing
 * run, so an odd backtick is literal text rather than a code span swallowing
 * the paragraph.
 */
function readCodeSpan(src: string, start: number): { value: string; end: number } | null {
  const open = /^`+/.exec(src.slice(start));
  if (!open) return null;
  const ticks = open[0];
  const closeAt = src.indexOf(ticks, start + ticks.length);
  if (closeAt === -1) return null;
  // A same-length run must not be part of a longer one, or `` ` `` would close
  // against the first tick of a ``` ``` ``` fence remnant.
  if (src[closeAt + ticks.length] === "`") return null;

  const raw = src.slice(start + ticks.length, closeAt);
  // CommonMark strips one leading and trailing space when both are present, so
  // `` ` `` can hold a bare backtick.
  const value =
    raw.length > 2 && raw.startsWith(" ") && raw.endsWith(" ") ? raw.slice(1, -1) : raw;
  return { value, end: closeAt + ticks.length };
}

/**
 * Finds the closing delimiter for emphasis, skipping code spans so that
 * `` *a `b*c` d* `` closes on the last star and not the one inside the ticks.
 */
function findEmphasisClose(src: string, from: number, delim: string): number {
  for (let i = from; i < src.length; i++) {
    // The intraword rule is two-sided. Guarding only the opening delimiter let
    // a stray `_` earlier in a sentence close against the first underscore of a
    // later identifier — `The _init hook reads snake_case_name` rendered as
    // "The init hook reads snake" + "case_name", silently deleting characters
    // from the very construct the guard exists to protect.
    if (src.startsWith(delim, i) && isIntrawordClose(src, i, delim)) continue;
    if (src[i] === "\\") {
      i++;
      continue;
    }
    if (src[i] === "`") {
      const span = readCodeSpan(src, i);
      if (span) {
        i = span.end - 1;
        continue;
      }
    }
    if (src.startsWith(delim, i)) return i;
  }
  return -1;
}

/**
 * An underscore inside a word is not emphasis — `snake_case_name` is one word,
 * and treating it as emphasis is the single most common way a naive renderer
 * mangles technical prose. Asterisks carry no such rule, so `a*b*c` does
 * emphasise, matching CommonMark.
 */
function isIntraword(src: string, index: number, delim: string): boolean {
  if (delim[0] !== "_") return false;
  const before = src[index - 1];
  return before !== undefined && WORD_CHAR.test(before);
}

/**
 * A `_` run with a word character on BOTH sides cannot close emphasis —
 * CommonMark's flanking rule. Asterisks are exempt, matching CommonMark.
 */
function isIntrawordClose(src: string, index: number, delim: string): boolean {
  if (delim[0] !== "_") return false;
  const before = src[index - 1];
  const after = src[index + delim.length];
  return before !== undefined && after !== undefined && WORD_CHAR.test(before) && WORD_CHAR.test(after);
}

/** A construct read at an index: the nodes it makes and the index after it. */
type InlineRead = { nodes: InlineNode[]; end: number };

function readCode(src: string, start: number): InlineRead | null {
  const span = readCodeSpan(src, start);
  return span && { nodes: [{ type: "code", value: span.value }], end: span.end };
}

function readAutolink(src: string, start: number): InlineRead | null {
  const auto = AUTOLINK.exec(src.slice(start));
  if (!auto) return null;
  const target = auto[1] ?? "";
  const href = safeUrl(target);
  const node: InlineNode = href
    ? { type: "link", href, children: [{ type: "text", value: target }] }
    : { type: "text", value: auto[0] };
  return { nodes: [node], end: start + auto[0].length };
}

/** `[label](dest)` or `![alt](dest)`: null without a closing bracket and a destination. */
function readLinkOrImage(src: string, start: number): InlineRead | null {
  const isImage = src[start] === "!";
  const open = start + (isImage ? 1 : 0);
  const close = findClosingBracket(src, open);
  if (close === -1) return null;
  const dest = readDestination(src, close + 1);
  if (!dest) return null;
  const label = src.slice(open + 1, close);
  if (isImage) {
    const imageSrc = safeUrl(dest.href);
    // An image whose src is refused becomes its own alt text: dropping
    // the node would lose the author's words, and an <img> with no src
    // is a broken-image icon in every browser.
    const node: InlineNode = imageSrc
      ? { type: "image", src: imageSrc, alt: unescape(label), title: dest.title }
      : { type: "text", value: unescape(label) };
    return { nodes: [node], end: dest.end };
  }
  const children = parseInline(label);
  // Links never nest (an <a> inside an <a> is invalid HTML). As CommonMark
  // has it, the inner link wins: these brackets are literal text, and the
  // destination after them is parsed as ordinary text from `]` on. The label's
  // nodes are kept as parsed, so nothing is parsed twice.
  if (containsLink(children)) {
    return { nodes: joinText([{ type: "text", value: "[" }, ...children, { type: "text", value: "]" }]), end: close + 1 };
  }
  const href = safeUrl(dest.href);
  // Same reasoning: a refused href leaves the link text behind rather
  // than an <a> that goes nowhere.
  return { nodes: href ? [{ type: "link", href, title: dest.title, children }] : children, end: dest.end };
}

/** Merges neighbouring text nodes, so literal brackets read as one run with the text beside them. */
function joinText(nodes: readonly InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const node of nodes) {
    const last = out[out.length - 1];
    if (node.type === "text" && last?.type === "text") out[out.length - 1] = { type: "text", value: last.value + node.value };
    else out.push(node);
  }
  return out;
}

function containsLink(nodes: readonly InlineNode[]): boolean {
  return nodes.some(
    (node) =>
      node.type === "link" ||
      ((node.type === "strong" || node.type === "em" || node.type === "del") && containsLink(node.children)),
  );
}

function readStrikethrough(src: string, start: number): InlineRead | null {
  const close = findEmphasisClose(src, start + 2, "~~");
  if (close === -1) return null;
  return { nodes: [{ type: "del", children: parseInline(src.slice(start + 2, close)) }], end: close + 2 };
}

/** `*em*`, `_em_`, `**strong**` or `__strong__` opening at `start`. */
function readEmphasis(src: string, start: number): InlineRead | null {
  const ch = src[start] ?? "";
  const double = src.startsWith(ch + ch, start);
  const delim = double ? ch + ch : ch;
  // An emphasis run must not open on whitespace — `a * b * c` is three
  // words and a pair of stray asterisks, not emphasis.
  const after = src[start + delim.length];
  if (after === undefined || /\s/.test(after)) return null;
  const close = findEmphasisClose(src, start + delim.length, delim);
  if (close === -1 || /\s/.test(src[close - 1] ?? " ")) return null;
  const children = parseInline(src.slice(start + delim.length, close));
  return { nodes: [{ type: double ? "strong" : "em", children }], end: close + delim.length };
}

/** The construct opening at `index`, or null when its character is literal text there. */
function readConstruct(src: string, index: number): InlineRead | null {
  const ch = src[index];
  const next = src[index + 1];
  if (ch === "`") return readCode(src, index);
  // A `<` that opens no autolink stays literal text, and because the AST
  // carries text rather than markup, React escapes it on render — which is
  // what makes `<GridColumnCount>` in a table cell show up verbatim.
  if (ch === "<") return readAutolink(src, index);
  if (ch === "[" || (ch === "!" && next === "[")) return readLinkOrImage(src, index);
  if (ch === "~" && next === "~") return readStrikethrough(src, index);
  if ((ch === "*" || ch === "_") && !isIntraword(src, index, ch)) return readEmphasis(src, index);
  return null;
}

export function parseInline(src: string): InlineNode[] {
  const out: InlineNode[] = [];
  let text = "";

  const flush = () => {
    if (text) out.push({ type: "text", value: text });
    text = "";
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\") {
      const next = src[i + 1];
      if (next === "\n") {
        // Backslash at end of line is a hard break.
        flush();
        out.push({ type: "break" });
        i += 2;
        continue;
      }
      if (next !== undefined && ESCAPABLE.test(next)) {
        text += next;
        i += 2;
        continue;
      }
      text += ch;
      i++;
      continue;
    }

    if (ch === "\n") {
      // Two or more trailing spaces before the newline is a hard break;
      // otherwise a newline inside a paragraph is a space. Read from the
      // source: `text.endsWith` flattened the growing string at every line,
      // quadratic in a long paragraph (80 000 lines took 15s under Bun).
      if (src[i - 1] === " " && src[i - 2] === " ") {
        text = text.replace(/ +$/, "");
        flush();
        out.push({ type: "break" });
      } else {
        text += " ";
      }
      i++;
      continue;
    }

    const read = readConstruct(src, i);
    if (read) {
      flush();
      out.push(...read.nodes);
      i = read.end;
      continue;
    }
    text += ch;
    i++;
  }

  flush();
  return out;
}

/* ------------------------------------------------------------------ */
/*  Blocks                                                             */
/* ------------------------------------------------------------------ */

/**
 * The heading text is captured **greedily** and trimmed in code. Two reasons,
 * both measured. `\s*#*\s*$` ate the `#` of a heading ending in `C#`, because
 * it does not require the whitespace CommonMark does. And a lazy `(.*?)` next
 * to a trailing `[ \t]*$` is an ambiguous split: under JavaScriptCore
 * (Safari, Bun) `# x` followed by 1000 tabs took 14.8 s to match.
 */
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
/**
 * Only the FIRST word of the info string is the language; the rest is ignored
 * rather than rejected. Anchoring `$` after a single `\S*` made
 * ```` ```ts title="x" ```` not a fence at all — the body then rendered as a
 * paragraph and the closing fence opened an unterminated one.
 *
 * The ` {0,3}` prefix matches the closing run's, which already allowed it.
 */
const FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*(\S*)[^\n]*$/;
const HR = /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;
const UL_ITEM = /^( *)([-*+])( +)(.*)$/;
const OL_ITEM = /^( *)(\d{1,9})([.)])( +)(.*)$/;
const BLOCKQUOTE = /^ {0,3}> ?(.*)$/;
const TASK = /^\[([ xX])\](?:[ \t]+|$)/;
/**
 * The `| --- | :-: |` row. Two things about the spelling are load-bearing.
 *
 * A **one-column** table must match: the obvious form makes the separating pipe
 * part of a repeated group and then silently requires two columns.
 *
 * The leading indent is ` {0,3}` and NOT ` *`. With `^ *` followed by another
 * ` *`, a run of n spaces has O(n²) split points to try before the match can
 * fail — measured, a 62 kB document whose delimiter candidate carried 64 000
 * spaces froze the thread for 3.4 s. ` {0,3}` is CommonMark's actual rule and
 * the backtracking disappears with it (0.4 ms on the same input).
 */
const TABLE_DELIM = /^ {0,3}\|? *:?-+:? *(?:\| *:?-+:? *)*\|? *$/;

/**
 * Splits a table row on unescaped pipes. The specimen escapes 164 of them
 * (`"r1"\|"r2"` inside a cell), and a splitter that ignored `\|` would shred
 * those rows into the wrong number of cells — silently, since a ragged row
 * still renders.
 */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "\\" && trimmed[i + 1] === "|") {
      // Resolved to a literal pipe HERE, not left as `\|` for `parseInline`.
      // GFM replaces the escape before inline parsing, and deferring it meant a
      // code span kept the backslash — `` `"a" \| "b"` `` rendered the slash,
      // which is every union-type row in a generated prop table.
      cur += "|";
      i++;
      continue;
    }
    if (ch === "|") {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function readAlign(delim: string): TableAlign[] {
  return splitRow(delim).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return null;
  });
}

/**
 * CommonMark's optional closing run, which must be preceded by whitespace. That
 * requirement is the whole rule: without it `# Notes on C#` loses its hash, and
 * `# C\#` loses the escape too.
 */
function trimClosingHashes(text: string): string {
  return text.replace(/(^|[ \t])#+[ \t]*$/, "$1").trimEnd();
}

const indentOf = (line: string) => /^ */.exec(line)![0].length;

/** One list item's anatomy, or null when the line is not one. */
type ItemMatch = {
  indent: number;
  ordered: boolean;
  /** `-`, `*`, `+` for bullets; `.` or `)` for ordered. A change starts a new list. */
  marker: string;
  start: number;
  content: string;
  /** Column the content starts at, used to de-indent continuation lines. */
  contentIndent: number;
};

function readItem(line: string): ItemMatch | null {
  const ul = UL_ITEM.exec(line);
  if (ul) {
    const [, lead = "", bullet = "", gap = "", content = ""] = ul;
    return {
      indent: lead.length,
      ordered: false,
      marker: bullet,
      start: 1,
      content,
      contentIndent: lead.length + bullet.length + gap.length,
    };
  }
  const ol = OL_ITEM.exec(line);
  if (!ol) return null;
  const [, lead = "", digits = "", delim = "", gap = "", content = ""] = ol;
  return {
    indent: lead.length,
    ordered: true,
    marker: delim,
    start: Number(digits),
    content,
    contentIndent: lead.length + digits.length + delim.length + gap.length,
  };
}

/**
 * True for a line that ends the paragraph it would otherwise continue. `next`
 * is needed for the table case alone: a header row is ordinary text, and only
 * the delimiter line beneath it makes the pair a table — so a paragraph running
 * straight into a table can only be stopped by looking one line ahead.
 */
function startsBlock(line: string, next: string | undefined): boolean {
  return (
    ATX.test(line) ||
    FENCE.test(line) ||
    HR.test(line) ||
    UL_ITEM.test(line) ||
    OL_ITEM.test(line) ||
    BLOCKQUOTE.test(line) ||
    line.trim() === "" ||
    (line.includes("|") && next !== undefined && TABLE_DELIM.test(next))
  );
}

/**
 * How deep blockquote-in-list-in-blockquote may go before the content is kept
 * as plain text. Real documents nest two or three levels; 2000 `>` on one line
 * is not a document, and before this cap it was a `RangeError` in V8 — or, for
 * a deeply nested list, a hard process exit that no error boundary can catch.
 *
 * Eight, not the 32 that only guarded the stack: every level is an indent
 * (a quote's bar and padding, a list's gutter), and measured in the showcase 32
 * levels pushed the text about 550px in, past a phone's width. Eight levels stay
 * inside 375px with room for the words.
 */
const MAX_BLOCK_DEPTH = 8;

/** A block read from `lines` at an index: the node and the index of the line after it. */
type BlockRead = { node: BlockNode; end: number };

const lineAt = (lines: readonly string[], index: number): string => lines[index] ?? "";

function readFence(lines: readonly string[], start: number, fence: RegExpExecArray): BlockRead {
  const close = fenceCloser(fence[1] ?? "```");
  const body: string[] = [];
  let i = start + 1;
  // An unclosed fence runs to the end of the document rather than throwing
  // or falling back to paragraphs — the same choice CommonMark makes, and
  // the one that keeps a half-streamed LLM response readable.
  while (i < lines.length) {
    const line = lineAt(lines, i++);
    if (close.test(line)) break;
    body.push(line);
  }
  return { node: { type: "code", value: body.join("\n"), lang: fence[2] || undefined }, end: i };
}

/**
 * A table is a header row plus a delimiter row whose cell count MATCHES,
 * which is GFM's rule and not a detail: without the count check
 * `Some | text` followed by `---` became a two-column table with an empty
 * body, swallowing a thematic rule that should have followed a paragraph.
 */
function readTable(lines: readonly string[], start: number): BlockRead | null {
  const line = lineAt(lines, start);
  if (!line.includes("|") || start + 1 >= lines.length || !TABLE_DELIM.test(lineAt(lines, start + 1))) return null;
  const headerCells = splitRow(line);
  const align = readAlign(lineAt(lines, start + 1));
  if (align.length !== headerCells.length) return null;
  const header = headerCells.map((cell) => parseInline(cell));
  const rows: InlineNode[][][] = [];
  let i = start + 2;
  while (i < lines.length && lineAt(lines, i).trim() !== "" && lineAt(lines, i).includes("|")) {
    rows.push(splitRow(lineAt(lines, i)).map((cell) => parseInline(cell)));
    i++;
  }
  return { node: { type: "table", align, header, rows }, end: i };
}

function readBlockquote(lines: readonly string[], start: number, depth: number): BlockRead {
  const body: string[] = [];
  let i = start;
  // Every line must carry its own `>`. Lazy continuation — a bare line
  // adopted into the quote because the previous one was quoted — is one of
  // the constructs this subset drops, and accepting it here would let a
  // quote swallow the heading that follows it.
  while (i < lines.length) {
    const m = BLOCKQUOTE.exec(lineAt(lines, i));
    if (!m) break;
    body.push(m[1] ?? "");
    i++;
  }
  return { node: { type: "blockquote", children: parseBlocks(body.join("\n"), depth + 1) }, end: i };
}

function readList(lines: readonly string[], start: number, first: ItemMatch, depth: number): BlockRead {
  const { indent: baseIndent, ordered, marker, start: startAt, contentIndent } = first;
  const items: ListItem[] = [];
  let buffer: string[] = [];
  // A blank line between two items makes the list LOOSE, which is what
  // decides whether each item gets a paragraph. Splitting the list at the
  // blank instead — the old behaviour — turned `- a\n\n- b` into two
  // one-item lists, announced by a screen reader as "list, 1 item" twice,
  // and blank-separated bullets are the dominant shape in generated prose.
  let loose = false;
  let sawBlank = false;

  let checked: boolean | undefined;

  const commit = () => {
    if (buffer.length) {
      const children = parseBlocks(buffer.join("\n"), depth + 1);
      items.push(checked === undefined ? { children } : { children, checked });
    }
    buffer = [];
    checked = undefined;
  };

  let i = start;
  while (i < lines.length) {
    const current = lineAt(lines, i);

    if (current.trim() === "") {
      // Look past the run of blanks. The list continues if what follows is
      // a sibling item or indented continuation; anything else ends it.
      let j = i;
      while (j < lines.length && lineAt(lines, j).trim() === "") j++;
      const next = lines[j];
      if (next === undefined) break;
      const nextItem = readItem(next);
      const continues =
        indentOf(next) > baseIndent ||
        (nextItem !== null &&
          nextItem.indent === baseIndent &&
          nextItem.ordered === ordered &&
          nextItem.marker === marker);
      if (!continues) break;
      sawBlank = true;
      buffer.push("");
      i = j;
      continue;
    }

    const here = readItem(current);
    const indent = indentOf(current);

    if (here && indent === baseIndent) {
      // CommonMark: a different bullet character, or a different ordered
      // delimiter, starts a NEW list rather than continuing this one.
      if (here.ordered !== ordered || here.marker !== marker) break;
      if (sawBlank) loose = true;
      sawBlank = false;
      commit();
      // GFM task item: `[ ]` / `[x]` opening the item, then whitespace or nothing.
      const task = TASK.exec(here.content);
      checked = task ? task[1] !== " " : undefined;
      buffer.push(task ? here.content.slice(task[0].length) : here.content);
      i++;
      continue;
    }
    if (indent > baseIndent) {
      buffer.push(current.slice(Math.min(indent, contentIndent)));
      i++;
      continue;
    }
    break;
  }
  commit();
  return { node: { type: "list", ordered, start: startAt, loose, items }, end: i };
}

/** A paragraph runs to the next blank line or block start. */
function readParagraph(lines: readonly string[], start: number): BlockRead {
  const para: string[] = [lineAt(lines, start)];
  let i = start + 1;
  while (i < lines.length && !startsBlock(lineAt(lines, i), lines[i + 1])) {
    para.push(lineAt(lines, i));
    i++;
  }
  return { node: { type: "paragraph", children: parseInline(para.join("\n")) }, end: i };
}

/** The block starting on the (non-blank) line at `start`. */
function readBlock(lines: readonly string[], start: number, depth: number): BlockRead {
  const line = lineAt(lines, start);

  const fence = FENCE.exec(line);
  if (fence) return readFence(lines, start, fence);

  const atx = ATX.exec(line);
  if (atx) {
    const level = (atx[1] ?? "#").length as HeadingLevel;
    const children = parseInline(trimClosingHashes((atx[2] ?? "").trimEnd()));
    return { node: { type: "heading", level, children }, end: start + 1 };
  }

  // HR is tested before list items so `---` is a rule, not a bullet.
  if (HR.test(line)) return { node: { type: "hr" }, end: start + 1 };

  const table = readTable(lines, start);
  if (table) return table;

  if (BLOCKQUOTE.test(line)) return readBlockquote(lines, start, depth);

  const first = readItem(line);
  if (first) return readList(lines, start, first, depth);

  return readParagraph(lines, start);
}

export function parseBlocks(src: string, depth = 0): BlockNode[] {
  if (depth > MAX_BLOCK_DEPTH) {
    return src.trim() ? [{ type: "paragraph", children: [{ type: "text", value: src }] }] : [];
  }
  const lines = normalise(src).split("\n");
  const out: BlockNode[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lineAt(lines, i).trim() === "") {
      i++;
      continue;
    }
    const { node, end } = readBlock(lines, i, depth);
    out.push(node);
    i = end;
  }
  return out;
}
