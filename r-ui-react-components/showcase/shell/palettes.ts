/** What a theme swatch shows: the page surface, the primary and accent, and the scheme it sorts under. */
const ROLES = {
  surface: "--C-SURFACE-0",
  primary: "--C-PRIMARY",
  accent: "--C-ACCENT",
  scheme: "--SCHEME-DARK",
} as const;

type Declared = Record<keyof typeof ROLES, string>;

export type Palette = Omit<Declared, "scheme"> & { dark: boolean };

const THEMED = /^:root\[data-theme=["']?([^"'\]]+)["']?\]$/;

/** The theme a rule's selector sets: `rootTheme` for a bare `:root`, a name for `:root[data-theme=…]`, else none. */
function themeOf(selector: string, rootTheme: string): string | null {
  for (const part of selector.split(",").map((s) => s.trim())) {
    if (part === ":root") return rootTheme;
    const named = THEMED.exec(part);
    if (named) return named[1]!;
  }
  return null;
}

/**
 * Every theme's swatch colours, as its stylesheet writes them. Themes apply only
 * at the root, so a preview cannot render "in" another theme; this reads the
 * loaded CSS instead. Conditional rules (print, forced colours) are skipped, and a
 * role a theme leaves alone is the root theme's. `rootTheme` names the `:root`
 * theme (the first in the app's list).
 */
export function readPalettes(themes: readonly string[], doc: Document = document): Map<string, Palette> {
  const rootTheme = themes[0] ?? "default";
  const declared = new Map<string, Partial<Declared>>();
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        const theme = themeOf(rule.selectorText, rootTheme);
        if (!theme) continue;
        const entry = declared.get(theme) ?? {};
        for (const [key, property] of Object.entries(ROLES) as [keyof Declared, string][]) {
          const value = rule.style.getPropertyValue(property).trim();
          if (value) entry[key] = value;
        }
        declared.set(theme, entry);
      } else if (!(rule instanceof CSSMediaRule) && "cssRules" in rule) {
        visit((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of doc.styleSheets) {
    try {
      visit(sheet.cssRules);
    } catch {
      // A cross-origin sheet hides its rules; it holds no theme of ours.
    }
  }
  const root = declared.get(rootTheme) ?? {};
  const palettes = new Map<string, Palette>();
  for (const theme of themes) {
    const palette = { ...root, ...declared.get(theme) };
    if (!Object.keys(ROLES).every((key) => palette[key as keyof Declared])) continue;
    const { scheme, ...colours } = palette as Declared;
    palettes.set(theme, { ...colours, dark: scheme === "1" });
  }
  return palettes;
}
