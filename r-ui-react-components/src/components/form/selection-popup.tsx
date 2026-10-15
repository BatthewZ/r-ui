"use client";
import { Check, CircleAlert } from "lucide-react";
import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useDismiss, useFloating, useInteractions } from "../../hooks/use-floating";
import { useVirtualRows } from "../../hooks/use-virtual-rows";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";
import { useRowHeight } from "../../hooks/use-row-height";
import { topLayerExit, useExitPresence } from "../overlays/internal";
import { Spinner } from "../primitives";

import { defaultFilter, findMatch, MatchText } from "../../util/text-match";

/** One choice in a Combobox, MultiSelect or TagInput suggestion list. */
export interface ComboboxOption {
  /** Reported and submitted. Unique within the list. */
  value: string;
  /** Shown, matched against the typed text and, in a Combobox, put in the field when chosen. */
  label: string;
  /** A muted second line (inline, truncated, once the list is virtualized). */
  description?: string;
  /** Decorative leading icon, sized to `--ICON`. */
  icon?: ReactNode;
  disabled?: boolean;
  /** Options sharing a group render under its heading, groups in order of first appearance. */
  group?: string;
}

/** Whether an option stays in the list for the typed text. `query` is never empty. */
export type ComboboxFilter = (option: ComboboxOption, query: string) => boolean;

/** A row the keyboard can reach: an option, or an action row ("Use “abc”", "Select all"). */
export type SelectionItem =
  | { kind: "option"; key: string; option: ComboboxOption; disabled: boolean }
  | { kind: "action"; key: string; label: ReactNode; icon?: ReactNode; disabled: boolean };

/** What the listbox draws, in order: group headings and items (by index into `items`). */
export type SelectionRow = { kind: "header"; key: string; label: string } | { kind: "item"; index: number };

export interface SelectionList {
  items: SelectionItem[];
  rows: SelectionRow[];
}

/**
 * Filters and groups `options` into the navigable `items` and the drawn `rows`.
 * `top` rows (action rows) come first; ungrouped options next; then each group
 * under its heading. Keyboard order is drawn order.
 */
export function buildSelectionList(
  options: readonly ComboboxOption[],
  {
    query,
    filter,
    top = [],
    isDisabled,
  }: {
    query: string;
    /** `false`: the caller filters (async results). */
    filter?: ComboboxFilter | false;
    top?: SelectionItem[];
    /** Extra disabling on top of `option.disabled` (a MultiSelect at its maximum). */
    isDisabled?: (option: ComboboxOption) => boolean;
  },
): SelectionList {
  const trimmed = query.trim();
  const match = filter === false || trimmed === "" ? null : (filter ?? defaultFilter);
  const ungrouped: ComboboxOption[] = [];
  const groups = new Map<string, ComboboxOption[]>();
  for (const option of options) {
    if (match && !match(option, trimmed)) continue;
    if (option.group === undefined) ungrouped.push(option);
    else {
      const list = groups.get(option.group);
      if (list) list.push(option);
      else groups.set(option.group, [option]);
    }
  }
  const items: SelectionItem[] = [...top];
  const rows: SelectionRow[] = top.map((_, index) => ({ kind: "item", index }));
  const push = (option: ComboboxOption) => {
    rows.push({ kind: "item", index: items.length });
    items.push({
      kind: "option",
      key: `o:${option.value}`,
      option,
      disabled: option.disabled === true || isDisabled?.(option) === true,
    });
  };
  ungrouped.forEach(push);
  for (const [label, list] of groups) {
    rows.push({ kind: "header", key: `g:${label}`, label });
    list.forEach(push);
  }
  return { items, rows };
}

/** Where the highlight came from. Only the keyboard (and auto-highlighting while typing) draws the ring and scrolls. */
export type ActiveSource = "keyboard" | "pointer" | "auto";

const FIRST = "\u0000first";

