/**
 * Whether a document's `pattern` is safe to run on a user's input. The input
 * cap (`LIMITS.patternInput`) bounds polynomial backtracking but not
 * exponential: `^(a+)+$` on forty characters hangs the tab. So the shapes
 * that backtrack catastrophically are refused before a pattern is compiled
 * for use, by the forms (the rule then never passes) and the validator (a
 * warning) alike.
 *
 * Refused: a backreference; a repeat inside a repeat, unless each turn of the
 * outer one starts with a fixed character the inner repeats cannot match
 * (`(?:-[a-z]+)*` passes); alternatives under a repeat that can start alike
 * (`(a|ab)+`); and two unbounded repeats side by side, with only optional
 * pieces between them, where the first can consume what the second starts
 * with (`\d+\d*`). Conservative: a safe pattern may be refused, never the
 * reverse for these shapes. Character sets are compared over a sample of
 * characters (ASCII, Latin, and one of each common block).
 */

interface CharAtom {
  readonly kind: "char";
  /** The atom's source: a literal, an escape, a bracket class or `.`. */
  readonly source: string;
}

interface GroupAtom {
  readonly kind: "group";
  readonly alternatives: readonly Sequence[];
}

/** A lookaround: matches nothing itself, but its body is checked. */
interface LookAtom {
  readonly kind: "look";
  readonly alternatives: readonly Sequence[];
}

interface AnchorAtom {
  readonly kind: "anchor";
}

interface BackrefAtom {
  readonly kind: "backref";
}

type Atom = CharAtom | GroupAtom | LookAtom | AnchorAtom | BackrefAtom;

interface Term {
  readonly atom: Atom;
  readonly min: number;
  readonly max: number;
}

type Sequence = readonly Term[];

class Parser {
  private index = 0;

  constructor(private readonly source: string) {}

  parse(): Sequence[] {
    return this.disjunction();
  }

  private peek(offset = 0): string {
    return this.source.charAt(this.index + offset);
  }

  private disjunction(): Sequence[] {
    const alternatives: Sequence[] = [this.sequence()];
    while (this.peek() === "|") {
      this.index += 1;
      alternatives.push(this.sequence());
    }
    return alternatives;
  }

  private sequence(): Sequence {
    const terms: Term[] = [];
    while (this.index < this.source.length && this.peek() !== "|" && this.peek() !== ")") {
      const atom = this.atom();
      const [min, max] = this.quantifier();
      terms.push({ atom, min, max });
    }
    return terms;
  }

  private atom(): Atom {
    const start = this.index;
    const char = this.peek();
    if (char === "^" || char === "$") {
      this.index += 1;
      return { kind: "anchor" };
    }
    if (char === "(") return this.group();
    if (char === "[") {
      this.index += this.peek(1) === "^" ? 2 : 1;
      while (this.index < this.source.length && this.peek() !== "]") this.index += this.peek() === "\\" ? 2 : 1;
      this.index += 1;
      return { kind: "char", source: this.source.slice(start, this.index) };
    }
    if (char === "\\") return this.escape();
    this.index += 1;
    return { kind: "char", source: char };
  }

  private escape(): Atom {
    const start = this.index;
    const next = this.peek(1);
    if (next === "b" || next === "B") {
      this.index += 2;
      return { kind: "anchor" };
    }
    if (/[1-9]/.test(next) || (next === "k" && this.peek(2) === "<")) {
      this.index += 2;
      return { kind: "backref" };
    }
    const rest = this.source.slice(this.index + 2);
    if (next === "x" && /^[\da-f]{2}/i.test(rest)) this.index += 4;
    else if (next === "u" && /^[\da-f]{4}/i.test(rest)) this.index += 6;
    else if (next === "c" && /^[a-z]/i.test(rest)) this.index += 3;
    else this.index += 2;
    return { kind: "char", source: this.source.slice(start, this.index) };
  }

