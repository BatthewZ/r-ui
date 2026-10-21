import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryDiagnostics } from "../../test-utils";
import { RENDERER_CLASSES } from "../diagnostics";
import type { HostPolicy, Issue, ViewSpec } from "../spec/types";
import { createViewSpecParser } from "../stream/parser";
import { ViewRenderer } from "../ViewRenderer";
import { PROBE_ATTRIBUTE } from "./view-theme";

// jsdom resolves no custom property, so the browser's half is stubbed: a
// probe's computed colour is the role's value on its box (the document's
// override) or else the host's, from the CSS package's template (its default
// theme). The real resolution is the browser checks' to prove.
const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = readFileSync(join(HERE, "..", "..", "node_modules", "@batthewz", "r-ui-css", "src", "_theme-template.css"), "utf8");
const DEFAULT_HOST: ReadonlyMap<string, string> = new Map(
  [...TEMPLATE.matchAll(/^\s*(--C-[A-Z0-9-]+)\s*:\s*([^;]+);/gm)].map((match) => [match[1] as string, (match[2] as string).trim()]),
);

let host = new Map(DEFAULT_HOST);
let hostScheme = "0";
let probed = 0;

beforeEach(() => {
  host = new Map(DEFAULT_HOST);
  hostScheme = "0";
  probed = 0;
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const token = element.getAttribute(PROBE_ATTRIBUTE);
    const box = element.parentElement;
    if (token !== null && box !== null) {
      probed += 1;
      return { color: box.style.getPropertyValue(token) || (host.get(token) ?? "") } as CSSStyleDeclaration;
    }
    if (element instanceof HTMLElement && element.hidden && element.classList.contains(RENDERER_CLASSES.themed)) {
      const scheme = element.style.getPropertyValue("--SCHEME-DARK") || hostScheme;
      return { getPropertyValue: (name: string) => (name === "--SCHEME-DARK" ? scheme : "") } as CSSStyleDeclaration;
    }
    return real(element, pseudo);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-theme");
});

const view = (theme: unknown, root: ViewSpec["root"] = "Hello"): ViewSpec => ({ version: 2, title: "Themed", theme, root } as ViewSpec);

/** A dark palette that meets every floor it touches, over the template's light host. */
const MIDNIGHT = {
  scheme: "dark",
  tokens: {
    "--C-CANVAS": "oklch(0.2 0.012 250)",
    "--C-SURFACE-0": "oklch(0.27 0.014 250)",
    "--C-SURFACE-1": "oklch(0.24 0.013 250)",
    "--C-SURFACE-2": "oklch(0.17 0.011 250)",
    "--C-SURFACE-3": "oklch(0.14 0.01 250)",
    "--C-TEXT-PRIMARY": "oklch(0.95 0.006 250)",
    "--C-TEXT-SECONDARY": "oklch(0.82 0.01 250)",
    "--C-TEXT-MUTED": "oklch(0.74 0.012 250)",
    "--C-TEXT-ACCENT": "oklch(0.8 0.1 250)",
    "--C-TEXT-INVERSE": "oklch(0.2 0.012 250)",
    "--C-BORDER": "oklch(0.95 0.006 250 / 0.14)",
    "--C-BORDER-STRONG": "oklch(0.6 0.012 250)",
    "--C-ACCENT": "oklch(0.72 0.12 250)",
    "--C-ACCENT-HOVER": "oklch(0.78 0.1 250)",
    "--C-TEXT-ON-ACCENT": "oklch(0.18 0.02 250)",
    "--C-FOCUS": "oklch(0.75 0.13 250)",
    "--C-SELECTION": "oklch(0.36 0.06 250)",
    "--C-TEXT-ON-SELECTION": "oklch(0.97 0.006 250)",
    "--C-STATUS-ERROR": "oklch(0.68 0.17 27)",
    "--C-TEXT-ERROR": "oklch(0.8 0.12 27)",
    "--C-STATUS-ERROR-BG": "oklch(0.26 0.05 27)",
    "--C-TEXT-ON-ERROR": "oklch(0.16 0.02 27)",
    "--C-STATUS-SUCCESS": "oklch(0.7 0.13 152)",
    "--C-TEXT-SUCCESS": "oklch(0.82 0.11 152)",
    "--C-STATUS-SUCCESS-BG": "oklch(0.26 0.04 152)",
    "--C-TEXT-ON-SUCCESS": "oklch(0.16 0.02 152)",
    "--C-STATUS-WARNING": "oklch(0.76 0.13 70)",
    "--C-TEXT-WARNING": "oklch(0.85 0.1 70)",
    "--C-STATUS-WARNING-BG": "oklch(0.27 0.04 70)",
    "--C-TEXT-ON-WARNING": "oklch(0.16 0.02 70)",
    "--C-STATUS-INFO": "oklch(0.7 0.12 245)",
    "--C-TEXT-INFO": "oklch(0.82 0.09 245)",
    "--C-STATUS-INFO-BG": "oklch(0.26 0.04 245)",
    "--C-TEXT-ON-INFO": "oklch(0.16 0.02 245)",
    "--C-PRIMARY": "oklch(0.92 0.01 250)",
    "--C-PRIMARY-HOVER": "oklch(0.86 0.012 250)",
    "--C-PRIMARY-ACTIVE": "oklch(0.97 0.006 250)",
    "--C-TEXT-ON-PRIMARY": "oklch(0.18 0.012 250)",
  },
};