export interface UseSelectionPopupOptions {
  items: SelectionItem[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Open state, the floating panel and the `aria-activedescendant` cursor shared by
 * Combobox, MultiSelect and TagInput. DOM focus never leaves the text input; the
 * active option is a key (so it survives re-filtering) resolved to an index each
 * render.
 */
export function useSelectionPopup({ items, open: openProp, defaultOpen = false, onOpenChange }: UseSelectionPopupOptions) {
  const [open, setOpenState] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const panelRef = useRef<HTMLDivElement>(null);
  const present = useExitPresence(open, panelRef, topLayerExit);
  const [active, setActiveState] = useState<{ key: string | null; source: ActiveSource }>({ key: null, source: "auto" });

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (!next) setActiveState({ key: null, source: "auto" });
    },
    [setOpenState],
  );
  // Positioned and promoted for as long as it is on screen, exit included.
  const floating = useFloating({ placement: "bottom-start", offsetPx: 4, open: present, onOpenChange: setOpen });
  // Pointer light dismiss only; every key is handled on the input.
  const { getFloatingProps } = useInteractions([useDismiss(floating.context, { escapeKey: false })]);
  const listboxId = useId();

  const enabled = items.flatMap((item, index) => (item.disabled ? [] : [index]));
  const activeIndex =
    active.key === FIRST ? (enabled[0] ?? -1) : active.key === null ? -1 : items.findIndex((item) => item.key === active.key);

  const setActive = useCallback(
    (index: number, source: ActiveSource) => setActiveState({ key: items[index]?.key ?? null, source }),
    [items],
  );
  /** Highlight the first enabled item whatever the list becomes (typing re-filters it). */
  const activateFirst = useCallback(() => setActiveState({ key: FIRST, source: "auto" }), []);
  const clearActive = useCallback(() => setActiveState({ key: null, source: "auto" }), []);

  const move = (to: "next" | "prev" | "first" | "last") => {
    if (enabled.length === 0) return;
    const at = enabled.indexOf(activeIndex);
    const pick =
      to === "first"
        ? 0
        : to === "last"
          ? enabled.length - 1
          : at < 0
            ? to === "next"
              ? 0
              : enabled.length - 1
            : (at + (to === "next" ? 1 : -1) + enabled.length) % enabled.length;
    setActive(enabled[pick] ?? -1, "keyboard");
  };

  /** Open with the cursor on `index` (or the first / last enabled item). */
  const openAt = (target: number | "first" | "last" | "none") => {
    setOpenState(true);
    const index =
      target === "none" ? undefined : target === "first" ? enabled[0] : target === "last" ? enabled[enabled.length - 1] : target;
    if (index === undefined || index < 0) setActiveState({ key: null, source: "auto" });
    else setActive(index, "keyboard");
  };

  /**
   * Arrows, Home and End. Returns whether the key was used. `selectedIndex` is
   * where ArrowDown opens (the current choice); `canOpen` false keeps it shut.
   */
  const navigate = (event: KeyboardEvent<HTMLInputElement>, { selectedIndex = -1, canOpen = true } = {}): boolean => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          if (canOpen) openAt(event.altKey ? "none" : selectedIndex >= 0 ? selectedIndex : "first");
        } else move("next");
        return true;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          if (canOpen) openAt(selectedIndex >= 0 ? selectedIndex : "last");
        } else move("prev");
        return true;
      case "Home":
      case "End":
        // Only while the cursor is in the list; otherwise they move the caret.
        if (!open || activeIndex < 0) return false;
        event.preventDefault();
        move(event.key === "Home" ? "first" : "last");
        return true;
      default:
        return false;
    }
  };

  // From the item's key, never its index: an option keeps its id while the list
  // re-filters around it. Escaped to an IDREF (no whitespace), injectively.
  const optionId = (index: number) => {
    const key = items[index]?.key;
    return key === undefined ? undefined : `${listboxId}-${idSafe(key)}`;
  };
  // The listbox renders nothing while closed: an IDREF must not dangle.
  const controls = present ? listboxId : undefined;

  return {
    open,
    setOpen,
    present,
    panelRef,
    floating,
    getFloatingProps,
    listboxId,
    controls,
    activeIndex,
    activeSource: active.source,
    setActive,
    activateFirst,
    clearActive,
    navigate,
    optionId,
    /** The text input's combobox wiring, to spread before the caller's props. */
    comboboxProps: {
      role: "combobox",
      autoComplete: "off",
      "aria-autocomplete": "list",
      "aria-expanded": open,
      "aria-controls": controls,
      "aria-activedescendant": open && activeIndex >= 0 ? optionId(activeIndex) : undefined,
    } as const,
  };
}

