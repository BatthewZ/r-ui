"use client";
import { ListFilter } from "lucide-react";
import { type ComponentPropsWithRef, useLayoutEffect, useRef } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useDebounce } from "../../hooks/use-debounce";
import { formatNumber } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { Drawer } from "../overlays";
import { Button, Chip, Spinner } from "../primitives";

import { FilterField } from "./filter-controls";
import {
  appliedFilters,
  clearFilterValues,
  type FilterChipLabels,
  type FilterDefinition,
  type FilterValues,
  filterChipText,
  normalizeFilterValue,
  setFilterValue,
} from "./filter-model";

/** Every string the bar writes itself, for localisation. */
export interface FilterBarLabels extends FilterChipLabels {
  /** The bar's name (a `search` landmark) and the drawer's title. */
  filters: string;
  /** The narrow bar's button that opens the drawer, with the number of applied filters. */
  trigger: (count: number) => string;
  /** Names the list of chips. */
  applied: string;
  /** A chip's remove button, from the chip's text. */
  remove: (chip: string) => string;
  clearAll: string;
  /** The result count, shown and announced when it settles. */
  results: (count: number) => string;
  /** Shown in place of the count while `loading`. */
  loading: string;
  /** A select's "no filter" choice and a list's empty placeholder. */
  any: string;
  /** Closes the drawer. */
  done: string;
}

export const DEFAULT_FILTER_BAR_LABELS: FilterBarLabels = {
  filters: "Filters",
  trigger: (count) => (count > 0 ? `Filters (${count})` : "Filters"),
  applied: "Applied filters",
  remove: (chip) => `Remove filter ${chip}`,
  clearAll: "Clear all",
  results: (count) => (count === 1 ? "1 result" : `${formatNumber(count)} results`),
  loading: "Updating results…",
  any: "Any",
  done: "Done",
  value: (label, summary) => `${label}: ${summary}`,
  search: (label, text) => `${label}: “${text}”`,
  atMost: (label, value) => `${label} ≤ ${value}`,
  atLeast: (label, value) => `${label} ≥ ${value}`,
  between: (label, range) => `${label} ${range}`,
  list: (items) => items.join(", "),
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    FilterBar: FilterBarLabels;
  }
}

/** The count is spoken once it has held this long, so typing a search is not read out per key. */
export const RESULT_ANNOUNCE_DELAY_MS = 500;

/** `auto`: inline controls in a wide container, the "Filters (n)" button and drawer in a narrow one. */
export type FilterBarCollapse = "auto" | "always" | "never";

export interface FilterBarProps extends Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange" | "children"> {
  /** The filters, in the order the controls and chips show them. */
  filters: readonly FilterDefinition[];
  /** The applied filters, by id (controlled). The same shape as DataTable's `filters`. */
  value?: FilterValues;
  defaultValue?: FilterValues;
  /** Every change: a control, a chip's removal, Clear all. A filter that applies nothing has no key. */
  onValueChange?: (value: FilterValues) => void;
  /** How many results the filters leave. Omitted: no count. */
  resultCount?: number;
  /** The results are being fetched again: the count shows `labels.loading` (and is `aria-busy`, so nothing is announced meanwhile). */
  loading?: boolean;
  /**
   * `auto` (default) lays the controls inline while the bar's own width
   * (a container query, never the viewport) reaches the container `2xl` step,
   * and below it folds them into a "Filters (n)" button that opens a drawer
   * holding the same controls. `always` is the button at any width, `never`
   * the inline controls at any width.
   */
  collapse?: FilterBarCollapse;
  /** The drawer (controlled). */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The drawer's edge. @default "end" */
  drawerSide?: "end" | "bottom";
  disabled?: boolean;
  /** For chip numbers and dates, the sliders and the pickers. Omitted: the `LocaleProvider`'s, else the runtime's. */
  locale?: string;
  labels?: LabelsProp<FilterBarLabels>;
  classNames?: SlotClassNames<"controls" | "field" | "trigger" | "drawer" | "summary" | "chip" | "clear" | "results">;
}

const TABBABLE =
  'button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Whether `el` has a box: a container query's `display: none` on an ancestor takes it out. */
