import { describe, expect, it } from "vitest";

import { isPlainObject } from "../spec/guards";
import { appendPointer, parsePointer } from "../spec/pointer";
import { stripCodeFence } from "./fence";
import { createViewSpecParser, parsePartialViewSpec } from "./parser";
import { isPending, PENDING } from "./pending";
import type { StreamSnapshot } from "./snapshot";

// ---------------------------------------------------------------------------
// Documents

const DASHBOARD = {
  version: 2,
  title: "Service health \u2014 ops \u{1F6A6}",
  description: 'Line one\nline "two"\t\\ end / slash',
  density: "compact",
  state: {
    tab: "overview",
    page: 1,
    threshold: -12.5e-3,
    big: 1.5e21,
    collapsed: false,
    selected: null,
    filters: { region: ["eu", "us"], "a/b~c": [] },
  },
  data: {
    services: {
      type: "static",
      value: [
        { id: "api", name: "API", latency: 120, ok: true },
        { id: "db", name: "Datab\u00e4se", latency: 0.5, ok: false },
      ],
    },
    metrics: { type: "api", endpoint: "/api/metrics?range=7d&tz=Europe%2FBerlin" },
  },
  forms: {
    contact: {
      fields: { email: { type: "text", rules: { required: true, pattern: "^[^@]+@[^@]+$" } } },
      onSubmit: { action: "apiCall", payload: { endpoint: "/api/contact", method: "POST" } },
    },
  },
  root: {
    component: "Stack",
    props: { gap: "md" },
    children: [
      { component: "Heading", props: { level: 1 }, children: ["Service health ", { $ref: "state.tab" }] },
      {
        component: "Card",
        props: {
          className: "w-full",
          header: { $node: { component: "Badge", props: { tone: "success" }, children: ["Live \u{1F7E2}"] } },
        },
        children: [
          {
            $each: "data.services",
            as: "svc",
            key: "id",
            node: {
              component: "Card.Header",
              children: [
                { $ref: "svc.name" },
                " \u2014 ",
                { $format: { value: { $ref: "svc.latency" }, style: "unit", unit: "millisecond" } },
              ],
            },
          },
          {
            $cond: { ref: "state.tab", eq: "overview" },
            then: { component: "Text", children: ['Overview "quoted" \\ backslash ```js fence```'] },
            else: { component: "Text", children: ["Other"] },
          },
        ],
      },
      { component: "Divider" },
      {
        component: "Button",
        props: {
          onClick: [
            { action: "setState", payload: { path: "state.page", value: 2 } },
            { action: "showToast", payload: { title: "Paged" } },
          ],
        },
        children: ["Next \u27A1\uFE0F"],
      },
      { component: "Stack", children: ["no props, children only", { component: "Text", props: {}, children: [] }] },
    ],
  },
};

function deepStack(depth: number): object {
  let node: object = { component: "Text", children: ["bottom \u{1F600}"] };
  for (let level = 0; level < depth; level += 1) node = { component: "Stack", props: { gap: "sm" }, children: [node, `level ${level}`] };
  return { version: 2, title: "Deep", root: node };
}

/** Escapes written out by hand: JSON.stringify would emit most of these raw. */
const ESCAPED_TEXT = String.raw`{"version":2,"title":"Esc\u00e9\/x","root":{"component":"Text","props":{"title":"\ud83d\ude00\t\"q\""},"children":["a\u00e9b\ud83d\ude00c\\d\"e\nf",{"component":"Badge","children":["\uD83C\uDF89 party"]},{"component":"Text","props":{"label":"\u005c\u0022"},"children":["lone \ud800 surrogate"]}]}}`;

const DOCUMENTS: readonly { readonly name: string; readonly text: string }[] = [
  { name: "dashboard, minified", text: JSON.stringify(DASHBOARD) },
  { name: "dashboard, pretty", text: JSON.stringify(DASHBOARD, null, 2) },
  { name: "dashboard, fenced", text: "```json\n" + JSON.stringify(DASHBOARD, null, 1) + "\n```\n" },
  { name: "deep, minified", text: JSON.stringify(deepStack(12)) },
  { name: "escapes, fenced without a language", text: "  ```\n" + ESCAPED_TEXT + "```" },
];

