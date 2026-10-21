import { type CSSProperties, type RefObject, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";

import { RENDERER_CLASSES } from "../diagnostics";
import type { ResolvedPolicy } from "../runtime/context";
import {
  type ContrastFailure,
  contrastFailures,
  contrastIssues,
  documentFailures,
  type Palette,
  THEME_CONTRAST_PAIRS,
  THEME_SCHEME_PAIR,
  themeProblem,
  themeRequest,
  type ThemeRequest,
} from "../spec/theme";
import type { Issue } from "../spec/types";

/** What the view root carries for its document's theme, and the issues to report. */
export interface ViewTheme {
  /** The overrides, once the palette passed; undefined while unchecked, refused or absent. */
  readonly style: CSSProperties | undefined;
  readonly issues: readonly Issue[];
}

interface Plan {
  readonly request: ThemeRequest;
  /** `color-scheme`, `--SCHEME-DARK` and every role, as declarations on the view root. */
  readonly declarations: readonly (readonly [string, string])[];
  /** Equal for equal requests: the verdict for one is the verdict for the other. */
  readonly key: string;
  readonly issues: readonly Issue[];
}

const NO_ISSUES: readonly Issue[] = Object.freeze([]);
const EMPTY: Plan = { request: themeRequest(undefined, {}), declarations: [], key: "", issues: NO_ISSUES };

function plan(theme: unknown, policy: ResolvedPolicy): Plan {
  if (theme === undefined) return EMPTY;
  const problem = themeProblem(theme);
  if (problem !== undefined) return { ...EMPTY, issues: [problem] };
  const request = themeRequest(theme as { readonly scheme?: unknown; readonly tokens?: unknown }, policy);
  const declarations: [string, string][] = [];
  if (request.scheme !== undefined) declarations.push(["color-scheme", request.scheme], ["--SCHEME-DARK", request.scheme === "dark" ? "1" : "0"]);
  for (const entry of request.tokens) declarations.push(entry);
  return { request, declarations, key: JSON.stringify(declarations), issues: request.issues };
}

/** The probe's names: every role a floor or the scheme row reads. */
const MEASURED = [...new Set([...THEME_CONTRAST_PAIRS.flatMap((pair) => [pair.fg, pair.bg]), THEME_SCHEME_PAIR.text, THEME_SCHEME_PAIR.canvas])];

/** Marks a probe element with the role whose computed colour it reports. */
export const PROBE_ATTRIBUTE = "data-r-renderer-probe";

/**
 * The palette under `root` with `declarations` over it, as the browser
 * computes it. A custom property's computed value is its unresolved text, so
 * each role is read as the `color` of a hidden element that paints with it,
 * inside a box carrying the declarations and the themed class (whose
 * preference rules apply to the box as they would to the root).
 */
function probePalette(root: HTMLElement, declarations: readonly (readonly [string, string])[]): Palette {
  const doc = root.ownerDocument;
  const box = doc.createElement("div");
  box.hidden = true;
  box.className = RENDERER_CLASSES.themed;
  for (const [property, value] of declarations) box.style.setProperty(property, value);
  const probes = MEASURED.map((name) => {
    const probe = doc.createElement("span");
    probe.setAttribute(PROBE_ATTRIBUTE, name);
    probe.style.setProperty("color", `var(${name})`);
    box.append(probe);
    return [name, probe] as const;
  });
  root.append(box);
  try {
    const view = doc.defaultView ?? window;
    const colours = new Map(probes.map(([name, probe]) => [name, view.getComputedStyle(probe).color]));
    const scheme = view.getComputedStyle(box).getPropertyValue("--SCHEME-DARK").trim();
    return { colours, schemeDark: scheme === "1" ? 1 : scheme === "0" ? 0 : undefined };
  } finally {
    box.remove();
  }
}

function measure(root: HTMLElement, { request, declarations }: Plan): readonly Issue[] {
  const palette = probePalette(root, declarations);
  const set = request.tokens;
  const schemeMoved = request.scheme !== undefined || set.has(THEME_SCHEME_PAIR.text) || set.has(THEME_SCHEME_PAIR.canvas);
  const resolved = ![...palette.colours.values()].some((colour) => colour.includes("var("));
  const failures: ContrastFailure[] = resolved
    ? // The host's own pairs are the host's to check: only a pair the document touches can refuse its theme.
      contrastFailures(palette, (pair) => set.has(pair.fg) || set.has(pair.bg), schemeMoved)
    : // A DOM that computes no custom property (jsdom) knows only the document's side, as the validator does.
      documentFailures(request);
  return failures.length === 0 ? NO_ISSUES : contrastIssues(failures, request);
}

const FORCED_COLORS = "(forced-colors: active)";

function subscribeForcedColors(onChange: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(FORCED_COLORS);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const forcedColors = () => typeof matchMedia === "function" && matchMedia(FORCED_COLORS).matches;

/**
 * Bumps when anything on `<html>` changes (`data-theme`, a class, its style):
 * the host's palette under the view may have moved, so the theme is measured
 * again. Store updates render synchronously, before the next paint.
 */
let hostVersion = 0;
function subscribeHost(onChange: () => void): () => void {
  if (typeof MutationObserver !== "function" || typeof document === "undefined") return () => {};
  const observer = new MutationObserver(() => {
    hostVersion += 1;
    onChange();
  });
  observer.observe(document.documentElement, { attributes: true });
  return () => observer.disconnect();
}
const readHostVersion = () => hostVersion;

/** React's spelling: custom properties as written, `color-scheme` camel-cased. */
function toStyle(declarations: Plan["declarations"]): CSSProperties {
  const style: Record<string, string> = {};
  for (const [property, value] of declarations) style[property === "color-scheme" ? "colorScheme" : property] = value;
  return style;
}

interface Verdict {
  readonly key: string;
  readonly generation: number;
  readonly host: number;
  readonly forced: boolean;
  readonly issues: readonly Issue[];
}

/**
 * A document's closed `theme` on the view root. Nothing applies until the
 * palette it would make has been measured: the first render carries no
 * overrides, a layout effect measures them in a probe under the root, and
 * the render that follows (still before paint) applies them only if every
 * floor the document touches holds. Under forced colours nothing is measured
 * (the stylesheet sets the overrides aside there), and a change on `<html>`
 * measures again. A refusal holds for the rest of the document (`generation`),
 * as its report, delivered once, does.
 */
export function useViewTheme(theme: unknown, policy: ResolvedPolicy, generation: number, root: RefObject<HTMLElement | null>): ViewTheme {
  const current = useMemo(() => plan(theme, policy), [theme, policy]);
  const forced = useSyncExternalStore(subscribeForcedColors, forcedColors, () => false);
  const host = useSyncExternalStore(subscribeHost, readHostVersion, () => 0);
  const [verdict, setVerdict] = useState<Verdict | undefined>(undefined);

  const { key } = current;
  useLayoutEffect(() => {
    const element = root.current;
    if (current.declarations.length === 0 || element === null) return;
    const same = verdict !== undefined && verdict.key === key && verdict.generation === generation;
    if (same && (verdict.issues.length > 0 || (verdict.host === host && verdict.forced === forced))) return;
    setVerdict({ key, generation, host, forced, issues: forced ? NO_ISSUES : measure(element, current) });
  }, [current, key, generation, host, forced, verdict, root]);

  return useMemo(() => {
    const judged = verdict !== undefined && verdict.key === key && verdict.generation === generation && current.declarations.length > 0;
    const passed = judged && verdict.issues.length === 0;
    const style = passed ? toStyle(current.declarations) : undefined;
    const issues = judged && !passed ? [...current.issues, ...verdict.issues] : current.issues;
    return { style, issues };
  }, [current, key, generation, verdict]);
}
