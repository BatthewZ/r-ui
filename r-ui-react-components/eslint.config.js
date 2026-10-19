import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Deliberately narrow: each rule is tied to a defect class the previous
 * generation of this library actually shipped. The recommended presets are not
 * enabled; they would bury these signals under stylistic findings.
 *
 * Scope is `src/`, `showcase/` and `scripts/` (minus the deliberately-bad
 * fixtures the gates' own tests read). The scripts are plain JavaScript, so they
 * get the rules that need no types: unreachable code, unused and undeclared names.
 */

/** Node globals the gates use. */
const NODE = {
  process: "readonly",
  console: "readonly",
  URL: "readonly",
  fetch: "readonly",
  setTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  clearTimeout: "readonly",
};

/**
 * A browser check is one `async (page) => …` expression run by playwright-cli:
 * its own code runs in Node, the callbacks it hands `page.evaluate` run in the
 * page. Both kinds of name are listed, plus what `browser-prelude.js` declares.
 * `URL` is not: run-code's Node scope has no `URL` global, and a page callback
 * can do without it, so lint catches it where it would throw.
 */
const BROWSER_CHECK = {
  console: "readonly",
  setTimeout: "readonly",
  document: "readonly",
  window: "readonly",
  location: "readonly",
  navigator: "readonly",
  localStorage: "readonly",
  performance: "readonly",
  getComputedStyle: "readonly",
  matchMedia: "readonly",
  requestAnimationFrame: "readonly",
  innerWidth: "readonly",
  innerHeight: "readonly",
  fetch: "readonly",
  Intl: "readonly",
  Node: "readonly",
  NodeFilter: "readonly",
  HTMLElement: "readonly",
  MouseEvent: "readonly",
  KeyboardEvent: "readonly",
  PointerEvent: "readonly",
  ClipboardEvent: "readonly",
  DataTransfer: "readonly",
  waitForShowcase: "readonly",
  showcaseThemes: "readonly",
  darkTheme: "readonly",
  collectErrors: "readonly",
  resetShowcase: "readonly",
  SHOWCASE_VIEW_KEY: "readonly",
  SHOWCASE_VIEWPORT: "readonly",
  SHOWCASE_BLANK: "readonly",
  openSection: "readonly",
  setView: "readonly",
  settle: "readonly",
  openPage: "readonly",
  withClock: "readonly",
  viewMatrix: "readonly",
  sweepViews: "readonly",
  mark: "readonly",
  // Declared by the runner's wrapper, ahead of the prelude.
  BROWSER_CHECK_PROFILE: "readonly",
  BROWSER_CHECK_ROUTE: "readonly",
  BROWSER_CHECK_SEED: "readonly",
  BROWSER_CHECK_BUILT: "readonly",
};

const SCRIPT_RULES = { "no-unreachable": "error", "no-undef": "error", "no-unused-vars": "error" };
export default tseslint.config(
  // "Never suppress, only fix": an `eslint-disable` comment cannot silence
  // anything, and the dead directive is itself reported (`--max-warnings 0`).
  { linterOptions: { noInlineConfig: true } },
  { ignores: ["dist/**", "showcase/dist/**", "node_modules/**", "scripts/fixtures/**"] },
  {
    files: ["scripts/**/*.mjs", "eslint.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: NODE },
    rules: SCRIPT_RULES,
  },
  {
    // Scripts, not modules: the prelude's top-level functions are used by the checks it is prepended to.
    files: ["scripts/browser/*.js", "scripts/lib/browser-prelude.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "script", globals: BROWSER_CHECK },
    rules: { ...SCRIPT_RULES, "no-unused-vars": ["error", { vars: "local" }] },
  },
  {
    files: ["src/**/*.{ts,tsx}", "showcase/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      // Missing keys in an iterator: a recurring defect in the old library.
      "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      // Unreachable code is a defect, not a style opinion (a profiling bypass
      // once shipped behind an early `return`).
      "no-unreachable": "error",
      // A conditional hook corrupts hook order for every render after it.
      "react-hooks/rules-of-hooks": "error",
      // NOT enabled: react-hooks/exhaustive-deps. Its suggested fixes were
      // wrong at both of its findings in the old library; enable it when a
      // finding here would be right, never with a disable comment.
    },
  },
);
