/**
 * A component's `labels` prop: any subset of its labels. A label that is a map
 * (the tone words) may itself be given in part.
 */
export type LabelsProp<L> = {
  [K in keyof L]?: L[K] extends (...args: never[]) => unknown ? L[K] : L[K] extends object ? Partial<L[K]> : L[K];
};

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The defaults with the caller's labels over them; maps merge key by key, `undefined` keeps the default. */
export function mergeLabels<L extends object>(defaults: L, given: LabelsProp<L> | undefined): L {
  if (!given) return defaults;
  const out = { ...(defaults as Record<string, unknown>) };
  for (const [key, value] of Object.entries(given)) {
    if (value === undefined) continue;
    const base = out[key];
    out[key] = isMap(base) && isMap(value) ? { ...base, ...value } : value;
  }
  return out as L;
}