export type SelectionPopup = ReturnType<typeof useSelectionPopup>;

/** `key` as an id fragment: every character outside `[A-Za-z0-9-]` (`_` included) becomes `_<hex>_`. */
const idSafe = (key: string) => key.replace(/[^A-Za-z0-9-]/gu, (c) => `_${c.codePointAt(0)!.toString(16)}_`);

interface ResultsLabels {
  loading: string;
  empty: string;
  results: (count: number) => string;
}

/** What a live region says while the user types: loading, the load error, or how many options are listed. */
export function resultsStatus(
  list: SelectionList,
  { loading, loadError, labels }: { loading: boolean; loadError: string | undefined; labels: ResultsLabels },
): string {
  if (loading) return labels.loading;
  if (loadError !== undefined) return loadError;
  const count = list.items.filter((item) => item.kind === "option").length;
  return count === 0 ? labels.empty : labels.results(count);
}

/** The typed text's first match in `text`, in bold. Case- and diacritic-insensitive. */
function Highlight({ text, query }: { text: string; query: string }) {
  const match = findMatch(text, query);
  return <MatchText text={text} ranges={match ? [match] : []} />;
}

export interface SelectionListboxProps {
  popup: SelectionPopup;
  list: SelectionList;
  /** `aria-multiselectable`, and a check box per option instead of a trailing check. */
  multiple?: boolean;
  isSelected: (item: SelectionItem) => boolean;
  /** Highlighted in each label. */
  query: string;
  onCommit: (index: number) => void;
  /** Names the listbox: the Field label's id, else `label`. */
  labelledBy?: string;
  label?: string;
  loading?: boolean;
  loadingMessage: string;
  error?: string;
  /** Shown when nothing matches and nothing is loading. `null`: show no panel row. */
  emptyMessage: string | null;
  /** A note above the list (a MultiSelect at its maximum). */
  notice?: string;
  /** More items than this are windowed (fixed `--ROW-H` rows). */
  virtualizeThreshold: number;
  className?: string;
  optionClassName?: string;
}

/**
 * The popup: a `role="listbox"` the input points at with `aria-controls` and
 * `aria-activedescendant`, plus loading / error / empty rows beside it. Rendered
 * in place (inherits density and direction) and promoted to the top layer by
 * `useFloating`, so a clipping compact card neither clips it nor makes it
 * comfortable; fades out with the overlays' exit.
 */