function isRendered(el: Element): boolean {
  if (typeof el.checkVisibility === "function") return el.checkVisibility();
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (getComputedStyle(node).display === "none") return false;
  }
  return true;
}

/** The first control a keyboard reaches in `root`, among those drawn. */
function firstTabbable(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  for (const el of root.querySelectorAll<HTMLElement>(TABBABLE)) {
    if (el.tabIndex < 0 || el.closest("[inert]") || !isRendered(el)) continue;
    return el;
  }
  return null;
}

/** Where focus goes once the chips have re-rendered. */
type FocusRequest = { to: "chip"; index: number } | { to: "start"; scope: "bar" | "drawer" };

/**
 * A dashboard's filters in one place: the existing controls (MultiSelect,
 * Combobox, Select, TagInput, RangeSlider, DateRangePicker with times,
 * ToggleGroup, SearchInput, or the caller's own) composed from a typed list of
 * filter definitions, plus a summary of what is applied.
 *
 * - **Value**: one object of applied values by filter id, controlled
 *   (`value`/`onValueChange`) or not. It is shaped like DataTable's `filters`,
 *   so the two can share it where the ids are column ids and the value shapes
 *   match the columns' filters. The bar never filters rows itself.
 * - **Chips**: each applied filter as a chip ("Region: eu-west, us-east",
 *   "Last 7 days", "p95 ≥ 300 ms"), in a named list, each with a named remove
 *   button (Backspace or Delete on it removes too), then Clear all. After a
 *   removal focus goes to the chip that took its place, else the one before;
 *   when none is left, and after Clear all, to the bar's first control (the
 *   Filters button when folded).
 * - **Results**: `resultCount` shows at the row's end and is announced
 *   politely once it has settled (`RESULT_ANNOUNCE_DELAY_MS`).
 * - **Layout**: the bar's own width decides (see `collapse`). The drawer holds
 *   the same controls on the same value, its own count and Clear all.
 * - **Print**: the controls and buttons hide; the chips print as the record of
 *   what the page was filtered by.
 *
 * `className` styles the root, a `role="search"` landmark named
 * `labels.filters` (an `aria-label` names it instead). It is a size container
 * (`@container`): give it a width (a block, a grid track), not a bare flex row.
 */
