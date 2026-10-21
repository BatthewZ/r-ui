/**
 * The corpus is the format's reference: every document validates with no
 * issue at all, Zod agrees, it renders with no diagnostic anywhere in the page,
 * the coverage documents name every addressable component, and each product
 * document streams with the parser's prefix guarantees at every boundary.
 */

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryDiagnostics, stubDialog, stubPopover } from "../../test-utils";
import { defaultContracts } from "../contracts";
import { icons } from "../icons";
import { isPlainObject } from "../spec/guards";
import { appendPointer, parsePointer } from "../spec/pointer";
import type { Issue } from "../spec/types";
import { validateViewSpec } from "../spec/validate";
import { createViewSpecParser } from "../stream/parser";
import { isPending } from "../stream/pending";
import type { StreamSnapshot } from "../stream/snapshot";
import { ViewRenderer } from "../ViewRenderer";
import { viewSpecSchema } from "../zod";
import { apiEndpoints, componentNames, fixtureFetch, TEST_ORIGIN } from "./corpus.test.helpers";
import {
  COVERAGE_EXAMPLES,
  EXAMPLES,
  type ExampleName,
  exampleSpec,
  exampleText,
  PRODUCT_EXAMPLES,
  type ProductExampleName,
} from "./index";

const ALL = Object.keys(EXAMPLES) as ExampleName[];
const PRODUCTS = Object.keys(PRODUCT_EXAMPLES) as ProductExampleName[];

/**
 * Addressable names no coverage document uses, each with the reason. A
 * document is what a model learns from, so it shows only what any host can
 * render and what the advice recommends.
 */
const EXCUSED: { readonly [name: string]: string } = {
  PasswordInput: "sensitive: renders only where the host allows it, and VIEWSPEC asks for credentials only in views the host built",
  OTPInput: "sensitive: renders only where the host allows it, and VIEWSPEC asks for credentials only in views the host built",
};

const stems = (dir: string) =>
  readdirSync(join(import.meta.dirname, dir))
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.slice(0, -".json".length))
    .sort();

describe("the corpus manifest", () => {
  it("lists every document file under its stem, product and coverage apart", () => {
    expect(Object.keys(PRODUCT_EXAMPLES).sort()).toEqual(stems("."));
    expect(Object.keys(COVERAGE_EXAMPLES).sort()).toEqual(stems("coverage"));
    expect(ALL).toHaveLength(stems(".").length + stems("coverage").length);
  });
});

describe.each(ALL)("%s", (name) => {
  const text = exampleText(name);

  it("validates with no issue at all, and Zod agrees", () => {
    const result = validateViewSpec(text, { origin: TEST_ORIGIN });
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect(viewSpecSchema.safeParse(EXAMPLES[name]).success).toBe(true);
  });

  describe("rendered", () => {
    let dialogs: ReturnType<typeof stubDialog>;
    let popovers: ReturnType<typeof stubPopover>;
    beforeEach(() => {
      dialogs = stubDialog();
      popovers = stubPopover();
    });
    afterEach(() => {
      dialogs.restore();
      popovers.restore();
    });

    it("shows no diagnostic anywhere in the page and reports no issue, its data loaded", async () => {
      const issues: Issue[] = [];
      const fixtures = fixtureFetch();
      const toast = vi.fn();
      render(
        <ViewRenderer
          spec={exampleSpec(name)}
          adapters={{ fetch: fixtures.fetch, toast, navigate: vi.fn() }}
          icons={icons}
          onIssue={(issue) => issues.push(issue)}
        />,
      );
      await act(async () => {
        await fixtures.settled();
      });
      await act(async () => {});
      const answered = fixtures.requests.map((request) => `${request.status} ${new URL(request.url).pathname}`);
      expect(new Set(answered)).toEqual(new Set(apiEndpoints(EXAMPLES[name]).map((endpoint) => `200 ${endpoint}`)));
      expect(queryDiagnostics()).toEqual([]);
      expect(issues).toEqual([]);
      expect(toast).not.toHaveBeenCalled();
    });
  });
});