// ---------------------------------------------------------------------------
// Walking snapshots

function valueAt(root: unknown, pointer: string): unknown {
  let value = root;
  for (const token of parsePointer(pointer) ?? []) {
    if (Array.isArray(value)) value = value[Number(token)];
    else if (isPlainObject(value) && Object.hasOwn(value, token)) value = value[token];
    else return undefined;
  }
  return value;
}

interface Emitted {
  readonly pointer: string;
  readonly node: Record<string, unknown>;
}

const BODY_KEYS: { readonly [firstKey: string]: readonly string[] } = {
  component: ["children"],
  $each: ["node"],
  $cond: ["then", "else"],
};

/** Every node object the snapshot shows, by walking node positions only. */
function emittedNodes(node: unknown, pointer: string, out: Emitted[] = []): Emitted[] {
  if (!isPlainObject(node)) return out;
  out.push({ pointer, node });
  if (Array.isArray(node.children)) {
    node.children.forEach((child, index) => emittedNodes(child, `${pointer}/children/${index}`, out));
  }
  for (const key of ["node", "then", "else"]) if (Object.hasOwn(node, key)) emittedNodes(node[key], `${pointer}/${key}`, out);
  return out;
}

function firstKeyOf(node: Record<string, unknown>): string {
  return ["component", "$each", "$cond"].find((key) => Object.hasOwn(node, key)) ?? "";
}

/** Asserts every closed object or array in `before` is the identical object in `after`. */
function expectClosedIdentity(before: unknown, after: unknown, pointer: string, pending: ReadonlySet<string>): void {
  if (typeof before !== "object" || before === null) return;
  if (!pending.has(pointer)) {
    expect(after, `closed value at "${pointer}" changed identity`).toBe(before);
    return;
  }
  const entries: [string, unknown][] = Array.isArray(before)
    ? before.map((value, index) => [String(index), value])
    : Object.entries(before);
  for (const [token, value] of entries) {
    expectClosedIdentity(value, valueAt(after, appendPointer("", token)), appendPointer(pointer, token), pending);
  }
}

/** Every leaf the snapshot shows, with its pointer. */
function leaves(value: unknown, pointer: string, out: [string, unknown][] = []): [string, unknown][] {
  if (Array.isArray(value)) value.forEach((item, index) => leaves(item, appendPointer(pointer, index), out));
  else if (isPlainObject(value)) for (const [key, item] of Object.entries(value)) leaves(item, appendPointer(pointer, key), out);
  else out.push([pointer, value]);
  return out;
}

function isTextChildPointer(snapshotSpec: unknown, pointer: string): boolean {
  const tokens = parsePointer(pointer) ?? [];
  if (tokens.length < 2 || tokens[tokens.length - 2] !== "children") return false;
  const owner = valueAt(snapshotSpec, `/${tokens.slice(0, -2).join("/")}`);
  return isPlainObject(owner) && Object.hasOwn(owner, "component");
}

function pushEach(text: string, chunks: readonly string[]): StreamSnapshot[] {
  expect(chunks.join("")).toBe(text);
  const parser = createViewSpecParser();
  return chunks.map((chunk) => parser.push(chunk));
}

function codeUnits(text: string): string[] {
  return Array.from({ length: text.length }, (_, index) => text.charAt(index));
}

// ---------------------------------------------------------------------------

