"use client";
import { createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Every component's labels, by key. The key is the `X` of the component's
 * `XLabels` / `DEFAULT_X_LABELS` (`Dialog`, `Chart`, `PreferencesMenu`), so
 * components that share one set of words share one key. Each component adds
 * its own entry where its labels are declared, so this file never lists them:
 *
 * ```ts
 * declare module "../../util/locale" {
 *   interface LabelsRegistry { Dialog: DialogLabels }
 * }
 * ```
 */
export interface LabelsRegistry {}

/**
 * A component's `labels` prop: any subset of its labels. A label that is a map
 * (the tone words) may itself be given in part.
 */
export type LabelsProp<L> = {
  [K in keyof L]?: L[K] extends (...args: never[]) => unknown ? L[K] : L[K] extends object ? Partial<L[K]> : L[K];
};

/** A `LocaleProvider`'s `labels`: per key, any subset of that component's labels. */
export type LocaleLabels = { [K in keyof LabelsRegistry]?: LabelsProp<LabelsRegistry[K]> };

const isMap = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** `base` with `given` over it; maps merge key by key, `undefined` keeps the base. */
export function mergeLabels<L extends object>(base: L, given: LabelsProp<L> | undefined): L {
  if (!given) return base;
  const out = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(given)) {
    if (value === undefined) continue;
    const under = out[key];
    out[key] = isMap(under) && isMap(value) ? { ...under, ...value } : value;
  }
  return out as L;
}

interface LocaleState {
  /** BCP 47; `undefined` is the runtime's default. */
  locale: string | undefined;
  labels: LocaleLabels;
}

const LocaleContext = createContext<LocaleState>({ locale: undefined, labels: {} });

export interface LocaleProviderProps {
  /** BCP 47 locale for every number, date and collation beneath. Omitted: the enclosing provider's, else the runtime's. */
  locale?: string;
  /**
   * Translations, keyed by component (`{ Dialog: { close: "Schließen" } }`).
   * Merged over the enclosing provider's, key by key. Keep the object stable
   * (module scope or `useMemo`): a new one re-renders every labelled component.
   */
  labels?: LocaleLabels;
  /**
   * Writing direction for the subtree. Given, the provider renders a
   * `display: contents` wrapper carrying `dir` (and `lang` when `locale` is
   * set); omitted, it renders no element. The page's own direction belongs on
   * `<html dir>`.
   */
  dir?: "ltr" | "rtl";
  children?: ReactNode;
}

/**
 * Sets the locale and the translations once for everything beneath it.
 * Nestable: an inner provider's `locale` wins, and its `labels` merge over the
 * outer one's. A component's own `locale` and `labels` props still win over
 * both: defaults < providers (outer to inner) < the instance's props.
 */
export function LocaleProvider({ locale, labels, dir, children }: LocaleProviderProps) {
  const outer = useContext(LocaleContext);
  const value = useMemo<LocaleState>(
    () => ({ locale: locale ?? outer.locale, labels: labels ? mergeLocaleLabels(outer.labels, labels) : outer.labels }),
    [outer, locale, labels],
  );
  return (
    <LocaleContext value={value}>
      {dir ? (
        <div dir={dir} lang={locale} className="contents">
          {children}
        </div>
      ) : (
        children
      )}
    </LocaleContext>
  );
}

function mergeLocaleLabels(outer: LocaleLabels, inner: LocaleLabels): LocaleLabels {
  const out: Record<string, object | undefined> = { ...outer };
  for (const [key, given] of Object.entries(inner) as [string, object | undefined][]) {
    const base = out[key];
    out[key] = base && given ? mergeLabels(base, given) : (given ?? base);
  }
  return out as LocaleLabels;
}

/**
 * The locale to format with: `locale` (a component's own prop) if given, else
 * the nearest `LocaleProvider`'s, else `undefined` (Intl's runtime default).
 */
export function useLocale(locale?: string): string | undefined {
  const fromProvider = useContext(LocaleContext).locale;
  return locale ?? fromProvider;
}

/**
 * A component's labels: `defaults`, then every enclosing provider's
 * `labels[key]`, then the instance's `given` (its `labels` prop). A map-valued
 * label merges key by key; `undefined` keeps what is under it.
 */
export function useLabels<K extends keyof LabelsRegistry>(
  key: K,
  defaults: LabelsRegistry[K],
  given?: LabelsProp<LabelsRegistry[K]>,
): LabelsRegistry[K] {
  const fromProvider = useContext(LocaleContext).labels[key];
  return useMemo(() => {
    const merge = mergeLabels as (base: object, over: object | undefined) => object;
    return merge(merge(defaults as object, fromProvider as object | undefined), given as object | undefined);
  }, [defaults, fromProvider, given]) as LabelsRegistry[K];
}
