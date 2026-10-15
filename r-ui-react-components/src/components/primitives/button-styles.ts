/**
 * Shared by Button and IconButton so a toolbar of both reads as one family.
 *
 * Disabled (`disabled` or `aria-disabled`) takes `pointer-events: none`, so no
 * hover or press paints on it; keyboard activation of an `aria-disabled` button
 * is blocked in the component. The fade is `.r-primitives-button` in styles.css, which
 * skips a busy (loading) button: loading is not unavailable-looking.
 */
export const BUTTON_BASE =
  "r-primitives-button relative inline-flex shrink-0 cursor-pointer select-none items-center justify-center whitespace-nowrap transition-colors disabled:pointer-events-none aria-disabled:pointer-events-none";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * - primary: the theme's main-action fill (ink in the default, a hue in some
 *   themes) with its on-pair text, using the theme's own hover/active steps.
 * - secondary: raised sheet + hairline. A surface step alone is a weak hover
 *   cue, so hover also firms the border.
 * - ghost: no chrome at rest. Hover is the primary INK at low alpha rather than
 *   a surface rung, so it reads on any host (a tinted alert, a dark card), and
 *   the ink itself steps from secondary to primary.
 * - danger: the error mark as a fill with its on-pair. The contract has no
 *   error hover step, so hover mixes the fill toward the primary ink (in oklab:
 *   oklch would drag the red's hue toward the ink's near-neutral hue), which is
 *   always AWAY from the on-error text (dark ink on a light theme's mid-tone red,
 *   light ink on a dark theme's lighter red): contrast only grows.
 */
export const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-fg-on-primary hover:bg-primary-hover active:bg-primary-active",
  secondary:
    "border border-border bg-surface-0 text-fg-primary hover:border-border-strong hover:bg-surface-1 active:bg-surface-2",
  ghost: "text-fg-secondary hover:bg-fg-primary/8 hover:text-fg-primary active:bg-fg-primary/12",
  danger:
    "bg-status-error text-fg-on-error hover:bg-[color-mix(in_oklab,var(--C-STATUS-ERROR),var(--C-TEXT-PRIMARY)_14%)] active:bg-[color-mix(in_oklab,var(--C-STATUS-ERROR),var(--C-TEXT-PRIMARY)_24%)]",
};
