import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Deliberately narrow: each rule is tied to a defect class the previous
 * generation of this library actually shipped. The recommended presets are not
 * enabled; they would bury these signals under stylistic findings.
 *
 * Scope is `src/` and `showcase/`. `scripts/` is plain Node and carries
 * deliberately-bad fixtures for the gates' own tests.
 */
export default tseslint.config(
  // "Never suppress, only fix": an `eslint-disable` comment cannot silence
  // anything, and the dead directive is itself reported (`--max-warnings 0`).
  { linterOptions: { noInlineConfig: true } },
  { ignores: ["dist/**", "showcase/dist/**", "node_modules/**", "scripts/**"] },
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
