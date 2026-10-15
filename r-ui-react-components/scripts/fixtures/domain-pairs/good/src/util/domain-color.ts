// The canonical blend, built in a template, reads both halves through the scheme.
export const blend = (name: string) =>
  `color-mix(in oklch, var(--C-${name}-LIGHT), var(--C-${name}-DARK) calc(var(--SCHEME-DARK) * 100%))`;