describe("createViewSpecParser: prefix property, at every boundary", () => {
  it.each(DOCUMENTS)("$name", ({ text }) => {
    const final: unknown = JSON.parse(stripCodeFence(text));
    expect(emittedNodes((final as { root: unknown }).root, "/root").length).toBeGreaterThan(2);

    const snapshots = pushEach(text, codeUnits(text));
    let previous: StreamSnapshot | undefined;
    let previousEmitted = new Set<string>();
    let sawPartialText = false;
    let sawPendingNode = false;

    snapshots.forEach((snapshot, index) => {
      const at = `after ${index + 1} of ${text.length} characters`;
      const spec = snapshot.spec;
      expect(snapshot.error, at).toBeUndefined();

      // Incremental parsing and one parse of the same prefix agree.
      const oneShot = parsePartialViewSpec(text.slice(0, index + 1));
      expect(oneShot.spec, at).toEqual(spec);
      expect([...oneShot.pending].sort(), at).toEqual([...snapshot.pending].sort());

      // An emitted node's head (component + props, $each + as + key, $cond) is final.
      const emitted = spec === undefined || isPending(spec.root) ? [] : emittedNodes(spec.root, "/root");
      for (const { pointer, node } of emitted) {
        const finalNode = valueAt(final, pointer);
        expect(isPlainObject(finalNode), `${at}: ${pointer}`).toBe(true);
        if (!isPlainObject(finalNode)) continue;
        const body = BODY_KEYS[firstKeyOf(node)] ?? [];
        for (const key of new Set([...Object.keys(node), ...Object.keys(finalNode)])) {
          if (body.includes(key)) continue;
          expect(node[key], `${at}: ${pointer}/${key}`).toEqual(finalNode[key]);
        }
      }

      // Emitted node pointers only ever grow.
      const emittedNow = new Set(emitted.map(({ pointer }) => pointer));
      for (const pointer of previousEmitted) expect(emittedNow.has(pointer), `${at}: ${pointer} vanished`).toBe(true);
      previousEmitted = emittedNow;

      // Closed subtrees keep their identity.
      if (previous !== undefined) expectClosedIdentity(previous.spec, spec, "", previous.pending);
      previous = snapshot;

      // Open values: PENDING, or partial text in a text child, and nothing else.
      for (const [pointer, value] of spec === undefined ? [] : leaves(spec, "")) {
        if (value === PENDING) {
          expect(snapshot.pending.has(pointer), `${at}: PENDING at ${pointer} not pending`).toBe(true);
          if (pointer.includes("/children/")) sawPendingNode = true;
        } else if (snapshot.pending.has(pointer)) {
          expect(typeof value, `${at}: open ${pointer}`).toBe("string");
          expect(isTextChildPointer(spec, pointer), `${at}: partial text outside a text child at ${pointer}`).toBe(true);
          const finalText = valueAt(final, pointer);
          expect(typeof finalText === "string" && finalText.startsWith(String(value)), `${at}: ${pointer}`).toBe(true);
          sawPartialText = true;
        } else {
          expect(value, `${at}: ${pointer}`).toEqual(valueAt(final, pointer));
        }
      }
      if (spec !== undefined && !snapshot.complete) expect(snapshot.pending.has(""), at).toBe(true);
    });

    expect(sawPartialText).toBe(true);
    expect(sawPendingNode).toBe(true);
    const last = snapshots[snapshots.length - 1];
    expect(last?.complete).toBe(true);
    expect(last?.pending.size).toBe(0);
    expect(last?.spec).toEqual(final);
  });

  it("agrees with one parse whatever the chunk sizes", () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (const { text } of DOCUMENTS) {
      const chunks: string[] = [];
      for (let start = 0; start < text.length; ) {
        const size = 1 + Math.floor(random() * 40);
        chunks.push(text.slice(start, start + size));
        start += size;
      }
      const snapshots = pushEach(text, chunks);
      let offset = 0;
      chunks.forEach((chunk, index) => {
        offset += chunk.length;
        expect(snapshots[index]?.spec).toEqual(parsePartialViewSpec(text.slice(0, offset)).spec);
      });
    }
  });
});