/** Every style and class the view root ever carried, from before its first commit to the end of the first render. */
function watchRoot(container: HTMLElement) {
  const seen: string[] = [];
  const record = (records: MutationRecord[]) => {
    for (const { target, oldValue } of records) {
      if (target instanceof HTMLElement && target.parentElement === container) seen.push(oldValue ?? "");
    }
  };
  const observer = new MutationObserver(record);
  observer.observe(container, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["style", "class"] });
  return {
    seen,
    stop: () => {
      record(observer.takeRecords());
      observer.disconnect();
    },
  };
}

function mount(spec: ViewSpec, policy?: HostPolicy) {
  const container = document.body.appendChild(document.createElement("div"));
  const watch = watchRoot(container);
  const issues: Issue[] = [];
  const result = render(<ViewRenderer spec={spec} policy={policy} onIssue={(issue) => issues.push(issue)} />, { container });
  watch.stop();
  // Each record holds the value it replaced; the last one is still on the element.
  watch.seen.push(result.container.firstElementChild?.getAttribute("style") ?? "", result.container.firstElementChild?.className ?? "");
  return { ...result, root: result.container.firstElementChild as HTMLElement, issues, seen: watch.seen };
}

const styleOf = (element: Element) => element.getAttribute("style") ?? "";

const themeIssues = (issues: readonly Issue[]) => issues.filter((issue) => issue.code.startsWith("theme-") || issue.path.startsWith("/theme")).map((issue) => [issue.code, issue.path]);

describe("a document's theme on the view root", () => {
  it("applies a palette that meets the floors: every role, the scheme, and the themed class that paints the floor", async () => {
    const { root, issues } = mount(view(MIDNIGHT));
    expect(root.style.getPropertyValue("--C-CANVAS")).toBe("oklch(0.2 0.012 250)");
    expect(root.style.getPropertyValue("--C-SCRIM")).toBe("");
    expect(root.style.colorScheme).toBe("dark");
    expect(root.style.getPropertyValue("--SCHEME-DARK")).toBe("1");
    expect(root).toHaveClass(RENDERER_CLASSES.view, RENDERER_CLASSES.themed);
    expect(probed).toBeGreaterThan(30);
    // The probe left nothing behind.
    expect(root.querySelector(`[${PROBE_ATTRIBUTE}]`)).toBeNull();
    await act(async () => {});
    expect(themeIssues(issues)).toEqual([]);
  });

  it("stays transparent without a theme: no style, no themed class, nothing measured", () => {
    const { root } = mount(view(undefined));
    expect(styleOf(root)).toBe("");
    expect(root).not.toHaveClass(RENDERER_CLASSES.themed);
    expect(probed).toBe(0);
  });

  it("refuses a failing palette whole, in no commit at all, and reports each failure naming both roles and the ratio", async () => {
    const theme = { tokens: { ...MIDNIGHT.tokens, "--C-TEXT-MUTED": "oklch(0.3 0.01 250)", "--C-TEXT-ON-ACCENT": "oklch(0.75 0.1 250)" } };
    const { root, issues, seen } = mount(view({ ...MIDNIGHT, ...theme }));
    expect(styleOf(root)).toBe("");
    expect(root).not.toHaveClass(RENDERER_CLASSES.themed);
    expect(seen.filter((value) => value.includes("--C-") || value.includes(RENDERER_CLASSES.themed))).toEqual([]);
    await waitFor(() => expect(themeIssues(issues).length).toBe(2));
    expect(themeIssues(issues)).toEqual([
      ["theme-contrast", "/theme/tokens/--C-TEXT-MUTED"],
      ["theme-contrast", "/theme/tokens/--C-TEXT-ON-ACCENT"],
    ]);
    expect(issues.find((issue) => issue.path === "/theme/tokens/--C-TEXT-MUTED")?.message).toMatch(/`--C-TEXT-MUTED` on `--C-CANVAS` is \d\.\d\d:1 \(the floor is 4\.5:1\)/);
    expect(issues.find((issue) => issue.path === "/theme/tokens/--C-TEXT-ON-ACCENT")?.message).toContain("`--C-TEXT-ON-ACCENT` on `--C-ACCENT`");
    expect(queryDiagnostics().filter((found) => found.code === "theme-contrast").map((found) => found.path)).toEqual([
      "/theme/tokens/--C-TEXT-MUTED",
      "/theme/tokens/--C-TEXT-ON-ACCENT",
    ]);
  });

  it("measures a partial palette against the host's roles under it", async () => {
    // Light text alone, over the host's light surfaces.
    const { root, issues } = mount(view({ tokens: { "--C-TEXT-PRIMARY": "oklch(0.95 0.006 250)" } }));
    expect(styleOf(root)).toBe("");
    await waitFor(() => expect(themeIssues(issues)).toEqual([["theme-contrast", "/theme/tokens/--C-TEXT-PRIMARY"]]));
    expect(issues[0]?.message).toContain("`--C-TEXT-PRIMARY` on `--C-SURFACE-0`");
  });

  it("leaves the host's own pairs to the host: only a pair the document touches refuses its theme", () => {
    host.set("--C-TEXT-MUTED", "oklch(0.9 0.01 85)");
    const { root } = mount(view({ tokens: { "--C-ACCENT": "oklch(0.45 0.12 300)", "--C-ACCENT-HOVER": "oklch(0.4 0.11 300)" } }));
    expect(root.style.getPropertyValue("--C-ACCENT")).toBe("oklch(0.45 0.12 300)");
  });

  it("refuses a scheme its text and canvas contradict", async () => {
    const { root, issues } = mount(view({ scheme: "dark" }));
    expect(styleOf(root)).toBe("");
    await waitFor(() => expect(themeIssues(issues)).toEqual([["theme-contrast", "/theme/scheme"]]));
  });

  it("refuses a theme that does not conform, whole", async () => {
    const { root, issues } = mount(view({ tokens: { "--C-CANVAS": "oklch(0.2 0.012 250)", "--C-TEXT-PRIMARY": "var(--elsewhere)" } }));
    expect(styleOf(root)).toBe("");
    expect(probed).toBe(0);
    await waitFor(() => expect(themeIssues(issues)).toEqual([["invalid-value", "/theme/tokens/--C-TEXT-PRIMARY"]]));
  });
});

