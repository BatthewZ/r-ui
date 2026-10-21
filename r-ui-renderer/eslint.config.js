import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Deliberately narrow, as in the component library: each rule is tied to a
 * defect class, and the recommended presets would bury them under style.
 * The gates under `scripts/` are plain JavaScript and get the rules that need
 * no types; their fixtures are deliberately bad and are not linted.
 */

/** Node globals the gates and the CLI use. */
const NODE = {
  process: "readonly",
  console: "readonly",
  URL: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

const SCRIPT_RULES = { "no-unreachable": "error", "no-undef": "error", "no-unused-vars": "error" };

export default tseslint.config(
  // "Never suppress, only fix": an inline directive cannot silence anything,
  // and the dead directive is itself reported (`--max-warnings 0`).
  { linterOptions: { noInlineConfig: true } },
  { ignores: ["dist/**", "playground/dist/**", "node_modules/**", "scripts/fixtures/**"] },
  {
    files: ["scripts/**/*.mjs", "playground/**/*.mjs", "eslint.config.js"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module", globals: NODE },
    rules: SCRIPT_RULES,
  },
  {
    files: ["src/**/*.{ts,tsx}", "playground/**/*.{ts,tsx}", "test-utils.ts", "test-setup.ts", "*.config.ts"],
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
      "react/jsx-key": ["error", { checkFragmentShorthand: true }],
      "no-unreachable": "error",
      // A conditional hook corrupts hook order for every render after it.
      "react-hooks/rules-of-hooks": "error",
    },
  },
);