describe("createViewSpecParser: what an open document shows", () => {
  const prefixOf = (text: string, end: string) => {
    const index = text.indexOf(end);
    expect(index, `"${end}" in the text`).toBeGreaterThanOrEqual(0);
    return parsePartialViewSpec(text.slice(0, index + end.length));
  };

  it("holds a component node back until its props close, and never shows a half-written prop", () => {
    const text = '{"version":2,"title":"t","root":{"component":"Link","props":{"href":"https://example.test/a","label":"Go"},"children":["Hi"]}}';
    expect(prefixOf(text, '"component":"Li').spec?.root).toBe(PENDING);
    expect(prefixOf(text, '"component":"Link"').spec?.root).toBe(PENDING);
    expect(prefixOf(text, '"https://example.te').spec?.root).toBe(PENDING);
    expect(prefixOf(text, '"label":"Go"').spec?.root).toBe(PENDING);
    expect(prefixOf(text, '"label":"Go"}').spec?.root).toEqual({
      component: "Link",
      props: { href: "https://example.test/a", label: "Go" },
    });
    expect(prefixOf(text, '"children":["H').spec?.root).toEqual({
      component: "Link",
      props: { href: "https://example.test/a", label: "Go" },
      children: ["H"],
    });
  });

  it("shows a node without props once its children begin", () => {
    const text = '{"version":2,"title":"t","root":{"component":"Stack","children":[{"component":"Badge"}]}}';
    expect(prefixOf(text, '"component":"Stack",').spec?.root).toBe(PENDING);
    expect(prefixOf(text, '"children"').spec?.root).toEqual({ component: "Stack" });
    expect(prefixOf(text, '[{"component":"Bad').spec?.root).toEqual({ component: "Stack", children: [PENDING] });
    expect(prefixOf(text, '"Badge"').pending.has("/root/children/0")).toBe(true);
    expect(prefixOf(text, '"Badge"}').spec?.root).toEqual({ component: "Stack", children: [{ component: "Badge" }] });
  });

  it("holds back a $node in props, subtree and all, until props close", () => {
    const text =
      '{"version":2,"title":"t","root":{"component":"Card","props":{"header":{"$node":{"component":"Badge","children":["Ne';
    const open = parsePartialViewSpec(text);
    expect(open.spec?.root).toBe(PENDING);
    const closed = parsePartialViewSpec(`${text}w"]}}},"children":[]}}`);
    expect(closed.spec?.root).toEqual({
      component: "Card",
      props: { header: { $node: { component: "Badge", children: ["New"] } } },
      children: [],
    });
  });

  it("shows partial text only in a text child; every other open string, number and literal is PENDING", () => {
    const text = '{"version":2,"title":"Hello wor';
    expect(parsePartialViewSpec(text).spec).toEqual({ version: 2, title: PENDING });
    expect(new Set(parsePartialViewSpec(text).pending)).toEqual(new Set(["", "/title"]));

    const state = '{"version":2,"title":"t","state":{"n":1';
    expect(parsePartialViewSpec(state).spec?.state).toEqual({ n: PENDING });
    expect(parsePartialViewSpec(`${state}23`).spec?.state).toEqual({ n: PENDING });
    expect(parsePartialViewSpec(`${state}23,`).spec?.state).toEqual({ n: 123 });
    expect(parsePartialViewSpec(`${state}23}`).spec?.state).toEqual({ n: 123 });

    const root = '{"version":2,"title":"t","root":"Hel';
    expect(parsePartialViewSpec(root).spec?.root).toBe(PENDING);
    const cond = '{"version":2,"title":"t","root":{"$cond":"state.a","then":"Hel';
    expect(parsePartialViewSpec(cond).spec?.root).toEqual({ $cond: "state.a", then: PENDING });
  });

  it("joins a number, true, false and null split across chunks", () => {
    const parser = createViewSpecParser();
    parser.push('{"version":2,"title":"t","state":{"a":1');
    expect(parser.push("23").spec?.state).toEqual({ a: PENDING });
    expect(parser.push('.5e1,"b":tr').spec?.state).toEqual({ a: 1235, b: PENDING });
    expect(parser.push('ue,"c":n').spec?.state).toEqual({ a: 1235, b: true, c: PENDING });
    expect(parser.push('ul').spec?.state).toEqual({ a: 1235, b: true, c: PENDING });
    expect(parser.push('l,"d":-').spec?.state).toEqual({ a: 1235, b: true, c: null, d: PENDING });
    expect(parser.push('0,"e":f').spec?.state).toEqual({ a: 1235, b: true, c: null, d: -0, e: PENDING });
    const done = parser.push('alse}}');
    expect(done.complete).toBe(true);
    expect(done.spec?.state).toEqual({ a: 1235, b: true, c: null, d: -0, e: false });
    expect(Object.is((done.spec?.state as { d: number }).d, -0)).toBe(true);
  });

  it("joins escapes and surrogate pairs split across chunks, never showing half a pair", () => {
    const head = '{"version":2,"title":"t","root":{"component":"Text","children":["';
    const textOf = (snapshot: StreamSnapshot) => (snapshot.spec?.root as { children: string[] }).children[0];

    const parser = createViewSpecParser();
    expect(textOf(parser.push(`${head}a\\`))).toBe("a");
    expect(textOf(parser.push("n"))).toBe("a\n");
    expect(textOf(parser.push("\\u00"))).toBe("a\n");
    expect(textOf(parser.push("e9"))).toBe("a\n\u00e9");
    expect(textOf(parser.push("\\ud83d"))).toBe("a\n\u00e9");
    expect(textOf(parser.push("\\ude0"))).toBe("a\n\u00e9");
    expect(textOf(parser.push("0"))).toBe("a\n\u00e9\u{1F600}");

    // A raw pair split between chunks.
    const emoji = "\u{1F389}";
    expect(textOf(parser.push(`x${emoji.charAt(0)}`))).toBe("a\n\u00e9\u{1F600}x");
    expect(textOf(parser.push(emoji.charAt(1)))).toBe(`a\n\u00e9\u{1F600}x${emoji}`);
    expect(parser.push('"]}}').spec).toEqual(JSON.parse(`${head}a\\n\\u00e9\\ud83d\\ude00x${emoji}"]}}`));
  });

  it("keeps backticks inside strings as text: a fence in the content never closes the document", () => {
    const inner = "Use:\n```json\n{}\n```\nDone";
    const text = "```json\n" + JSON.stringify({ version: 2, title: "t", root: { component: "Markdown", children: [inner] } }) + "\n```";
    const snapshot = createViewSpecParser().push(text);
    expect(snapshot.error).toBeUndefined();
    expect(snapshot.complete).toBe(true);
    expect((snapshot.spec?.root as { children: string[] }).children).toEqual([inner]);
  });

  it("waits for a node whose keys come out of order until it closes", () => {
    const cases = [
      '{"props":{"gap":"md"},"component":"Stack","children":["a","b"]}',
      '{"component":"Stack","className":"w-full","children":["a","b"]}',
      '{"children":["a","b"],"component":"Stack"}',
      '{"as":"row","$each":"data.rows","node":{"component":"Text","children":["x"]}}',
      '{"then":"a","$cond":"state.on"}',
      '{"constructor":{"x":1},"component":"Stack","children":["a"]}',
    ];
    for (const node of cases) {
      const text = `{"version":2,"title":"t","root":${node}}`;
      const rootEnd = text.length - 1;
      for (let end = text.indexOf(node) + 1; end < rootEnd; end += 1) {
        expect(parsePartialViewSpec(text.slice(0, end)).spec?.root, text.slice(0, end)).toBe(PENDING);
      }
      expect(parsePartialViewSpec(text.slice(0, rootEnd)).spec?.root).toEqual(JSON.parse(node));
    }
  });

  it("adds a props object that arrives after children only once it has closed", () => {
    const text = '{"version":2,"title":"t","root":{"component":"Card","children":["a"],"props":{"href":"https://example.test"}}}';
    expect(prefixOf(text, '"children":["a"]').spec?.root).toEqual({ component: "Card", children: ["a"] });
    expect(prefixOf(text, '"https://exa').spec?.root).toEqual({ component: "Card", children: ["a"] });
    expect(prefixOf(text, '"https://example.test"}').spec?.root).toEqual({
      component: "Card",
      children: ["a"],
      props: { href: "https://example.test" },
    });
  });

  it("streams $each and $cond bodies once their heads have closed; $ref and $format nodes only whole", () => {
    const each = '{"version":2,"title":"t","root":{"$each":"data.rows","as":"row","key":"id","node":{"component":"Text","children":["x';
    expect(prefixOf(each, '"as":"row"').spec?.root).toBe(PENDING);
    expect(prefixOf(each, '"key":"i').spec?.root).toBe(PENDING);
    expect(prefixOf(each, '"key":"id"').spec?.root).toEqual({ $each: "data.rows", as: "row", key: "id" });
    expect(parsePartialViewSpec(each).spec?.root).toEqual({
      $each: "data.rows",
      as: "row",
      key: "id",
      node: { component: "Text", children: ["x"] },
    });
    const noKey = '{"version":2,"title":"t","root":{"$each":"data.rows","as":"row","node":{';
    expect(parsePartialViewSpec(noKey).spec?.root).toEqual({ $each: "data.rows", as: "row", node: PENDING });

    const cond = '{"version":2,"title":"t","root":{"$cond":{"ref":"state.tab","eq":"a"},"then":{"component":"Text","children":["y';
    expect(prefixOf(cond, '"eq":"a"').spec?.root).toBe(PENDING);
    expect(prefixOf(cond, '"eq":"a"}').spec?.root).toEqual({ $cond: { ref: "state.tab", eq: "a" } });
    expect(parsePartialViewSpec(cond).spec?.root).toEqual({
      $cond: { ref: "state.tab", eq: "a" },
      then: { component: "Text", children: ["y"] },
    });

    const ref = '{"version":2,"title":"t","root":{"component":"Text","children":[{"$ref":"state.name"}';
    expect(prefixOf(ref, '"state.na').spec?.root).toEqual({ component: "Text", children: [PENDING] });
    expect(prefixOf(ref, '"state.name"').spec?.root).toEqual({ component: "Text", children: [PENDING] });
    expect(parsePartialViewSpec(ref).spec?.root).toEqual({ component: "Text", children: [{ $ref: "state.name" }] });
  });

  it("lists every open value's pointer, escaped, and nothing once complete", () => {
    const text = '{"version":2,"title":"t","state":{"a/b~c":[{"x":"op';
    const { pending } = parsePartialViewSpec(text);
    const open = ["", "/state", "/state/a~1b~0c", "/state/a~1b~0c/0", "/state/a~1b~0c/0/x"];
    expect(new Set(pending)).toEqual(new Set(open));
    expect(pending.size).toBe(open.length);
    for (const pointer of open) expect(pending.has(pointer), pointer).toBe(true);
    for (const pointer of ["/title", "/state/a~1b~0c/1", "/state/a/b~c", "/stat", "/state/a~1b~0c/00", "state", "/state/a~1b~0c/0/x/y"]) {
      expect(pending.has(pointer), pointer).toBe(false);
    }
    expect(parsePartialViewSpec("").pending.size).toBe(0);
    expect(new Set(parsePartialViewSpec("  {").pending)).toEqual(new Set([""]));
    expect(parsePartialViewSpec('{"version":2}').pending.size).toBe(0);
  });

  it("reuses the snapshot while nothing visible changes, and the spec while only pending does", () => {
    const parser = createViewSpecParser();
    const before = parser.push('{"version":2,"title":"A long ti');
    expect(parser.push("tle that is still")).toBe(before);
    expect(parser.push(" arriving")).toBe(before);

    const opened = parser.push('","root":{"component":"Card","props":{"href":"https://');
    const spec = opened.spec;
    const later = parser.push('example.test","gap":"md","tone":');
    expect(later).not.toBe(opened);
    expect(later.spec).toBe(spec);
  });

  it("keeps an own __proto__ member as data, never as the prototype", () => {
    const text = '{"version":2,"title":"t","state":{"__proto__":{"polluted":true},"constructor":1}}';
    const snapshot = parsePartialViewSpec(text);
    const state = snapshot.spec?.state as Record<string, unknown>;
    expect(Object.getPrototypeOf(state)).toBe(Object.prototype);
    expect(Object.hasOwn(state, "__proto__")).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    expect(snapshot.spec).toEqual(JSON.parse(text));
    const open = parsePartialViewSpec(text.slice(0, -3));
    expect(Object.getPrototypeOf(open.spec?.state)).toBe(Object.prototype);
  });

  it("parses deep nesting without recursion", () => {
    const depth = 100_000;
    const text = `{"version":2,"title":"t","state":{"deep":${"[".repeat(depth)}1${"]".repeat(depth)}}}`;
    const parser = createViewSpecParser();
    expect(parser.push(text.slice(0, 50_000)).pending.size).toBeGreaterThan(1000);
    const snapshot = parser.push(text.slice(50_000));
    expect(snapshot.complete).toBe(true);
    let value: unknown = (snapshot.spec?.state as { deep: unknown }).deep;
    let levels = 0;
    while (Array.isArray(value)) {
      value = value[0];
      levels += 1;
    }
    expect([levels, value]).toEqual([depth, 1]);
  });
});

