/**
 * The showcase's View settings: the four axes a reader can flip, minus the
 * container (that one is per-widget). Each maps to one attribute on <html>,
 * exactly as an app would set it:
 *
 *   theme   -> data-theme    (absent = the default theme, `:root`)
 *   density -> data-density  (absent = comfortable, the :root default)
 *   input   -> data-input    (absent = auto, i.e. `@media (pointer: coarse)`)
 *
 * The example theme names are listed here because the showcase is a consumer
 * app that chose to import those theme files. The library itself never names them.
 */

export const STORAGE_KEY = "r-ui-showcase:view";

export const THEMES = ["default", "nightfall", "harbour"] as const;
export const DENSITIES = ["comfortable", "compact"] as const;
export const INPUTS = ["auto", "fine", "coarse"] as const;

export type Theme = (typeof THEMES)[number];
export type Density = (typeof DENSITIES)[number];
export type Input = (typeof INPUTS)[number];

export interface View {
  theme: Theme;
  density: Density;
  input: Input;
}

export const DEFAULT_VIEW: View = { theme: "default", density: "comfortable", input: "auto" };

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

/** The saved view, validated field by field; anything unreadable is the default. */
export function readView(): View {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    const v = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      theme: pick(THEMES, v.theme, DEFAULT_VIEW.theme),
      density: pick(DENSITIES, v.density, DEFAULT_VIEW.density),
      input: pick(INPUTS, v.input, DEFAULT_VIEW.input),
    };
  } catch {
    return DEFAULT_VIEW;
  }
}

/** Write the view to <html> and persist it. Storage failures (private mode) are ignored. */
export function applyView(view: View, root: HTMLElement = document.documentElement): void {
  setOrRemove(root, "data-theme", view.theme === "default" ? null : view.theme);
  setOrRemove(root, "data-density", view.density === "comfortable" ? null : view.density);
  setOrRemove(root, "data-input", view.input === "auto" ? null : view.input);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view));
  } catch {
    /* private browsing or storage disabled: the view still applies */
  }
}

function setOrRemove(el: HTMLElement, name: string, value: string | null) {
  if (value === null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** The tokens the readout shows, resolved at <html>. */
export const READOUT_TOKENS = ["--CONTROL-H", "--ROW-H", "--HIT-MIN", "--R-SIZE-3", "--BodyText-1"] as const;

export interface Reading {
  token: (typeof READOUT_TOKENS)[number];
  /** The computed custom-property value (`0.75rem`, or px for @property-registered tokens). */
  value: string;
  /** The same length resolved to px, via a probe element. */
  px: string;
}

/**
 * Resolve each readout token to its computed value and to px. A probe element
 * appended to <body> gets `inline-size: var(--X)` and reports its used width,
 * which turns any length (rem, max(), calc()) into px. Root-level, so it reads
 * the page's own density and input, which is what the View panel sets.
 */
export function readTokens(doc: Document = document): Reading[] {
  const rootStyle = getComputedStyle(doc.documentElement);
  const probe = doc.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.blockSize = "0";
  doc.body.append(probe);
  try {
    return READOUT_TOKENS.map((token) => {
      probe.style.inlineSize = `var(${token})`;
      const px = getComputedStyle(probe).inlineSize;
      return { token, value: rootStyle.getPropertyValue(token).trim() || "unset", px };
    });
  } finally {
    probe.remove();
  }
}
