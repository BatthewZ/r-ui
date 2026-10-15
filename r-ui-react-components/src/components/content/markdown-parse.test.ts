import { describe, expect, it } from "vitest";

import { type BlockNode, type InlineNode, parseBlocks, parseInline } from "./markdown-parse";

/** Flattens an inline tree to its visible text, the way a reader would see it. */
const textOf = (nodes: InlineNode[]): string =>
  nodes
    .map((n) => {
      switch (n.type) {
        case "text":
        case "code":
          return n.value;
        case "image":
          return n.alt;
        case "break":
          return "\n";
        default:
          return textOf(n.children);
      }
    })
    .join("");

const one = (src: string): BlockNode => {
  const blocks = parseBlocks(src);
  expect(blocks).toHaveLength(1);
  return blocks[0]!;
};

describe("blocks", () => {
  it.each([1, 2, 3, 4, 5, 6])("parses an h%i", (level) => {
    const node = one(`${"#".repeat(level)} Title`);
    expect(node).toEqual({ type: "heading", level, children: [{ type: "text", value: "Title" }] });
  });

  it("does not treat a hash without a space as a heading", () => {
    const node = one("#nothashtag");
    expect(node.type).toBe("paragraph");
  });

  it("joins a wrapped paragraph into one block with the newline as a space", () => {
    const node = one("one\ntwo\nthree");
    expect(node.type).toBe("paragraph");
    expect(textOf((node as Extract<BlockNode, { type: "paragraph" }>).children)).toBe("one two three");
  });

  it("parses a fenced block with its language", () => {
    expect(one('```jsonc\n{ "a": 1 }\n```')).toEqual({
      type: "code",
      lang: "jsonc",
      value: '{ "a": 1 }',
    });
  });

  it("keeps markdown syntax inside a fence as literal text", () => {
    const node = one("```\n# not a heading\n**not bold**\n```");
    expect(node).toEqual({ type: "code", lang: undefined, value: "# not a heading\n**not bold**" });
  });

  it("runs an unclosed fence to the end of the document rather than throwing", () => {
    expect(one("```ts\nconst a = 1;\nconst b = 2;")).toEqual({
      type: "code",
      lang: "ts",
      value: "const a = 1;\nconst b = 2;",
    });
  });

  it.each(["---", "***", "___"])("parses %s as a rule, not a list or heading", (rule) => {
    expect(one(rule)).toEqual({ type: "hr" });
  });

  it("parses an unordered list", () => {
    const node = one("- one\n- two");
    expect(node.type).toBe("list");
    const list = node as Extract<BlockNode, { type: "list" }>;
    expect(list.ordered).toBe(false);
    expect(list.items).toHaveLength(2);
    expect(textOf((list.items[1]!.children[0] as Extract<BlockNode, { type: "paragraph" }>).children)).toBe("two");
  });

  it("parses an ordered list and keeps a non-1 start", () => {
    const list = one("3. three\n4. four") as Extract<BlockNode, { type: "list" }>;
    expect(list.ordered).toBe(true);
    expect(list.start).toBe(3);
    expect(list.items).toHaveLength(2);
  });

  it("nests a sub-list under its parent item", () => {
    const list = one("- outer\n  - inner\n  - inner two\n- outer two") as Extract<BlockNode, { type: "list" }>;
    expect(list.items).toHaveLength(2);
    const nested = list.items[0]!.children.find((c) => c.type === "list");
    expect(nested).toBeDefined();
    expect((nested as Extract<BlockNode, { type: "list" }>).items).toHaveLength(2);
  });

  it("starts a new list when the marker kind changes", () => {
    const blocks = parseBlocks("- bullet\n1. number");
    expect(blocks.map((b) => b.type)).toEqual(["list", "list"]);
    expect((blocks[0] as Extract<BlockNode, { type: "list" }>).ordered).toBe(false);
    expect((blocks[1] as Extract<BlockNode, { type: "list" }>).ordered).toBe(true);
  });

  it("requires every blockquote line to carry its own marker", () => {
    // Lazy continuation is not in the subset. The heading must escape the quote.
    const blocks = parseBlocks("> quoted\n# Heading");
    expect(blocks.map((b) => b.type)).toEqual(["blockquote", "heading"]);
  });

  it("parses a table with an alignment row", () => {
    const table = one("| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |") as Extract<
      BlockNode,
      { type: "table" }
    >;
    expect(table.align).toEqual(["left", "center", "right"]);
    expect(table.header.map(textOf)).toEqual(["a", "b", "c"]);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]!.map(textOf)).toEqual(["1", "2", "3"]);
  });

  it("parses a one-column table", () => {
    const table = one("| only |\n| --- |\n| a |") as Extract<BlockNode, { type: "table" }>;
    expect(table.header.map(textOf)).toEqual(["only"]);
    expect(table.rows.map((r) => r.map(textOf))).toEqual([["a"]]);
  });

  it("does not make a table out of pipes without a delimiter row", () => {
    expect(one("a | b | c").type).toBe("paragraph");
  });

  it("stops a paragraph that runs straight into a table", () => {
    const blocks = parseBlocks("intro text\n| a | b |\n| --- | --- |\n| 1 | 2 |");
    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "table"]);
  });

  it("keeps an escaped pipe inside a cell instead of splitting on it", () => {
    // The dominant shape in a generated type reference: `"r1"\|"r2"\|"r3"`.
    const table = one('| name | type |\n| --- | --- |\n| `gap` | "r1"\\|"r2"\\|"r3" |') as Extract<
      BlockNode,
      { type: "table" }
    >;
    expect(table.rows[0]).toHaveLength(2);
    expect(textOf(table.rows[0]![1]!)).toBe('"r1"|"r2"|"r3"');
  });

  it("renders a ragged row rather than dropping the extra cell", () => {
    const table = one("| a | b |\n| --- | --- |\n| 1 | 2 | 3 |") as Extract<BlockNode, { type: "table" }>;
    expect(table.rows[0]).toHaveLength(3);
  });

  it("expands tabs so a tab-indented sub-item still nests", () => {
    const list = one("- outer\n\t- inner") as Extract<BlockNode, { type: "list" }>;
    expect(list.items[0]!.children.some((c) => c.type === "list")).toBe(true);
  });

  it("drops HTML comments without leaving visible text", () => {
    const blocks = parseBlocks("<!-- GENERATED:components -->\n\n# Real");
    expect(blocks).toEqual([{ type: "heading", level: 1, children: [{ type: "text", value: "Real" }] }]);
  });

  it("keeps the text between two comments when a later line closes the second", () => {
    expect(parseBlocks("<!-- a --> keep <!-- b -->\nnext")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: " keep  next" }] },
    ]);
    expect(parseBlocks("<!-- a -->x\n<!-- b -->\ny")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "x y" }] },
    ]);
  });

  it("drops comments on their own lines, indent and line break included", () => {
    expect(parseBlocks("a\n  <!-- one --> <!-- two -->\nb")).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "a b" }] },
    ]);
  });

  it("keeps a multi-line comment from fragmenting the table it sits in", () => {
    const blocks = parseBlocks("| a |\n| --- |\n<!-- a\nb -->\n| 1 |");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.type).toBe("table");
  });

  it.each([
    ["empty", ""],
    ["whitespace only", "   \n  \n"],
    ["newlines only", "\n\n\n"],
  ])("returns no blocks for %s input", (_label, src) => {
    expect(parseBlocks(src)).toEqual([]);
  });

  it("normalises CRLF so no carriage return survives into a code block", () => {
    const node = one("```\r\na\r\nb\r\n```");
    expect((node as Extract<BlockNode, { type: "code" }>).value).toBe("a\nb");
  });
});