describe("createViewSpecParser: fences", () => {
  const body = '{"version":2,"title":"t"}';

  it.each([
    ["```json\n", "\n```"],
    ["```\n", "```"],
    ["\n  ````jsonc\r\n\n", "\n````\n\n"],
    ["", "\n```"],
    ["```json\n", ""],
  ])("strips %j … %j", (open, close) => {
    const text = `${open}${body}${close}`;
    const snapshot = createViewSpecParser().push(text);
    expect(snapshot.error).toBeUndefined();
    expect(snapshot.spec).toEqual(JSON.parse(body));
    expect(stripCodeFence(text)).toBe(body);
  });

  it("strips a fence that arrives a character at a time", () => {
    const text = "```json\n" + body + "\n```";
    const snapshots = pushEach(text, codeUnits(text));
    expect(snapshots.every((snapshot) => snapshot.error === undefined)).toBe(true);
    expect(snapshots[7]?.spec).toBeUndefined();
    expect(snapshots[8]?.spec).toEqual({});
    expect(snapshots[snapshots.length - 1]?.spec).toEqual(JSON.parse(body));
  });

  it("leaves unfenced text alone", () => {
    expect(stripCodeFence(`  ${body}\n`)).toBe(`  ${body}\n`);
    expect(stripCodeFence("``x``")).toBe("``x``");
  });

  it.each([
    ["two backticks", "``json\n" + body, 2],
    ["text after the closing fence", "```json\n" + body + "\n```\nHope this helps", body.length + 5],
    ["a short closing fence", body + "\n``", body.length + 3],
    ["a second opening fence", "```json\n```json\n" + body, 0],
  ])("refuses %s", (_, text, offset) => {
    const parser = createViewSpecParser();
    parser.push(text);
    const snapshot = parser.end();
    expect(snapshot.error?.code).toBe("invalid-json");
    expect(snapshot.error?.offset).toBe(offset);
  });
});