export function FilterBar({
  filters,
  value: valueProp,
  defaultValue = {},
  onValueChange,
  resultCount,
  loading = false,
  collapse = "auto",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  drawerSide = "end",
  disabled = false,
  locale: localeProp,
  labels: labelsProp,
  className,
  classNames,
  ...props
}: FilterBarProps) {
  const labels = useLabels("FilterBar", DEFAULT_FILTER_BAR_LABELS, labelsProp);
  const locale = useLocale(localeProp);
  const [values, setValues] = useControllableState<FilterValues>({ value: valueProp, defaultValue, onChange: onValueChange });
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });

  const controlsRef = useRef<HTMLDivElement>(null);
  const drawerFieldsRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLUListElement>(null);
  const focusRequest = useRef<FocusRequest | null>(null);

  const applied = appliedFilters(filters, values);
  const chips = applied.map((def) => ({ def, text: filterChipText(def, normalizeFilterValue(def, values[def.id]), labels, locale) }));
  const removable = (def: FilterDefinition) => !disabled && def.disabled !== true;
  const chipKey = applied.map((def) => def.id).join("\n");

  // After the chips change: the focus a removal or Clear all asked for.
  useLayoutEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    if (request.to === "chip") {
      // The chip that took the removed one's place, else the nearest one before it that can be removed.
      const buttons = [...(chipsRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const from = Math.min(request.index, buttons.length - 1);
      const target = [...buttons.slice(from), ...buttons.slice(0, from).reverse()].find((b) => !b.disabled);
      if (target) return target.focus();
    }
    const scope = request.to === "start" && request.scope === "drawer" ? drawerFieldsRef.current : controlsRef.current;
    firstTabbable(scope)?.focus();
  }, [chipKey]);

  const change = (def: FilterDefinition, next: unknown) => setValues((prev) => setFilterValue(prev, def, next));

  const remove = (def: FilterDefinition, index: number) => {
    focusRequest.current = { to: "chip", index };
    change(def, undefined);
  };

  const clearAll = (scope: "bar" | "drawer") => {
    focusRequest.current = { to: "start", scope };
    setValues((prev) => clearFilterValues(prev, filters.filter(removable)));
  };

  const fields = (inDrawer: boolean) =>
    filters.map((def) => (
      <FilterField
        key={def.id}
        def={def}
        value={values[def.id]}
        onValueChange={(next) => change(def, next)}
        disabled={disabled}
        anyLabel={labels.any}
        locale={locale}
        className={cn(!inDrawer && collapse === "auto" && "@max-2xl:hidden", classNames?.field)}
      />
    ));

  const anyRemovable = applied.some(removable);

  return (
    <div
      role="search"
      aria-label={labels.filters}
      {...props}
      data-collapse={collapse}
      className={cn("@container grid min-w-0 gap-r4", className)}
    >
      <div ref={controlsRef} data-print="hide" className={cn("flex flex-wrap items-start gap-r3", classNames?.controls)}>
        {collapse !== "never" && (
          <Drawer open={open} onOpenChange={setOpen}>
            <Drawer.Trigger
              variant="secondary"
              iconStart={<ListFilter aria-hidden className="size-icon" />}
              disabled={disabled}
              data-filter-trigger=""
              className={cn(collapse === "auto" && "@2xl:hidden", classNames?.trigger)}
            >
              {labels.trigger(applied.length)}
            </Drawer.Trigger>
            <Drawer.Content side={drawerSide} className={classNames?.drawer}>
              <Drawer.Header>
                <Drawer.Title>{labels.filters}</Drawer.Title>
              </Drawer.Header>
              <Drawer.Body>
                <div ref={drawerFieldsRef} className="grid gap-r3">
                  {fields(true)}
                </div>
              </Drawer.Body>
              <Drawer.Footer>
                <ResultCount count={resultCount} loading={loading} labels={labels} className={cn("me-auto", classNames?.results)} />
                {anyRemovable && (
                  <Button variant="ghost" onClick={() => clearAll("drawer")} className={classNames?.clear}>
                    {labels.clearAll}
                  </Button>
                )}
                <Drawer.Close variant="primary">{labels.done}</Drawer.Close>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer>
        )}
        {collapse !== "always" && fields(false)}
      </div>
      {(chips.length > 0 || resultCount !== undefined || loading) && (
        <div data-filter-summary="" className={cn("r-filters-summary", classNames?.summary)}>
          {chips.length > 0 && (
            <ul ref={chipsRef} aria-label={labels.applied} className="contents">
              {chips.map(({ def, text }, index) => (
                <Chip
                  key={def.id}
                  as="li"
                  data-filter-chip={def.id}
                  onRemove={() => remove(def, index)}
                  disabled={!removable(def)}
                  labels={{ remove: labels.remove }}
                  className={classNames?.chip}
                >
                  {text}
                </Chip>
              ))}
            </ul>
          )}
          {anyRemovable && (
            <Button variant="ghost" data-print="hide" onClick={() => clearAll("bar")} className={classNames?.clear}>
              {labels.clearAll}
            </Button>
          )}
          <ResultCount count={resultCount} loading={loading} labels={labels} className={cn("ms-auto", classNames?.results)} />
        </div>
      )}
    </div>
  );
}

/**
 * The count, shown at once, and a polite status that speaks it once it has
 * held for `RESULT_ANNOUNCE_DELAY_MS`. The status is mounted holding the
 * first count, so only a change is read.
 */
function ResultCount({
  count,
  loading,
  labels,
  className,
}: {
  count: number | undefined;
  loading: boolean;
  labels: FilterBarLabels;
  className?: string;
}) {
  const text = count === undefined ? "" : labels.results(count);
  const settled = useDebounce(text, RESULT_ANNOUNCE_DELAY_MS);
  return (
    <span data-filter-results="" aria-busy={loading || undefined} className={cn("inline-flex min-w-0 items-center gap-r5 text-body-2 text-fg-secondary", className)}>
      {loading && <Spinner />}
      {/* The status below is the accessible copy (the same words, once settled). */}
      <span aria-hidden className="min-w-0 truncate">
        {loading ? labels.loading : text}
      </span>
      <span role="status" className="sr-only">
        {settled}
      </span>
    </span>
  );
}