describe("inline", () => {
  it("parses bold, italic and strikethrough", () => {
    expect(parseInline("**b** *i* ~~s~~").map((n) => n.type)).toEqual([
      "strong",
      "text",
      "em",
      "text",
      "del",
    ]);
  });

  it("does not emphasise an underscore inside a word", () => {
    // The single most common way a naive renderer mangles technical prose.
    expect(parseInline("snake_case_name")).toEqual([{ type: "text", value: "snake_case_name" }]);
  });

  it("does emphasise an asterisk inside a word, matching CommonMark", () => {
    expect(parseInline("a*b*c").map((n) => n.type)).toEqual(["text", "em", "text"]);
  });

  it("leaves an unterminated emphasis run as literal text", () => {
    expect(textOf(parseInline("*not closed"))).toBe("*not closed");
    expect(textOf(parseInline("**also not closed"))).toBe("**also not closed");
  });

  it("does not open emphasis on whitespace", () => {
    expect(textOf(parseInline("2 * 3 * 4"))).toBe("2 * 3 * 4");
  });

  it("parses a code span and leaves markdown inside it alone", () => {
    expect(parseInline("`**not bold**`")).toEqual([{ type: "code", value: "**not bold**" }]);
  });

  it("lets a backtick run hold a backtick", () => {
    expect(parseInline("``a ` b``")).toEqual([{ type: "code", value: "a ` b" }]);
  });

  it("leaves an unmatched backtick as literal text", () => {
    expect(textOf(parseInline("a ` b"))).toBe("a ` b");
  });

  it("does not let emphasis close inside a code span", () => {
    const nodes = parseInline("*a `b*c` d*");
    expect(nodes.map((n) => n.type)).toEqual(["em"]);
    expect(textOf(nodes)).toBe("a b*c d");
  });

  it("parses a link, and a link with a title", () => {
    expect(parseInline("[text](/path)")).toEqual([
      { type: "link", href: "/path", title: undefined, children: [{ type: "text", value: "text" }] },
    ]);
    const titled = parseInline('[text](/path "Title")')[0];
    expect(titled).toMatchObject({ type: "link", href: "/path", title: "Title" });
  });

  it("never nests a link: the inner one wins and the outer brackets are text (CommonMark)", () => {
    const links = (nodes: InlineNode[]): InlineNode[] =>
      nodes.flatMap((n) => (n.type === "link" ? [n, ...links(n.children)] : "children" in n ? links(n.children) : []));
    const nested = parseInline("[a [b](/c) d](/e)");
    expect(textOf(nested)).toBe("[a b d](/e)");
    expect(links(nested)).toEqual([{ type: "link", href: "/c", title: undefined, children: [{ type: "text", value: "b" }] }]);
    // An autolink is a link too, and a link inside emphasis inside the label still counts.
    const auto = parseInline("[see <https://a.example>](/x)");
    expect(textOf(auto)).toBe("[see https://a.example](/x)");
    expect(links(auto).map((n) => n.type === "link" && n.href)).toEqual(["https://a.example"]);
    const deep = parseInline("[**[b](/c)**](/e)");
    expect(links(deep).map((n) => n.type === "link" && n.href)).toEqual(["/c"]);
    // A link around an image is still a link.
    expect(parseInline("[![logo](/l.png)](/home)")[0]).toMatchObject({ type: "link", href: "/home" });
  });

  it("leaves a bracket with no destination as literal text", () => {
    expect(textOf(parseInline("[just brackets]"))).toBe("[just brackets]");
  });

  it("parses an image", () => {
    expect(parseInline("![alt text](/img.png)")).toEqual([
      { type: "image", src: "/img.png", alt: "alt text", title: undefined },
    ]);
  });

  it("parses an angle autolink but not a bare url", () => {
    expect(parseInline("<https://example.com>")).toEqual([
      {
        type: "link",
        href: "https://example.com",
        children: [{ type: "text", value: "https://example.com" }],
      },
    ]);
    expect(parseInline("see https://example.com")).toEqual([
      { type: "text", value: "see https://example.com" },
    ]);
  });

  it("keeps an html-looking angle span as literal text", () => {
    // `ColumnBreakpoints<GridColumnCount>` is prose, not markup, and a renderer
    // that swallowed unknown tags would delete half of it.
    expect(parseInline("ColumnBreakpoints<GridColumnCount>")).toEqual([
      { type: "text", value: "ColumnBreakpoints<GridColumnCount>" },
    ]);
  });

  it("resolves backslash escapes", () => {
    expect(parseInline("\\*not emphasis\\*")).toEqual([{ type: "text", value: "*not emphasis*" }]);
    expect(parseInline("a \\| b")).toEqual([{ type: "text", value: "a | b" }]);
  });

  it("makes a hard break from two trailing spaces, and from a trailing backslash", () => {
    expect(parseInline("a  \nb").map((n) => n.type)).toEqual(["text", "break", "text"]);
    expect(parseInline("a\\\nb").map((n) => n.type)).toEqual(["text", "break", "text"]);
  });
});


