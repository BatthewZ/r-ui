import { useEffect } from "react";

import { useDensity, useInputMode, useTheme } from "../../src/hooks/use-preferences";
import { DENSITIES, type Density, INPUT_MODES, type InputMode } from "../../src/util/preferences";
import { PREFERENCES, THEMES } from "./view";

type Theme = (typeof THEMES)[number]["value"];

/** A View to switch to: any subset of the axes. `dir` is the document's direction. */
export interface ShowcaseView {
  theme?: string;
  density?: string;
  input?: string;
  dir?: string;
}

declare global {
  interface Window {
    /** Present while the showcase runs: what the browser checks drive it by. */
    __showcase?: { setView: (view: ShowcaseView) => void };
  }
}

const oneOf = <T extends string>(axis: string, value: string, allowed: readonly T[]): T => {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`showcase: ${axis} "${value}" is not one of ${allowed.join(", ")}`);
  return value as T;
};

/**
 * Publishes `window.__showcase.setView(view)`, which switches the View live,
 * without a reload, through the same preference hooks the View panel's
 * switchers use (so it also saves the choice, as they do). The browser checks
 * call it through the prelude's `setView`. A value outside the app's lists
 * throws rather than being ignored, so a check never measures the View it did
 * not ask for.
 */
export function ViewBridge() {
  const { setTheme, themes } = useTheme(PREFERENCES);
  const { setDensity } = useDensity(PREFERENCES);
  const { setInput } = useInputMode(PREFERENCES);

  useEffect(() => {
    const bridge = {
      setView({ theme, density, input, dir }: ShowcaseView) {
        // Validate every axis before applying any, so a bad call changes nothing.
        const next = {
          theme: theme === undefined ? undefined : oneOf<Theme>("theme", theme, themes),
          density: density === undefined ? undefined : oneOf<Density>("density", density, DENSITIES),
          input: input === undefined ? undefined : oneOf<InputMode>("input", input, INPUT_MODES),
          dir: dir === undefined ? undefined : oneOf("dir", dir, ["ltr", "rtl"] as const),
        };
        if (next.theme) setTheme(next.theme);
        if (next.density) setDensity(next.density);
        if (next.input) setInput(next.input);
        if (next.dir === "rtl") document.documentElement.dir = "rtl";
        else if (next.dir === "ltr") document.documentElement.removeAttribute("dir");
      },
    };
    window.__showcase = bridge;
    return () => {
      if (window.__showcase === bridge) delete window.__showcase;
    };
  }, [setTheme, setDensity, setInput, themes]);

  return null;
}
