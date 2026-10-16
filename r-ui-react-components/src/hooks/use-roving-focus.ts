"use client";
import { type KeyboardEvent, type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { isRtl } from "../util/direction";

type Orientation = "horizontal" | "vertical";

interface UseRovingFocusOptions {
  orientation: Orientation;
  loop?: boolean;
}

interface RovingProps {
  tabIndex: number;
  onKeyDown: (e: KeyboardEvent) => void;
  ref: (el: HTMLElement | null) => void;
}

/** What a key asks of a roving group. */
type RovingMove = "next" | "previous" | "first" | "last";

/**
 * The move a key makes: arrows follow the orientation, and a horizontal group
 * mirrors them right to left (ArrowLeft is "next"); Home and End go to the ends.
 */
function rovingMove(key: string, orientation: Orientation, rtl: boolean): RovingMove | undefined {
  const mirrored = orientation === "horizontal" && rtl;
  const nextKey = orientation === "horizontal" ? (mirrored ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
  const previousKey = orientation === "horizontal" ? (mirrored ? "ArrowRight" : "ArrowLeft") : "ArrowUp";
  if (key === nextKey) return "next";
  if (key === previousKey) return "previous";
  if (key === "Home") return "first";
  if (key === "End") return "last";
  return undefined;
}

/**
 * The position `move` lands on among `count` items from `from`, passing over
 * positions `canFocus` refuses and wrapping at an end when `loop`. `undefined`
 * when nothing qualifies (or at an end without `loop`).
 */
function landing(
  move: RovingMove,
  count: number,
  from: number,
  loop: boolean,
  canFocus: (position: number) => boolean,
): number | undefined {
  const step = (start: number, delta: 1 | -1, wrap: boolean) => {
    let position = start;
    for (let tried = 0; tried < count; tried += 1) {
      position += delta;
      if (position < 0 || position >= count) {
        if (!wrap) return undefined;
        position = (position + count) % count;
      }
      if (canFocus(position)) return position;
    }
    return undefined;
  };
  switch (move) {
    case "first":
      return step(-1, 1, false);
    case "last":
      return step(count, -1, false);
    case "next":
      return step(from === -1 ? -1 : from, 1, loop);
    case "previous":
      return step(from === -1 ? count : from, -1, loop);
  }
}

/** Natively disabled items cannot take focus, so the arrows pass over them. */
const focusable = (element: HTMLElement | undefined): element is HTMLElement =>
  element !== undefined && !element.matches(":disabled");

/**
 * A roving tab stop for a composite widget: one tab stop for the whole group,
 * arrow keys between its items.
 *
 * Two ways in, and a widget uses one or the other:
 *
 * - **`getRovingProps(i).onKeyDown`**: the built-in key model, for a widget
 *   where moving focus means nothing else (a toolbar, a menubar). It moves
 *   focus and nothing more. Arrows follow the orientation, and a horizontal
 *   group mirrors them under `dir="rtl"` (ArrowLeft is "next"). Home and End go
 *   to the ends. Natively `disabled` items are passed over, since they cannot
 *   take focus; an `aria-disabled` item stays in the walk (APG: it is
 *   discoverable, its widget refuses to activate it).
 * - **`setFocusedIndex`**: for a widget whose tab stop is *derived* from a
 *   value, as a `radiogroup`'s is (its tab stop must be the checked radio), so
 *   focus and selection are one state machine and the widget owns its keys.
 *
 * `setFocusedIndex` moves DOM focus with the tab stop **only when the group
 * already holds focus**, so it never pulls focus into the widget from
 * elsewhere, and it never leaves a `tabIndex={-1}` element focused.
 *
 * For a group whose items are whatever focusable elements a caller puts in it
 * (a toolbar), see `useRovingFocusWithin`.
 */
export function useRovingFocus(options: UseRovingFocusOptions): {
  getRovingProps: (index: number) => RovingProps;
  focusedIndex: number;
  setFocusedIndex: (index: number) => void;
} {
  const { orientation, loop = true } = options;
  const [focusedIndex, setFocusedIndexState] = useState(0);
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  const elementsRef = useRef<Map<number, HTMLElement>>(new Map());

  const setFocusedIndex = useCallback((index: number) => {
    setFocusedIndexState(index);
    const elements = elementsRef.current;
    const active = document.activeElement;
    // Only when focus is already inside the group: moving the tab stop while
    // the user is elsewhere on the page must not pull them here.
    for (const element of elements.values()) {
      if (element === active) {
        elements.get(index)?.focus();
        return;
      }
    }
  }, []);

  const getRovingProps = useCallback(
    (index: number): RovingProps => ({
      tabIndex: index === focusedIndexRef.current ? 0 : -1,
      onKeyDown: (e: KeyboardEvent) => {
        const elements = elementsRef.current;
        // Registered items in index order; an unmounted item leaves a gap, not a hole in the walk.
        const indices = [...elements.keys()].sort((a, b) => a - b);
        if (indices.length === 0) return;

        const move = rovingMove(e.key, orientation, orientation === "horizontal" && isRtl(e.currentTarget));
        if (!move) return;
        const position = landing(move, indices.length, indices.indexOf(focusedIndexRef.current), loop, (p) =>
          focusable(elements.get(indices[p]!)),
        );

        // At an end without `loop`, the key is still ours: it must not scroll the page.
        e.preventDefault();
        // Focus follows from here: the handler runs on the focused item, so the
        // "already inside the group" test above is satisfied by definition.
        if (position !== undefined) setFocusedIndex(indices[position]!);
      },
      ref: (el: HTMLElement | null) => {
        if (el) {
          elementsRef.current.set(index, el);
        } else {
          elementsRef.current.delete(index);
        }
      },
    }),
    [loop, orientation, setFocusedIndex]
  );

  return { getRovingProps, focusedIndex, setFocusedIndex };
}

/** Everything that can take focus by itself or by `tabindex`. */
const ITEM_SELECTOR =
  'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex], [contenteditable=""], [contenteditable="true"]';
/**
 * What is inside the group's element but not one of its items: a popup opened
 * from an item (a menu, a listbox, a dialog, a tooltip, any top-layer panel),
 * and anything inert or hidden (an item moved into an overflow menu).
 */
const NOT_AN_ITEM = '[inert], [hidden], [role="menu"], [role="listbox"], [role="dialog"], [role="tooltip"], [popover]';

/** The group's items in DOM order, and the focusable elements it holds inert or hidden. */
function scan(root: HTMLElement): { items: HTMLElement[]; parked: HTMLElement[] } {
  const items: HTMLElement[] = [];
  const parked: HTMLElement[] = [];
  for (const element of root.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) {
    // The innermost blocker decides: one outside the group (the group sits in a dialog) is not ours.
    const blocker = element.closest(NOT_AN_ITEM);
    if (blocker === null || blocker === root || !root.contains(blocker)) items.push(element);
    else if (blocker.matches("[inert], [hidden]")) parked.push(element);
  }
  return { items, parked };
}

const itemsWithin = (root: HTMLElement) => scan(root).items;

/** Single-line text entry: the caret moves on the inline axis. */
const TEXT_TYPES = new Set(["", "text", "search", "url", "tel", "email", "password"]);
/** Inputs that take every arrow and Home/End for their own value (a number steps, a range slides). */
const VALUE_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Whether the focused item uses `key` itself, so the group leaves it alone.
 *
 * - A single-line text input keeps Home and End, and keeps the caret's arrows
 *   until the caret sits at the edge the arrow points past (start for
 *   "previous", end for "next", no selection): only then does focus move on.
 * - A textarea, an editable region, a slider, a spinbutton, a native radio and
 *   the non-text inputs (number, range, date…) keep every arrow and Home/End.
 * - A native select keeps the keys that step or open it (Up, Down, Home, End);
 *   Left and Right belong to the group.
 */
function ownsKey(item: HTMLElement, key: string, move: RovingMove): boolean {
  if (item instanceof HTMLTextAreaElement || item.isContentEditable) return VALUE_KEYS.has(key);
  const role = item.getAttribute("role");
  if (role === "slider" || role === "spinbutton") return VALUE_KEYS.has(key);
  if (item instanceof HTMLSelectElement) return key === "ArrowUp" || key === "ArrowDown" || key === "Home" || key === "End";
  if (!(item instanceof HTMLInputElement)) return false;
  const type = item.getAttribute("type")?.toLowerCase() ?? "";
  if (type === "checkbox" || type === "button" || type === "submit" || type === "reset" || type === "color" || type === "image") return false;
  if (!TEXT_TYPES.has(type)) return VALUE_KEYS.has(key);
  if (key === "Home" || key === "End") return true;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return false;
  const { selectionStart: start, selectionEnd: end, value } = item;
  if (start === null || end === null || start !== end) return true;
  return move === "next" ? end < value.length : start > 0;
}

export interface UseRovingFocusWithinOptions {
  orientation: Orientation;
  /** Wrap from the last item to the first and back. @default true */
  loop?: boolean;
  /** Off: the hook leaves tab stops and keys alone (a nested group whose parent owns them). @default true */
  enabled?: boolean;
  /**
   * The tab stop while focus is outside the group (a radio group's checked
   * radio). Falls back to the item that last had focus, then the first enabled one.
   */
  preferredStop?: (items: HTMLElement[]) => HTMLElement | undefined;
  /** An arrow, Home or End moved focus to `item` (a radio group checks it there). */
  onNavigate?: (item: HTMLElement) => void;
}

/**
 * A roving tab stop over whatever focusable elements sit inside `rootRef`
 * (buttons, inputs, selects, a menu's trigger), for a composite whose items a
 * caller writes: a toolbar. Spread `onKeyDown` on the root.
 *
 * - One tab stop: every item but one gets `tabIndex = -1`, kept in sync as
 *   items mount, unmount, disable or go inert. The stop is the focused item,
 *   else `preferredStop`, else the item that last had focus (APG toolbar: Tab
 *   returns to it), else the first enabled item.
 * - Arrows and Home/End as `useRovingFocus`, mirrored right to left, passing
 *   over natively disabled items (an `aria-disabled` one stays in the walk).
 * - Keys a control needs stay with it (`ownsKey`): a text input's caret, a
 *   select's stepping. A key a part already handled (`defaultPrevented`, a menu
 *   button opening on ArrowDown) is left alone, and so is any key from a popup
 *   opened from an item.
 */
export function useRovingFocusWithin(
  rootRef: RefObject<HTMLElement | null>,
  { orientation, loop = true, enabled = true, preferredStop, onNavigate }: UseRovingFocusWithinOptions,
): { onKeyDown: (event: KeyboardEvent<HTMLElement>) => void } {
  const lastFocused = useRef<HTMLElement | null>(null);
  const latest = useRef({ preferredStop, onNavigate });
  latest.current = { preferredStop, onNavigate };

  const sync = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const { items, parked } = scan(root);
    const enabledItems = items.filter((item) => focusable(item));
    const active = document.activeElement;
    const last = lastFocused.current;
    const stop =
      items.find((item) => item === active) ??
      latest.current.preferredStop?.(enabledItems) ??
      (last && enabledItems.includes(last) ? last : undefined) ??
      enabledItems[0];
    for (const item of items) {
      // Written as the attribute even where it is the default (a button's 0), so the stop is explicit.
      const tabIndex = item === stop ? "0" : "-1";
      if (item.getAttribute("tabindex") !== tabIndex) item.setAttribute("tabindex", tabIndex);
    }
    // Out of the Tab order even where `inert` is unsupported; they rejoin the walk when shown.
    for (const element of parked) if (element.getAttribute("tabindex") !== "-1") element.setAttribute("tabindex", "-1");
  }, [rootRef]);

  // Every render of the owner, before paint: the items it rendered get their stops at once.
  useLayoutEffect(() => {
    if (enabled) sync();
  });

  // Items that change without the owner rendering (a child disabling one) and focus moves.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && itemsWithin(root).includes(event.target)) lastFocused.current = event.target;
      sync();
    };
    // Focus has left by the time this runs: a preferred stop (the checked radio) takes the stop back.
    const onFocusOut = () => sync();
    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(sync);
    observer?.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["disabled", "inert", "hidden", "role", "aria-checked"],
    });
    return () => {
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      observer?.disconnect();
    };
  }, [enabled, rootRef, sync]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const root = rootRef.current;
      if (!enabled || !root || event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const items = itemsWithin(root);
      const item = event.target as HTMLElement;
      const from = items.indexOf(item);
      if (from === -1) return;
      const move = rovingMove(event.key, orientation, orientation === "horizontal" && isRtl(root));
      if (!move || ownsKey(item, event.key, move)) return;
      const to = landing(move, items.length, from, loop, (p) => focusable(items[p]));
      // At an end without `loop` the key is still the group's: it must not scroll the page.
      event.preventDefault();
      const target = to === undefined ? undefined : items[to];
      if (!target || target === item) return;
      lastFocused.current = target;
      target.focus();
      sync();
      latest.current.onNavigate?.(target);
    },
    [enabled, loop, orientation, rootRef, sync],
  );

  return { onKeyDown };
}