/**
 * Every counterexample an adversarial verification pass produced against an
 * earlier build of this parser. Each one was a real defect; each is pinned here
 * so it cannot come back quietly.
 */
describe("regressions found by adversarial review", () => {
  it("resolves an escaped pipe INSIDE a code span in a table cell", () => {
    // 135 cells across this package's own docs are this exact shape. GFM
    // resolves the table escape before inline parsing; deferring it left the
    // backslash visible inside the code span.
    const table = one('| a | b |\n| --- | --- |\n| `"x" \\| "y"` | z |') as Extract<
      BlockNode,
      { type: "table" }
    >;
    expect(table.rows[0]).toHaveLength(2);
    expect(table.rows[0]![0]).toEqual([{ type: "code", value: '"x" | "y"' }]);
  });

  it("takes the first word of a multi-word info string instead of failing the fence", () => {
    expect(one('```ts title="x.ts"\nconst a = 1;\n```')).toEqual({
      type: "code",
      lang: "ts",
      value: "const a = 1;",
    });
  });

  it("recognises a fence indented up to three spaces", () => {
    expect(one("   ```\ncode\n   ```")).toEqual({ type: "code", lang: undefined, value: "code" });
  });

  it("recognises a tilde fence, closed and unclosed", () => {
    expect(one("~~~ts\nconst a = 1;\n~~~")).toEqual({
      type: "code",
      lang: "ts",
      value: "const a = 1;",
    });
    expect(one("~~~\nunclosed")).toEqual({ type: "code", lang: undefined, value: "unclosed" });
  });

  it("starts a new list when the bullet character or ordered delimiter changes", () => {
    expect(parseBlocks("- a\n* b").map((b) => b.type)).toEqual(["list", "list"]);
    expect(parseBlocks("1. a\n1) b").map((b) => b.type)).toEqual(["list", "list"]);
  });

  it("keeps a blank-separated list as ONE loose list", () => {
    const list = one("- a\n\n- b\n\n- c") as Extract<BlockNode, { type: "list" }>;
    expect(list.items).toHaveLength(3);
    expect(list.loose).toBe(true);
    // A tight list is the same shape with `loose` false, which is what decides
    // whether each item renders a paragraph.
    expect((one("- a\n- b") as Extract<BlockNode, { type: "list" }>).loose).toBe(false);
  });

  it("keeps a trailing hash that is part of the heading text", () => {
    expect(one("# Notes on C#")).toEqual({
      type: "heading",
      level: 1,
      children: [{ type: "text", value: "Notes on C#" }],
    });
    // A closing run preceded by whitespace is still trimmed.
    expect(one("## Title ###")).toEqual({
      type: "heading",
      level: 2,
      children: [{ type: "text", value: "Title" }],
    });
  });

  it("does not turn a pipe-bearing line plus a rule into a table", () => {
    // GFM requires the delimiter row's cell count to match the header's.
    expect(parseBlocks("Some | text\n---").map((b) => b.type)).toEqual(["paragraph", "hr"]);
  });

  it("leaves an HTML comment inside a fence alone", () => {
    expect(one("```md\n<!-- keep -->\ntext\n```")).toEqual({
      type: "code",
      lang: "md",
      value: "<!-- keep -->\ntext",
    });
  });

  it("does not let a stray underscore close against a later identifier", () => {
    // The intraword guard has to be two-sided. One-sided, this sentence lost
    // characters: "The init hook ... snake" + "case_name".
    const src = "The _init hook runs before paint, and it reads snake_case_name here.";
    expect(parseInline(src)).toEqual([{ type: "text", value: src }]);
  });

  it("parses a long space run in linear time", () => {
    // `^ *` before another ` *` gave the delimiter-row regex O(n²) split points:
    // 64 000 spaces took 3.4 seconds before ` {0,3}` replaced it.
    const start = performance.now();
    parseBlocks(`| a | b |\n${" ".repeat(64000)}---x`);
    expect(performance.now() - start).toBeLessThan(250);
  });
});