describe("the host's policy", () => {
  it("ignores the theme when themeOverrides is false", async () => {
    const { root, issues } = mount(view(MIDNIGHT), { themeOverrides: false });
    expect(styleOf(root)).toBe("");
    expect(probed).toBe(0);
    await waitFor(() => expect(themeIssues(issues)).toEqual([["theme-disabled", "/theme"]]));
  });

  it("follows a policy that changes on a mounted view, compared member by member", () => {
    const { container, rerender } = render(<ViewRenderer spec={view(MIDNIGHT)} policy={{ themeOverrides: true }} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass(RENDERER_CLASSES.themed);
    rerender(<ViewRenderer spec={view(MIDNIGHT)} policy={{ themeOverrides: false }} />);
    expect(styleOf(root)).toBe("");
    // Every role but the hairline border, which no floor measures.
    const allButBorder = Object.keys(MIDNIGHT.tokens).filter((name) => name !== "--C-BORDER");
    rerender(<ViewRenderer spec={view(MIDNIGHT)} policy={{ themeOverrides: allButBorder }} />);
    expect(root.style.getPropertyValue("--C-CANVAS")).toBe("oklch(0.2 0.012 250)");
    expect(root.style.getPropertyValue("--C-BORDER")).toBe("");
  });

  it("applies only the listed roles, and the scheme, and warns for the rest", async () => {
    const { root, issues } = mount(view({ tokens: { "--C-ACCENT": "oklch(0.45 0.12 300)", "--C-CANVAS": "oklch(0.95 0.01 300)" } }), {
      themeOverrides: ["--C-ACCENT"],
    });
    expect(root.style.getPropertyValue("--C-ACCENT")).toBe("oklch(0.45 0.12 300)");
    expect(root.style.getPropertyValue("--C-CANVAS")).toBe("");
    await waitFor(() => expect(themeIssues(issues)).toEqual([["theme-disabled", "/theme/tokens/--C-CANVAS"]]));
  });
});

describe("over time", () => {
  it("applies the theme once its object has closed, never half a palette", () => {
    const text = JSON.stringify(view(MIDNIGHT, { component: "Stack", children: ["Body"] }));
    const closes = text.indexOf("}", text.indexOf('"tokens"')) + 2;
    const parser = createViewSpecParser();
    const { container, rerender } = render(<ViewRenderer snapshot={parser.push(text.slice(0, closes - 60))} />);
    const root = container.firstElementChild as HTMLElement;
    expect(styleOf(root)).toBe("");
    expect(probed).toBe(0);
    rerender(<ViewRenderer snapshot={parser.push(text.slice(closes - 60, closes - 1))} />);
    expect(styleOf(root)).toBe("");
    expect(probed).toBe(0);
    rerender(<ViewRenderer snapshot={parser.push(text.slice(closes - 1, closes))} />);
    expect(root.style.getPropertyValue("--C-TEXT-MUTED")).toBe("oklch(0.74 0.012 250)");
    expect(root).toHaveClass(RENDERER_CLASSES.themed);
  });

  it("drops the overrides with the document: the next one starts from the host's theme", () => {
    const { container, rerender } = render(<ViewRenderer spec={view(MIDNIGHT)} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass(RENDERER_CLASSES.themed);
    rerender(<ViewRenderer spec={view(undefined)} />);
    expect(styleOf(root)).toBe("");
    expect(root).not.toHaveClass(RENDERER_CLASSES.themed);
  });

  it("measures again when the host's theme changes, and refuses what no longer holds", async () => {
    const issues: Issue[] = [];
    const { container } = render(<ViewRenderer spec={view({ tokens: { "--C-TEXT-PRIMARY": "oklch(0.15 0.01 250)" } })} onIssue={(issue) => issues.push(issue)} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--C-TEXT-PRIMARY")).toBe("oklch(0.15 0.01 250)");
    for (const name of ["--C-CANVAS", "--C-SURFACE-0", "--C-SURFACE-1", "--C-SURFACE-2", "--C-SURFACE-3"]) host.set(name, "oklch(0.2 0.01 250)");
    hostScheme = "1";
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "midnight");
    });
    expect(styleOf(root)).toBe("");
    await waitFor(() => expect(themeIssues(issues)).toEqual([["theme-contrast", "/theme/tokens/--C-TEXT-PRIMARY"]]));
  });

  it("keeps a refusal for the document's life, as its report does, when the host's theme changes back; the next document is judged afresh", async () => {
    const issues: Issue[] = [];
    const theme = { tokens: { "--C-TEXT-PRIMARY": "oklch(0.15 0.01 250)" } };
    const { container, rerender } = render(<ViewRenderer spec={view(theme)} onIssue={(issue) => issues.push(issue)} />);
    const root = container.firstElementChild as HTMLElement;
    const light = new Map(host);
    for (const name of ["--C-CANVAS", "--C-SURFACE-0", "--C-SURFACE-1", "--C-SURFACE-2", "--C-SURFACE-3"]) host.set(name, "oklch(0.2 0.01 250)");
    await act(async () => {
      document.documentElement.setAttribute("data-theme", "midnight");
    });
    expect(styleOf(root)).toBe("");
    host = light;
    await act(async () => {
      document.documentElement.removeAttribute("data-theme");
    });
    expect(styleOf(root)).toBe("");
    expect(queryDiagnostics().map((found) => found.code)).toEqual(["theme-contrast"]);
    rerender(<ViewRenderer spec={view(theme, "Next")} onIssue={(issue) => issues.push(issue)} />);
    expect(root.style.getPropertyValue("--C-TEXT-PRIMARY")).toBe("oklch(0.15 0.01 250)");
    await act(async () => {});
    expect(queryDiagnostics()).toEqual([]);
  });

  it("judges only what the document decides alone in a DOM that resolves no custom property, as the validator does", async () => {
    vi.mocked(window.getComputedStyle).mockRestore();
    // Light text over the host's light canvas: the host's side is unknown here, so it applies.
    const partial = mount(view({ tokens: { "--C-TEXT-PRIMARY": "oklch(0.95 0.006 250)" } }));
    expect(partial.root.style.getPropertyValue("--C-TEXT-PRIMARY")).toBe("oklch(0.95 0.006 250)");
    // Both sides the document's own: refused.
    const both = mount(view({ tokens: { "--C-SURFACE-0": "#fafafa", "--C-TEXT-PRIMARY": "#eeeeee" } }));
    expect(styleOf(both.root)).toBe("");
    await waitFor(() => expect(themeIssues(both.issues)).toEqual([["theme-contrast", "/theme/tokens/--C-TEXT-PRIMARY"]]));
    expect(themeIssues(partial.issues)).toEqual([]);
  });

  it("measures nothing under forced colours, where the stylesheet sets the overrides aside", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(forced-colors: active)", addEventListener() {}, removeEventListener() {} }));
    try {
      const { root } = mount(view({ tokens: { "--C-TEXT-PRIMARY": "oklch(0.95 0.006 250)" } }));
      expect(probed).toBe(0);
      expect(root.style.getPropertyValue("--C-TEXT-PRIMARY")).toBe("oklch(0.95 0.006 250)");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