  private group(): Atom {
    this.index += 1;
    let look = false;
    if (this.peek() === "?") {
      const kind = this.peek(1);
      if (kind === "=" || kind === "!") {
        look = true;
        this.index += 2;
      } else if (kind === "<" && (this.peek(2) === "=" || this.peek(2) === "!")) {
        look = true;
        this.index += 3;
      } else if (kind === "<") {
        this.index = this.source.indexOf(">", this.index) + 1;
      } else {
        this.index += 2;
      }
    }
    const alternatives = this.disjunction();
    this.index += 1;
    return look ? { kind: "look", alternatives } : { kind: "group", alternatives };
  }

  /** `[min, max]`; a `{` that forms no quantifier is a literal (Annex B) and is left for the next atom. */
  private quantifier(): [number, number] {
    const char = this.peek();
    let bounds: [number, number] | undefined;
    if (char === "*") bounds = [0, Infinity];
    else if (char === "+") bounds = [1, Infinity];
    else if (char === "?") bounds = [0, 1];
    if (bounds !== undefined) {
      this.index += 1;
    } else if (char === "{") {
      const match = /^\{(\d+)(,(\d*))?\}/.exec(this.source.slice(this.index));
      if (match === null) return [1, 1];
      const min = Number(match[1]);
      bounds = [min, match[2] === undefined ? min : match[3] === "" ? Infinity : Number(match[3])];
      this.index += match[0].length;
    } else {
      return [1, 1];
    }
    if (this.peek() === "?") this.index += 1;
    return bounds;
  }
}

// ---------------------------------------------------------------------------
// Character sets, as bitsets over a sample of characters

const SAMPLE: readonly string[] = (() => {
  const codes: number[] = [];
  for (let code = 0; code < 0x300; code += 1) codes.push(code);
  for (let code = 0x300; code < 0x10000; code += 0x80) codes.push(code);
  codes.push(0x2028, 0x2029, 0x3000, 0xfeff, 0x0663, 0x4e2d, 0x03a9, 0x0416);
  return codes.map((code) => String.fromCharCode(code));
})();

type CharSet = Uint8Array;

const ALL: CharSet = new Uint8Array(SAMPLE.length).fill(1);
const NONE: CharSet = new Uint8Array(SAMPLE.length);
const charSets = new Map<string, CharSet>();

function charSetOf(source: string): CharSet {
  let set = charSets.get(source);
  if (set === undefined) {
    let matcher: RegExp;
    try {
      matcher = new RegExp(`^(?:${source})$`);
    } catch {
      return ALL;
    }
    set = new Uint8Array(SAMPLE.length);
    SAMPLE.forEach((char, index) => {
      if (matcher.test(char)) (set as CharSet)[index] = 1;
    });
    charSets.set(source, set);
  }
  return set;
}

function union(sets: readonly CharSet[]): CharSet {
  const out = new Uint8Array(SAMPLE.length);
  for (const set of sets) set.forEach((bit, index) => (out[index] = out[index] === 1 ? 1 : bit));
  return out;
}

function overlap(a: CharSet, b: CharSet): boolean {
  return a.some((bit, index) => bit === 1 && b[index] === 1);
}

function isZeroWidth(atom: Atom): boolean {
  return atom.kind === "anchor" || atom.kind === "look";
}

function nullableAtom(atom: Atom): boolean {
  if (atom.kind === "char") return false;
  if (atom.kind === "group") return atom.alternatives.some((sequence) => sequence.every(nullableTerm));
  return true;
}

function nullableTerm(term: Term): boolean {
  return term.min === 0 || nullableAtom(term.atom);
}

/** Every character the atom can consume. */
function charsOf(atom: Atom): CharSet {
  switch (atom.kind) {
    case "char":
      return charSetOf(atom.source);
    case "group":
      return union(atom.alternatives.flatMap((sequence) => sequence.map((term) => charsOf(term.atom))));
    case "backref":
      return ALL;
    default:
      return NONE;
  }
}

/** The characters a match of the sequence can start with. */
function firstOf(sequence: Sequence): CharSet {
  const sets: CharSet[] = [];
  for (const term of sequence) {
    sets.push(firstOfAtom(term.atom));
    if (!nullableTerm(term)) break;
  }
  return union(sets);
}

