import type { ColorSwatch } from "../../../../src/components/form";

/*
 * A brand palette: the colours a person may choose in the ColorPicker demos.
 * This is DATA (values the user picks and the form submits), not styling, so it
 * lives in an `.examples.` file, which the token gates skip; nothing here is
 * painted by a class or a stylesheet.
 */
export const BRAND_PALETTE: readonly ColorSwatch[] = [
  { value: "#0f766e", label: "Harbour teal" },
  { value: "#1d4ed8", label: "Ocean blue" },
  { value: "#6d28d9", label: "Violet" },
  { value: "#be123c", label: "Rose" },
  { value: "#b45309", label: "Amber" },
  { value: "#15803d", label: "Forest" },
  { value: "oklch(0.68 0.19 45)", label: "Signal orange" },
  { value: "#475569", label: "Slate" },
  { value: "#111827", label: "Ink" },
];

/** The demos' starting values. */
export const START = {
  brand: "#0f766e",
  overlay: "oklch(0.55 0.2 265 / 0.8)",
  /** Outside sRGB on purpose: the picker keeps it inside and says so. */
  vivid: "oklch(0.75 0.3 145)",
  chart: "#b45309",
  invalid: "#be123c",
};