describe("createViewSpecParser: malformed and incomplete input", () => {
  it("reports text after the root as invalid-json, keeping the complete document", () => {
    const parser = createViewSpecParser();
    const snapshot = parser.push('{"version":2,"title":"t"} {"again":1}');
    expect(snapshot.complete).toBe(true);
    expect(snapshot.spec).toEqual({ version: 2, title: "t" });
    expect(snapshot.error).toEqual({ code: "invalid-json", message: expect.stringContaining('"{"'), offset: 26 });
  });

  it("stops at the first malformed character, keeping what came before, and ignores later text", () => {
    const parser = createViewSpecParser();
    const head = '{"version":2,"title":"t","root":{"component":"Text","children":["ok",';
    parser.push(head);
    const broken = parser.push(' "fine" x "never"');
    expect(broken.error).toEqual({ code: "invalid-json", message: expect.any(String), offset: head.length + 8 });
    expect(broken.spec?.root).toEqual({ component: "Text", children: ["ok", "fine"] });
    expect(parser.push("]}}")).toBe(broken);
    expect(parser.end()).toBe(broken);
  });

  it("ends an unclosed document as stream-incomplete, the partial document kept", () => {
    const parser = createViewSpecParser();
    const text = '```json\n{"version":2,"title":"t","root":{"component":"Text","children":["Hal';
    parser.push(text);
    const ended = parser.end();
    expect(ended.error).toEqual({ code: "stream-incomplete", message: expect.any(String), offset: text.length - 8 });
    expect(ended.complete).toBe(false);
    expect(ended.spec?.root).toEqual({ component: "Text", children: ["Hal"] });
    expect(parser.push("lo\"]}}")).toBe(ended);
  });

  it("ends empty input as stream-incomplete with no document", () => {
    const parser = createViewSpecParser();
    expect(parser.end()).toEqual({
      spec: undefined,
      complete: false,
      pending: new Set(),
      error: { code: "stream-incomplete", message: expect.any(String), offset: 0 },
    });
  });

  it("starts over on reset", () => {
    const parser = createViewSpecParser();
    parser.push('{"version":2,"title":"t"} x');
    expect(parser.snapshot.error?.code).toBe("invalid-json");
    parser.reset();
    expect(parser.snapshot).toEqual({ spec: undefined, complete: false, pending: new Set() });
    expect(parser.push('{"version":2,"title":"u"}')).toEqual({ spec: { version: 2, title: "u" }, complete: true, pending: new Set() });
  });

  it("accepts exactly what JSON.parse accepts after stripping fences, on mutated documents", () => {
    let seed = 11;
    const random = (limit: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return Math.floor((seed / 2147483648) * limit);
    };
    const alphabet = ['"', "\\", "{", "}", "[", "]", ",", ":", "0", "-", ".", "e", "t", "n", "`", " ", "\n", "\u0001", "u", "a"];
    let accepted = 0;
    let refused = 0;
    for (const { text } of DOCUMENTS) {
      for (let round = 0; round < 150; round += 1) {
        const at = random(text.length);
        const kind = random(3);
        const char = alphabet[random(alphabet.length)] ?? "";
        const mutated =
          kind === 0 ? text.slice(0, at) + text.slice(at + 1) : kind === 1 ? text.slice(0, at) + char + text.slice(at) : text.slice(0, at) + char + text.slice(at + 1);

        let expected: unknown;
        try {
          expected = JSON.parse(stripCodeFence(mutated));
        } catch {
          expected = undefined;
        }
        const ok = isPlainObject(expected);

        const parser = createViewSpecParser();
        parser.push(mutated.slice(0, at));
        parser.push(mutated.slice(at));
        const snapshot = parser.end();
        expect(snapshot.error === undefined, mutated).toBe(ok);
        if (ok) {
          expect(snapshot.spec, mutated).toEqual(expected);
          accepted += 1;
        } else refused += 1;
      }
    }
    expect(accepted).toBeGreaterThan(50);
    expect(refused).toBeGreaterThan(50);
  });

  it("reads numbers and literals exactly as JSON.parse does", () => {
    const spellings = [
      "0", "-0", "01", "-01", "00", "1.", "1.e5", ".5", "1e", "1e+", "1E-2", "-", "--1", "0.0", "1.5e+10",
      "0x1", "+1", "1_0", "Infinity", "NaN", "1e999", "-1.25E-3", "tru", "true", "truth", "nul", "null", "False",
    ];
    for (const spelling of spellings) {
      const text = `{"version":2,"title":"t","state":{"n":${spelling}}}`;
      let expected: unknown;
      try {
        expected = JSON.parse(text);
      } catch {
        expected = undefined;
      }
      const parser = createViewSpecParser();
      parser.push(text);
      const snapshot = parser.end();
      expect(snapshot.error === undefined, spelling).toBe(expected !== undefined);
      if (expected !== undefined) expect(snapshot.spec, spelling).toEqual(expected);
    }
  });

  it("refuses a top level that is not an object", () => {
    for (const text of ["[1]", '"x"', "1", "null"]) {
      expect(createViewSpecParser().push(text).error?.code, text).toBe("invalid-json");
    }
  });
});

