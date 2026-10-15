/**
 * className helpers for this package.
 *
 * The universal token list (the contract's spacing, colour roles, text scale)
 * lives in `@batthewz/r-ui-tw-merge` so it can be used without React. This
 * package owns its DOMAIN utilities (series, sequential, trend, domain status,
 * chart chrome, chart/bar/heat-cell sizes, the KPI text size), declared in
 * `../tokens.css`, so `cn` is built with `createCn` to teach tailwind-merge
 * that `bg-series-1 bg-series-2` conflict and `h-chart h-control` conflict.
 *
 * The list below is a hand mirror of the `@theme` names in `../tokens.css`;
 * `scripts/verify-token-mirror.mjs` asserts both directions. Keep it ONE
 * `createCn` call with literal arrays, or that gate cannot read it.
 *
 * `cn(className)` with no base class is not a no-op: the merge collapses the
 * caller's own conflicting utilities last-wins (`"p-r3 p-r5"` -> `"p-r5"`).
 */
import { createCn } from "@batthewz/r-ui-tw-merge";

export const cn = createCn({
  theme: {
    color: [
      "series-1",
      "series-2",
      "series-3",
      "series-4",
      "series-5",
      "series-6",
      "series-7",
      "series-8",
      "seq-1",
      "seq-2",
      "seq-3",
      "seq-4",
      "seq-5",
      "seq-6",
      "seq-7",
      "trend-good",
      "trend-bad",
      "trend-flat",
      "status-serious",
      "fg-serious",
      "status-serious-bg",
      "fg-on-serious",
      "status-stale",
      "fg-stale",
      "status-stale-bg",
      "fg-on-stale",
      "chart-grid",
      "chart-axis",
      "code-keyword",
      "code-string",
      "code-number",
      "code-function",
      "code-type",
      "code-comment",
      "code-property",
      "code-addition",
      "code-deletion",
    ],
    spacing: ["chart", "bar", "heat-cell", "spark"],
    text: ["kpi"],
  },
});

export {
  createCn,
  mergeExtension,
  tailwindMergeExtension,
  twMerge,
} from "@batthewz/r-ui-tw-merge";

/**
 * Per-slot class overrides for the internals a component renders.
 *
 * `S` is the component's OWN slot union, written inline at the prop
 * (`classNames?: SlotClassNames<"label" | "icon">`), never a shared list: that
 * is what makes an unknown key a type error and a known one autocomplete.
 *
 * There is no `root` key: `className` is the root. Two writers for one element
 * is a bug. Values are class strings only; where a caller needs handlers or
 * `aria-*` on an internal, that is a `<thing>Props` prop.
 */
export type SlotClassNames<S extends string> = Partial<Record<S, string>>;