/**
 * Inputs that are not documents. Each of these was a crash, a hang, or a hard
 * process exit before the caps that now bound them — and each arrived through
 * the ordinary `children` string, so a rendered comment or a pasted file is
 * enough to reach them.
 */
describe("pathological input", () => {
  it("survives a line of 2000 blockquote markers", () => {
    // One JS frame per `>`, parse and render both: a RangeError in V8.
    expect(() => parseBlocks(">".repeat(2000) + " hi")).not.toThrow();
  });

  it("survives 2000 levels of list nesting", () => {
    // Worse than a throw before the depth cap — the worker process exited, so
    // no error boundary could have caught it.
    const src = Array.from({ length: 2000 }, (_, k) => " ".repeat(k * 2) + "- x").join("\n");
    expect(() => parseBlocks(src)).not.toThrow();
  });

  it("parses a long run of unclosed brackets in linear time", () => {
    // The documented "stray brackets" case. Uncapped, each `[` rescanned to the
    // end: 100 000 took 8.6 s, and a million would have taken ~14 minutes.
    const start = performance.now();
    parseInline("[".repeat(100_000));
    // Measured 1.1s once on a loaded machine (six agents testing at once); quadratic was 8.6s.
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it("parses a long run of unclosed destinations in linear time", () => {
    // Each `[a](` rescanned to the end for its `)`: 160 000 characters took 4.3s under Bun.
    const start = performance.now();
    const nodes = parseInline("[a](".repeat(40_000));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(textOf(nodes)).toBe("[a](".repeat(40_000));
  });

  it("still reads a destination with nested parentheses", () => {
    expect(parseInline("[w](/wiki/A_(b_(c)))")).toEqual([
      { type: "link", href: "/wiki/A_(b_(c))", title: undefined, children: [{ type: "text", value: "w" }] },
    ]);
  });

  it("parses a long paragraph in linear time", () => {
    // `text.endsWith` at every line break flattened the growing text: 40 000
    // lines took 1.3s under Bun, 80 000 took 15s.
    const start = performance.now();
    const [paragraph] = parseBlocks("word word\n".repeat(40_000));
    expect(performance.now() - start).toBeLessThan(500);
    expect(paragraph?.type).toBe("paragraph");
  });

  it("drops many unclosed comment openers in linear time", () => {
    // A lazy regex retried at every `<!--` rescanned to the end each time:
    // 200 000 characters took 4.9s under Bun.
    const start = performance.now();
    const blocks = parseBlocks("<!--\n".repeat(40_000));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(blocks).toHaveLength(1);
  });

  it("matches a heading with a long whitespace run in linear time", () => {
    // A lazy capture beside a trailing `[ \t]*$` is an ambiguous split: cubic
    // under JavaScriptCore, so Safari and Bun-SSR consumers only.
    const start = performance.now();
    parseBlocks("# x" + "\t".repeat(4000) + "y");
    expect(performance.now() - start).toBeLessThan(1000);
  });

  it("keeps a heading's text when the line ends in whitespace", () => {
    // The greedy capture that removed the ambiguity also stopped trimming, so
    // the trim moved into code and this is what pins it.
    expect(one("# Title   ")).toEqual({
      type: "heading",
      level: 1,
      children: [{ type: "text", value: "Title" }],
    });
  });

  it("keeps over-deep content as text rather than dropping it", () => {
    const blocks = parseBlocks(">".repeat(200) + " deep");
    expect(JSON.stringify(blocks)).toContain("deep");
  });
});

describe("destinations reach safeUrl unwrapped", () => {
  it("judges an angle-wrapped destination rather than letting it through unread", () => {
    // The brackets used to ride into the href, which both broke the link and
    // meant `safeUrl` never saw the scheme inside them.
    expect(parseInline("[click](<javascript:alert(1)>)")).toEqual([
      { type: "text", value: "click" },
    ]);
    expect(parseInline("[ok](</a path//file.md>)")).toEqual([
      {
        type: "link",
        href: "/a path//file.md",
        title: undefined,
        children: [{ type: "text", value: "ok" }],
      },
    ]);
  });
});

describe("GFM task items", () => {
  it("marks `[ ]` and `[x]` / `[X]` items and strips the marker", () => {
    const list = one("- [ ] open\n- [x] done\n- [X] also done\n- plain") as Extract<BlockNode, { type: "list" }>;
    expect(list.items.map((item) => item.checked)).toEqual([false, true, true, undefined]);
    expect(textOf((list.items[0]!.children[0] as Extract<BlockNode, { type: "paragraph" }>).children)).toBe("open");
  });

  it("needs whitespace after the box, so `[x]y` is text and `[link](/x)` is a link", () => {
    const list = one("- [x]y\n- [link](/x)") as Extract<BlockNode, { type: "list" }>;
    expect(list.items.map((item) => item.checked)).toEqual([undefined, undefined]);
    const second = list.items[1]!.children[0] as Extract<BlockNode, { type: "paragraph" }>;
    expect(second.children[0]).toMatchObject({ type: "link", href: "/x" });
  });

  it("keeps task state on nested items", () => {
    const list = one("- [ ] parent\n  - [x] child") as Extract<BlockNode, { type: "list" }>;
    const nested = list.items[0]!.children.find((c) => c.type === "list") as Extract<BlockNode, { type: "list" }>;
    expect(list.items[0]!.checked).toBe(false);
    expect(nested.items[0]!.checked).toBe(true);
  });
});

describe("untrusted input", () => {
  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "java\tscript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:x"])(
    "drops the link for %s and keeps its text",
    (href) => {
      expect(parseInline(`[click](${href})`)).toEqual([{ type: "text", value: "click" }]);
    },
  );

  it("keeps raw HTML as literal text", () => {
    expect(one("<script>alert(1)</script>")).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "<script>alert(1)</script>" }],
    });
  });

  it("parses every cell of a wide table (cells are not parsed at a depth set by their index)", () => {
    const cols = Array.from({ length: 40 }, (_, k) => `c${k}`);
    const table = one(`| ${cols.join(" | ")} |\n|${" --- |".repeat(40)}\n| ${cols.map((c) => `**${c}**`).join(" | ")} |`) as Extract<
      BlockNode,
      { type: "table" }
    >;
    expect(table.rows[0]).toHaveLength(40);
    expect(table.rows[0]![39]).toEqual([{ type: "strong", children: [{ type: "text", value: "c39" }] }]);
  });

  it("survives links and emphasis nested thousands deep, quickly", () => {
    // Measured without any depth cap: 5000 nested links 17ms, 5000 mixed
    // emphasis runs 3ms. The link-label cap bounds the recursion.
    const start = performance.now();
    const links = parseInline("[".repeat(5000) + "x" + "](/)".repeat(5000));
    const emphasis = parseInline("**_~~".repeat(5000) + "x" + "~~_**".repeat(5000));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(textOf(links)).toContain("x");
    expect(textOf(emphasis)).toContain("x");
  });
});