describe("createViewSpecParser: cost", () => {
  it("parses a megabyte a character at a time in linear time", () => {
    // Many tiny rows keep one very wide array open for most of the text: the
    // shape where copying the open spine per character is quadratic.
    const rows = Array.from({ length: 60_000 }, (_, index) => ({ id: index, ok: index % 3 !== 0 }));
    const children = Array.from({ length: 3000 }, (_, index) => ({ component: "Text", props: { tone: "muted" }, children: [`Line ${index} `.repeat(4)] }));
    const text = JSON.stringify({
      version: 2,
      title: "Big",
      data: { rows: { type: "static", value: rows } },
      root: { component: "Stack", children },
    });
    expect(text.length).toBeGreaterThan(1_000_000);

    const parser = createViewSpecParser();
    const started = performance.now();
    let reads = 0;
    for (let index = 0; index < text.length; index += 1) {
      const snapshot = parser.push(text.charAt(index));
      // A render reads the snapshot once a frame, not once a character.
      if (index % 2048 === 0) {
        reads += snapshot.spec === undefined ? 0 : 1;
        reads += snapshot.pending.size > 0 ? 0 : 1;
      }
    }
    const elapsed = performance.now() - started;
    expect(reads).toBeGreaterThan(400);
    expect(parser.end().spec).toEqual(JSON.parse(text));
    // Linear work takes well under a second; copying the open spine on every
    // character takes over a minute.
    expect(elapsed).toBeLessThan(5_000);
  }, 120_000);
});