describe("what the corpus opens", () => {
  let dialogs: ReturnType<typeof stubDialog>;
  let popovers: ReturnType<typeof stubPopover>;
  beforeEach(() => {
    dialogs = stubDialog();
    popovers = stubPopover();
  });
  afterEach(() => {
    dialogs.restore();
    popovers.restore();
  });

  /** The open `<dialog>` whose accessible name is `name`. */
  const openDialog = (name: string, role: "dialog" | "alertdialog" = "dialog") => {
    const dialog = screen.getByRole(role, { name, hidden: true }) as HTMLDialogElement | null;
    expect(dialog?.hasAttribute("open"), name).toBe(true);
    return dialog as HTMLDialogElement;
  };

  it("overlays: the drawer, both dialogs and the popover open from their own controls, with nothing wrong inside", async () => {
    const user = userEvent.setup();
    const issues: Issue[] = [];
    render(<ViewRenderer spec={exampleSpec("overlays")} adapters={{ toast: vi.fn() }} icons={icons} onIssue={(issue) => issues.push(issue)} />);

    await user.click(screen.getByRole("button", { name: "Full history" }));
    expect(within(openDialog("History")).getByText(/Missed collection/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Reschedule collection…", hidden: true }));
    expect(within(openDialog("Reschedule collection")).getByLabelText(/^Reason/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel shipment" }));
    expect(within(openDialog("Cancel this shipment?", "alertdialog")).getByText(/refunded €182.40/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add a note" }));
    expect(popovers.show).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Note", hidden: true })).toBeInTheDocument();

    expect(queryDiagnostics()).toEqual([]);
    expect(issues).toEqual([]);
  });

  it("team-directory: each person's address is a mailto link built with $concat", async () => {
    const fixtures = fixtureFetch();
    render(<ViewRenderer spec={exampleSpec("team-directory")} adapters={{ fetch: fixtures.fetch }} icons={icons} />);
    await act(async () => {
      await fixtures.settled();
    });
    await act(async () => {});
    const address = "mariana.okonkwo-fitzgerald@northwind.example";
    expect(screen.getByRole("link", { name: address })).toHaveAttribute("href", `mailto:${address}`);
  });

  it("settings-form: the delete dialog opens, and its form refuses to submit unconfirmed", async () => {
    const user = userEvent.setup();
    const fixtures = fixtureFetch();
    const toast = vi.fn();
    render(<ViewRenderer spec={exampleSpec("settings-form")} adapters={{ fetch: fixtures.fetch, toast }} icons={icons} />);
    await act(async () => {
      await fixtures.settled();
    });

    await user.click(screen.getByRole("button", { name: "Delete workspace…" }));
    const dialog = openDialog("Delete this workspace?", "alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete workspace", hidden: true }));
    expect(await within(dialog).findByText("Confirm that you understand this cannot be undone.")).toBeInTheDocument();
    expect(fixtures.requests.filter((request) => request.method === "DELETE")).toEqual([]);
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(toast).not.toHaveBeenCalled();
    expect(queryDiagnostics()).toEqual([]);
  });
});

describe("coverage", () => {
  const families = new Map<string, string[]>();
  for (const [componentName, contract] of Object.entries(defaultContracts)) {
    families.set(contract.category, [...(families.get(contract.category) ?? []), componentName]);
  }

  it("has one document per family, and nothing else", () => {
    expect(Object.keys(COVERAGE_EXAMPLES).sort()).toEqual([...families.keys()].sort());
  });

  it.each([...families])("the %s document names every component and part of its family, or excuses it", (family, members) => {
    const used = isFamily(family) ? componentNames(COVERAGE_EXAMPLES[family]) : new Set<string>();
    const missing = members.filter((member) => !used.has(member) && !Object.hasOwn(EXCUSED, member));
    expect(missing).toEqual([]);
  });

  it("excuses only addressable names that no coverage document uses, each with a reason", () => {
    const used = new Set(Object.values(COVERAGE_EXAMPLES).flatMap((document) => [...componentNames(document)]));
    for (const [excused, reason] of Object.entries(EXCUSED)) {
      expect(Object.hasOwn(defaultContracts, excused), excused).toBe(true);
      expect(used.has(excused), excused).toBe(false);
      expect(reason.length, excused).toBeGreaterThan(20);
    }
  });
});

function isFamily(family: string): family is keyof typeof COVERAGE_EXAMPLES {
  return Object.hasOwn(COVERAGE_EXAMPLES, family);
}

// ---------------------------------------------------------------------------
// The streaming prefix property (the parser's own harness, over the corpus)

function valueAt(root: unknown, pointer: string): unknown {
  let value = root;
  for (const token of parsePointer(pointer) ?? []) {
    if (Array.isArray(value)) value = value[Number(token)];
    else if (isPlainObject(value) && Object.hasOwn(value, token)) value = value[token];
    else return undefined;
  }
  return value;
}

/** Every node object the snapshot shows, by node positions only. */
function emittedNodes(node: unknown, pointer: string, out: Map<string, Record<string, unknown>> = new Map()) {
  if (!isPlainObject(node)) return out;
  out.set(pointer, node);
  if (Array.isArray(node.children)) node.children.forEach((child, index) => emittedNodes(child, `${pointer}/children/${index}`, out));
  for (const key of ["node", "then", "else"]) if (Object.hasOwn(node, key)) emittedNodes(node[key], `${pointer}/${key}`, out);
  return out;
}

const BODY_KEYS = new Set(["children", "node", "then", "else"]);

/** Asserts every closed object or array in `before` is the identical object in `after`. */
function expectClosedIdentity(before: unknown, after: unknown, pointer: string, pending: ReadonlySet<string>): void {
  if (typeof before !== "object" || before === null) return;
  if (!pending.has(pointer)) {
    if (after !== before) expect.fail(`closed value at "${pointer}" changed identity`);
    return;
  }
  const entries: [string, unknown][] = Array.isArray(before) ? before.map((value, index) => [String(index), value]) : Object.entries(before);
  for (const [token, value] of entries) {
    expectClosedIdentity(value, valueAt(after, appendPointer("", token)), appendPointer(pointer, token), pending);
  }
}

describe.each(PRODUCTS)("%s, streamed a character at a time", (name) => {
  it("only ever shows final node heads, never loses a shown node, and keeps closed subtrees' identity", () => {
    const text = exampleText(name);
    const final: unknown = JSON.parse(text);
    const parser = createViewSpecParser();
    let previous: StreamSnapshot | undefined;
    let shown = new Map<string, Record<string, unknown>>();
    let grew = 0;

    for (let index = 0; index < text.length; index += 1) {
      const snapshot = parser.push(text.charAt(index));
      const at = `after ${index + 1} of ${text.length} characters`;
      if (snapshot.error !== undefined) expect.fail(`${at}: ${snapshot.error.message}`);
      const spec = snapshot.spec;
      const now = spec === undefined || isPending(spec.root) ? new Map<string, Record<string, unknown>>() : emittedNodes(spec.root, "/root");

      for (const pointer of shown.keys()) if (!now.has(pointer)) expect.fail(`${at}: ${pointer} vanished`);
      for (const [pointer, node] of now) {
        if (shown.has(pointer)) continue;
        grew += 1;
        const finalNode = valueAt(final, pointer);
        if (!isPlainObject(finalNode)) expect.fail(`${at}: ${pointer} is no node in the document`);
        for (const key of new Set([...Object.keys(node), ...Object.keys(finalNode)])) {
          if (!BODY_KEYS.has(key)) expect(node[key], `${at}: ${pointer}/${key}`).toEqual(finalNode[key]);
        }
      }
      shown = now;
      if (previous?.spec !== undefined) expectClosedIdentity(previous.spec, spec, "", previous.pending);
      previous = snapshot;
    }

    const last = parser.end();
    expect(last.complete).toBe(true);
    expect(last.spec).toEqual(final);
    expect(grew).toBe(emittedNodes((final as { root: unknown }).root, "/root").size);
  });
});