export function SelectionListbox({
  popup,
  list,
  multiple = false,
  isSelected,
  query,
  onCommit,
  labelledBy,
  label,
  loading = false,
  loadingMessage,
  error,
  emptyMessage,
  notice,
  virtualizeThreshold,
  className,
  optionClassName,
}: SelectionListboxProps) {
  const { open, present, panelRef, floating, getFloatingProps, listboxId, activeIndex, activeSource, optionId } = popup;
  const { items, rows } = list;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = items.length > virtualizeThreshold;
  const rowHeight = useRowHeight(scrollRef, 40, virtual && present);
  const windowed = useVirtualRows({
    rowCount: virtual ? rows.length : 0,
    rowHeight,
    scrollRef,
    initialViewport: rowHeight * 8,
    overscan: 6,
  });

  const rowOfItem = rowIndexOf(rows);
  const setFloating = floating.refs.setFloating;
  const setPanelRef = useMemo(() => mergeRefs(panelRef, setFloating), [panelRef, setFloating]);
  const anchorWidth = useAnchorWidth(floating.refs.reference, present);

  // Keep the keyboard's option in view. Never for the pointer: the list would
  // scroll under it.
  const activeRow = activeIndex >= 0 ? (rowOfItem.get(activeIndex) ?? -1) : -1;
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!open || activeRow < 0 || activeSource === "pointer" || !scroller) return;
    // The first option of a group brings its heading with it.
    const firstRow = rows[activeRow - 1]?.kind === "header" ? activeRow - 1 : activeRow;
    let top: number;
    let bottom: number;
    if (virtual) {
      top = firstRow * rowHeight;
      bottom = (activeRow + 1) * rowHeight;
    } else {
      const el = scroller.querySelector<HTMLElement>(`[data-row="${firstRow}"]`);
      const end = scroller.querySelector<HTMLElement>(`[data-row="${activeRow}"]`);
      if (!el || !end) return;
      const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
      top = el.getBoundingClientRect().top - origin;
      bottom = end.getBoundingClientRect().bottom - origin;
    }
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
    // Only when the cursor moves: a re-render from scrolling must not pull the list back.
  }, [open, activeRow, activeSource, virtual]);

  if (!present) return null;

  const renderItem = (index: number, rowIndex: number, style?: CSSProperties) => {
    const item = items[index];
    if (!item) return null;
    const selected = isSelected(item);
    const isActive = index === activeIndex;
    const option = item.kind === "option" ? item.option : null;
    return (
      <div
        key={item.key}
        id={optionId(index)}
        role="option"
        aria-selected={selected}
        aria-disabled={item.disabled || undefined}
        aria-setsize={virtual ? items.length : undefined}
        aria-posinset={virtual ? index + 1 : undefined}
        data-row={rowIndex}
        data-active={isActive ? (activeSource === "pointer" ? "pointer" : "keyboard") : undefined}
        style={style}
        onPointerMove={() => {
          if (!item.disabled && !isActive) popup.setActive(index, "pointer");
        }}
        onClick={() => {
          if (!item.disabled) onCommit(index);
        }}
        className={cn(
          "r-form-option flex w-full cursor-default select-none items-center gap-r4 rounded-sm px-r4 text-start",
          virtual ? "h-row" : "min-h-row py-r6",
          // Under forced colors a wash is dropped: the cursor and the choices are Highlight fills.
          "data-[active]:bg-fg-primary/8 forced-colors:data-[active]:bg-selection forced-colors:aria-selected:bg-selection aria-disabled:opacity-disabled",
          optionClassName,
        )}
      >
        {multiple && (
          <span aria-hidden className="r-form-option-box">
            {selected && <Check className="r-form-option-mark" />}
          </span>
        )}
        {(option?.icon ?? (item.kind === "action" && item.icon)) && (
          <span aria-hidden className="flex shrink-0 text-fg-secondary [&>svg]:size-icon">
            {option?.icon ?? (item.kind === "action" ? item.icon : null)}
          </span>
        )}
        <span className={cn("flex min-w-0 flex-1", virtual ? "items-baseline gap-r4" : "flex-col")}>
          <span className="min-w-0 truncate">
            {option ? <Highlight text={option.label} query={query} /> : item.kind === "action" ? item.label : null}
          </span>
          {option?.description && (
            <span className={cn("min-w-0 truncate text-body-3 text-fg-muted", virtual && "flex-1")}>{option.description}</span>
          )}
        </span>
        {!multiple && selected && <Check aria-hidden className="r-form-option-check size-icon shrink-0 text-fg-accent" />}
      </div>
    );
  };

  const header = (row: Extract<SelectionRow, { kind: "header" }>, rowIndex: number, id?: string, style?: CSSProperties) => (
    <div
      key={row.key}
      id={id}
      role="presentation"
      data-row={rowIndex}
      style={style}
      className={cn(
        "flex items-end truncate px-r4 pb-r6 text-body-3 font-medium text-fg-muted",
        virtual ? "h-row" : "pt-r4",
      )}
    >
      {row.label}
    </div>
  );

  let body: ReactNode;
  if (virtual) {
    // Fixed --ROW-H rows positioned absolutely, so the active option can be
    // mounted even outside the window (its id must resolve for
    // aria-activedescendant) without disturbing the others.
    const mounted = new Set<number>();
    for (let i = windowed.startIndex; i < windowed.endIndex; i++) mounted.add(i);
    if (activeRow >= 0) mounted.add(activeRow);
    body = (
      <div className="relative" style={{ blockSize: windowed.totalHeight }}>
        {[...mounted].map((rowIndex) => {
          const row = rows[rowIndex];
          const style: CSSProperties = { position: "absolute", insetInline: 0, top: rowIndex * rowHeight };
          if (!row) return null;
          return row.kind === "header" ? header(row, rowIndex, undefined, style) : renderItem(row.index, rowIndex, style);
        })}
      </div>
    );
  } else {
    // Each heading names a `role="group"` around its options.
    const out: ReactNode[] = [];
    let i = 0;
    while (i < rows.length) {
      const row = rows[i]!;
      if (row.kind === "item") {
        out.push(renderItem(row.index, i));
        i++;
        continue;
      }
      const headerId = `${listboxId}-g${i}`;
      const members: ReactNode[] = [];
      const start = i;
      i++;
      for (let member = rows[i]; member?.kind === "item"; member = rows[i]) {
        members.push(renderItem(member.index, i));
        i++;
      }
      out.push(
        <div key={row.key} role="group" aria-labelledby={headerId}>
          {header(row, start, headerId)}
          {members}
        </div>,
      );
    }
    body = out;
  }

  const empty = !loading && !error && items.length === 0 && emptyMessage !== null;
  const message = "flex min-h-row items-center gap-r4 px-r4 py-r6 text-body-2";

  return (
    <div
      {...getFloatingProps({
        // Options are not focusable: a press must not take focus from the input.
        onMouseDown: (event) => event.preventDefault(),
      })}
      ref={setPanelRef}
      // Leaving: on screen for its exit, but no longer interactive.
      inert={!open}
      style={{ ...floating.floatingStyles, minInlineSize: anchorWidth }}
      className={cn(
        "r-overlays-surface flex flex-col overflow-hidden rounded-md border border-border bg-surface-0 text-body-1 text-fg-primary shadow-md",
        className,
      )}
    >
      {notice && <div className={cn(message, "border-b border-border text-fg-secondary")}>{notice}</div>}
      {loading && (
        <div className={cn(message, "text-fg-secondary")}>
          <Spinner />
          {loadingMessage}
        </div>
      )}
      {error && (
        <div className={cn(message, "items-start text-fg-error")}>
          <span className="flex h-(--BodyText-2-line-height) shrink-0 items-center">
            <CircleAlert aria-hidden className="size-icon text-status-error" />
          </span>
          <span className="min-w-0">{error}</span>
        </div>
      )}
      <div
        ref={scrollRef}
        id={listboxId}
        role="listbox"
        aria-multiselectable={multiple || undefined}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        aria-busy={loading || undefined}
        className="relative max-h-[calc(var(--ROW-H)*8+var(--R-SIZE-6)*2)] overflow-y-auto overscroll-contain p-r6 empty:p-0"
      >
        {body}
      </div>
      {empty && <div className={cn(message, "text-fg-muted")}>{emptyMessage}</div>}
    </div>
  );
}

/** Row index of every item, for scrolling to it and mounting it outside the window. */
function rowIndexOf(rows: SelectionRow[]): Map<number, number> {
  const map = new Map<number, number>();
  rows.forEach((row, rowIndex) => {
    if (row.kind === "item") map.set(row.index, rowIndex);
  });
  return map;
}

/** The anchor's width while the panel is up, so the list is never narrower than the field. */
function useAnchorWidth(reference: RefObject<Element | null> | { current: unknown }, present: boolean): number | undefined {
  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const el = reference.current;
    if (!present || !(el instanceof Element)) return;
    const measure = () => setWidth(el.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [reference, present]);
  return width;
}