function firstOfAtom(atom: Atom): CharSet {
  if (atom.kind === "group") return union(atom.alternatives.map(firstOf));
  return atom.kind === "char" || atom.kind === "backref" ? charsOf(atom) : NONE;
}

/** Terms that match a varying number of times, at any depth inside `alternatives`. */
function variableTerms(alternatives: readonly Sequence[]): Term[] {
  return alternatives.flatMap((sequence) =>
    sequence.flatMap((term) => {
      const inner = term.atom.kind === "group" || term.atom.kind === "look" ? variableTerms(term.atom.alternatives) : [];
      return term.max > term.min && !isZeroWidth(term.atom) ? [term, ...inner] : inner;
    }),
  );
}

/**
 * Whether each turn of a repeated group is pinned: one alternative, starting
 * with a character matched exactly once that none of its varying parts can
 * match, so the turns cannot be split two ways.
 */
function isPinned(group: GroupAtom, variable: readonly Term[]): boolean {
  if (group.alternatives.length !== 1) return false;
  const first = group.alternatives[0]?.[0];
  if (first === undefined || first.atom.kind !== "char" || first.min !== first.max || first.min < 1) return false;
  const pin = charsOf(first.atom);
  return variable.every((term) => !overlap(pin, charsOf(term.atom)));
}

const PROBLEMS = {
  backref: "A backreference (`\\1`, `\\k<name>`) can make a failing match take exponential time; it is refused.",
  nested:
    "A repeat inside a repeat (`(a+)+`) can make a failing match take exponential time; it is refused. Repeat a character class instead (`[a-z0-9-]+`), or start each turn with a character the inner repeat cannot match (`(?:-[a-z]+)*`).",
  alternatives:
    "Alternatives that can start alike under a repeat (`(a|ab)+`) can make a failing match take exponential time; they are refused. Make the alternatives start differently, or use one character class.",
  adjacent:
    "Two unbounded repeats side by side that can match the same characters (`\\d+\\d*`) make a failing match slow; they are refused. Merge them into one repeat.",
} as const;

function sequenceProblem(sequence: Sequence): string | undefined {
  for (const [index, term] of sequence.entries()) {
    const { atom } = term;
    if (atom.kind === "backref") return PROBLEMS.backref;
    if (atom.kind === "group" || atom.kind === "look") {
      const inner = alternativesProblem(atom.alternatives);
      if (inner !== undefined) return inner;
    }
    if (atom.kind === "group" && term.max > 1) {
      const variable = variableTerms(atom.alternatives);
      if (variable.length > 0 && !isPinned(atom, variable)) return PROBLEMS.nested;
      const firsts = atom.alternatives.map(firstOf);
      if (firsts.some((set, at) => firsts.slice(at + 1).some((other) => overlap(set, other)))) return PROBLEMS.alternatives;
    }
    if (term.max === Infinity && !isZeroWidth(atom)) {
      const consumes = charsOf(atom);
      for (const next of sequence.slice(index + 1)) {
        if (next.max === Infinity && overlap(consumes, firstOfAtom(next.atom))) return PROBLEMS.adjacent;
        if (!nullableTerm(next)) break;
      }
    }
  }
  return undefined;
}

function alternativesProblem(alternatives: readonly Sequence[]): string | undefined {
  for (const sequence of alternatives) {
    const problem = sequenceProblem(sequence);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

const problems = new Map<string, string | undefined>();
const MAX_REMEMBERED = 256;

/**
 * Why `source` may not be used as a `pattern` rule (it does not compile, or
 * it can backtrack catastrophically), or undefined when it is safe.
 */
export function patternProblem(source: string): string | undefined {
  if (problems.has(source)) return problems.get(source);
  let problem: string | undefined;
  try {
    new RegExp(source);
    problem = alternativesProblem(new Parser(source).parse());
  } catch {
    problem = "Not a regular expression JavaScript can compile.";
  }
  if (problems.size >= MAX_REMEMBERED) problems.clear();
  problems.set(source, problem);
  return problem;
}
