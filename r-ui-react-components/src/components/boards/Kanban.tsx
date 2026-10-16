"use client";
import { ChevronsLeftRight, ChevronsRightLeft, TriangleAlert } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { isRtl } from "../../util/direction";
import { formatNumber } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { Badge, IconButton, Skeleton } from "../primitives";

import {
  cardsByColumn,
  columnAt,
  edgeSpeed,
  indexAt,
  type KanbanColumn,
  type KanbanItem,
  type KanbanMove,
  type KanbanPosition,
  moveItem,
  positionOf,
  slotsIn,
} from "./kanban-model";

export type { KanbanColumn, KanbanItem, KanbanMove, KanbanPosition } from "./kanban-model";

/** How far (CSS px) a mouse or pen press travels before it becomes a drag; less is a click. */
const DRAG_THRESHOLD = 4;
/** How long a touch rests before it picks a card up; moving first is a scroll. */
const LONG_PRESS_MS = 400;
/** How far (CSS px) a resting touch may drift before it counts as a scroll. */
const LONG_PRESS_SLOP = 10;
/** The band (CSS px) along a scroller's edge where a drag scrolls it, and the speed at the edge (px per frame). */
const EDGE_ZONE = 48;
const EDGE_SPEED = 16;

export interface KanbanLabels {
  /** Describes every card while dragging is possible: how to pick it up, move, drop and cancel. */
  instructions: string;
  /** A column with no cards. */
  empty: string;
  /** Spoken while `loading`. */
  loading: string;
  /** Spoken beside a column's title (the visible count is "3 / 4"). */
  count: (count: number, limit: number | undefined) => string;
  /** The visible mark on a column holding more cards than its limit. */
  overLimit: string;
  /** The collapse button of a column. */
  collapse: (column: string) => string;
  /** The same button on a collapsed column. */
  expand: (column: string) => string;
  /** Announced when a card is picked up. Positions are 1-based. */
  pickedUp: (card: string, column: string, position: number, total: number) => string;
  /** Announced on each keyboard move. `total` counts the card itself. */
  moved: (column: string, position: number, total: number) => string;
  /** Added to a move or a drop into another column that takes it past its limit. */
  limitExceeded: (column: string, count: number, limit: number) => string;
  /** Announced when a card is dropped. */
  dropped: (card: string, column: string, position: number, total: number) => string;
  /** Announced when a drag is cancelled; the card is back where it started. */
  cancelled: (card: string, column: string, position: number, total: number) => string;
}

const cards = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

export const DEFAULT_KANBAN_LABELS: KanbanLabels = {
  instructions:
    "Press Space or Enter to pick up this card. Then use the arrow keys to move it, Space or Enter to drop it, Escape to cancel.",
  empty: "No cards",
  loading: "Loading cards",
  count: (count, limit) => (limit === undefined ? cards(count) : `${cards(count)}, limit ${limit}`),
  overLimit: "Over limit",
  collapse: (column) => `Collapse ${column}`,
  expand: (column) => `Expand ${column}`,
  pickedUp: (card, column, position, total) => `Picked up ${card}. ${column}, position ${position} of ${total}.`,
  moved: (column, position, total) => `Moved to ${column}, position ${position} of ${total}.`,
  limitExceeded: (column, count, limit) => `${column} is over its limit: ${count} of ${limit}.`,
  dropped: (card, column, position, total) => `Dropped ${card} in ${column}, position ${position} of ${total}.`,
  cancelled: (card, column, position, total) => `Cancelled. ${card} is back in ${column}, position ${position} of ${total}.`,
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    Kanban: KanbanLabels;
  }
}

/** What `renderCard` is told about the card it draws. */
export interface KanbanCardState {
  /** The card is the one being dragged (it stays in place, marked, until it is dropped). */
  dragging: boolean;
}

/** A board must be named: by `aria-label`, or by a visible heading's id in `aria-labelledby`. */
type KanbanName = { "aria-label": string; "aria-labelledby"?: string } | { "aria-labelledby": string; "aria-label"?: string };

export type KanbanProps<T extends KanbanItem> = Omit<
  ComponentPropsWithRef<"div">,
  "children" | "defaultValue" | "onChange" | "aria-label" | "aria-labelledby"
> &
  KanbanName & {
    /** The columns, in reading order. */
    columns: readonly KanbanColumn[];
    /** Every card. A column's cards are the ones naming it, in array order. */
    value: readonly T[];
    /**
     * Called once per drop that moved a card, with the whole new array (the card
     * moved, its `columnId` updated, every other card in its order) and the move.
     */
    onValueChange: (next: T[], move: KanbanMove) => void;
    /** A card's content. Links and buttons inside it work as usual; the card itself is the drag handle. */
    renderCard: (item: T, state: KanbanCardState) => ReactNode;
    /** A card's name in announcements. Omitted: the card's text. */
    cardLabel?: (item: T) => string;
    /** An "add card" slot under each expanded column's cards. */
    renderAddCard?: (column: KanbanColumn) => ReactNode;
    /** Gives each column a button that folds it to a narrow strip (it still takes drops, at its end). */
    collapsible?: boolean;
    /** The collapsed columns' ids (controlled). */
    collapsed?: readonly string[];
    defaultCollapsed?: readonly string[];
    onCollapsedChange?: (collapsed: string[]) => void;
    /** Nothing can be moved; cards and their content stay usable. */
    disabled?: boolean;
    /** Placeholder cards in every column, and the board says it is busy. */
    loading?: boolean;
    /** For the counts. Omitted: the `LocaleProvider`'s, else the runtime's. */
    locale?: string;
    labels?: LabelsProp<KanbanLabels>;
    classNames?: SlotClassNames<"scroller" | "column" | "header" | "list" | "card" | "footer" | "preview">;
  };

interface Drag {
  id: string;
  mode: "pointer" | "keyboard";
  origin: KanbanPosition;
  target: KanbanPosition;
}

interface Press {
  id: string;
  pointerId: number;
  touch: boolean;
  card: HTMLElement;
  x0: number;
  y0: number;
  x: number;
  y: number;
  active: boolean;
  /** Where the press sits inside the card, so the preview stays under the same point. */
  offsetX: number;
  offsetY: number;
  /** The scroller the page scrolls in (an ancestor, else the document). */
  page: Element | null;
  timer: number;
  frame: number;
  cleanup: () => void;
}

const NONE: readonly string[] = [];
const FORM_CONTROL = "input, textarea, select, [contenteditable=''], [contenteditable='true']";
const NARROW = "@max-xl:snap-start @max-xl:basis-[calc(100cqi*0.85)]";

const samePosition = (a: KanbanPosition, b: KanbanPosition) => a.column === b.column && a.index === b.index;

/** The nearest ancestor that scrolls vertically, else the document's scroller. */
function verticalScroller(from: Element | null): Element | null {
  for (let el = from?.parentElement ?? null; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && el.scrollHeight > el.clientHeight) return el;
  }
  return document.scrollingElement;
}

/** Scrolls `el` by `delta` on one axis; whether it moved. */
function nudge(el: Element, axis: "x" | "y", delta: number): boolean {
  if (delta === 0) return false;
  const step = delta > 0 ? Math.max(1, Math.round(delta)) : Math.min(-1, Math.round(delta));
  const before = axis === "x" ? el.scrollLeft : el.scrollTop;
  if (axis === "x") el.scrollLeft += step;
  else el.scrollTop += step;
  return (axis === "x" ? el.scrollLeft : el.scrollTop) !== before;
}

/**
 * A board of columns holding cards, moved by pointer, touch or keyboard.
 *
 * - **Value**: controlled. `value` holds every card; a drop calls
 *   `onValueChange(next, move)` once, with `move = { id, from, to }`.
 * - **Pointer**: a press that travels a few pixels picks the card up (a shorter
 *   one is a click, so links and buttons in a card work); a preview follows the
 *   pointer, a line shows where it will land, and the board, the column and the
 *   page scroll when it nears their edges. Escape cancels.
 * - **Touch**: a touch held still picks the card up; one that moves first
 *   scrolls the board as usual.
 * - **Keyboard**: a focused card is picked up with Space or Enter; Up and Down
 *   move it within its column, Left and Right to the neighbouring column
 *   (mirrored right to left), Home and End to the column's ends; Space or Enter
 *   drops it, Escape (or leaving the card) cancels. Every step is announced.
 * - **Columns**: a `limit` marks a column holding more cards than it (and
 *   announces a move that takes it past); an empty column takes drops; with
 *   `collapsible` a column folds to a strip. Narrower than about two columns,
 *   the board scrolls a column at a time.
 */
export function Kanban<T extends KanbanItem>({
  columns,
  value,
  onValueChange,
  renderCard,
  cardLabel,
  renderAddCard,
  collapsible = false,
  collapsed: collapsedProp,
  defaultCollapsed,
  onCollapsedChange,
  disabled = false,
  loading = false,
  locale: localeProp,
  labels: labelsProp,
  classNames,
  className,
  ref,
  ...props
}: KanbanProps<T>) {
  const labels = useLabels("Kanban", DEFAULT_KANBAN_LABELS, labelsProp);
  const locale = useLocale(localeProp);
  const baseId = useId();
  const instructionsId = `${baseId}-instructions`;
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLLIElement>(null);
  const rootRefs = useMemo(() => mergeRefs(rootRef, ref), [ref]);

  const [collapsed, setCollapsed] = useControllableState<readonly string[]>({
    value: collapsedProp,
    defaultValue: defaultCollapsed ?? [],
    onChange: (next) => onCollapsedChange?.([...next]),
  });
  const folded = collapsible ? collapsed : NONE;
  const byColumn = useMemo(() => cardsByColumn(columns, value), [columns, value]);

  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  };
  const [announcement, setAnnouncement] = useState("");
  const press = useRef<Press | null>(null);

  // Window listeners outlive the render that added them; they read the latest props here.
  const latest = useRef({ value, columns, byColumn, folded, labels, onValueChange, cardLabel });
  latest.current = { value, columns, byColumn, folded, labels, onValueChange, cardLabel };

  const movable = !disabled && !loading;

  const titleOf = (column: string) => latest.current.columns.find((c) => c.id === column)?.title ?? column;
  const cardElement = (id: string) =>
    [...(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-kanban-card]") ?? [])].find((el) => el.dataset.kanbanCard === id);
  const nameOf = (id: string) => {
    const item = latest.current.value.find((i) => i.id === id);
    if (item && latest.current.cardLabel) return latest.current.cardLabel(item);
    return cardElement(id)?.textContent?.trim() || id;
  };
  /** The limit note for a card landing in `column`, from another column. */
  const limitNote = (column: string, id: string) => {
    const limit = latest.current.columns.find((c) => c.id === column)?.limit;
    const count = slotsIn(latest.current.byColumn, column, id);
    return limit !== undefined && count > limit ? ` ${latest.current.labels.limitExceeded(titleOf(column), count, limit)}` : "";
  };

  const pickUp = (id: string, mode: Drag["mode"]) => {
    const origin = positionOf(latest.current.byColumn, id);
    if (!origin) return false;
    setDrag({ id, mode, origin, target: origin });
    setAnnouncement(latest.current.labels.pickedUp(nameOf(id), titleOf(origin.column), origin.index + 1, slotsIn(latest.current.byColumn, origin.column, id)));
    return true;
  };

  const retarget = (target: KanbanPosition, speak: boolean) => {
    const current = dragRef.current;
    if (!current || samePosition(current.target, target)) return;
    setDrag({ ...current, target });
    if (!speak) return;
    const note = target.column === current.origin.column ? "" : limitNote(target.column, current.id);
    setAnnouncement(latest.current.labels.moved(titleOf(target.column), target.index + 1, slotsIn(latest.current.byColumn, target.column, current.id)) + note);
  };

  const finish = (how: "drop" | "cancel") => {
    const current = dragRef.current;
    if (!current) return;
    setDrag(null);
    const { byColumn: now, labels: words } = latest.current;
    const name = nameOf(current.id);
    if (how === "cancel" || !positionOf(now, current.id)) {
      const { column, index } = current.origin;
      setAnnouncement(words.cancelled(name, titleOf(column), index + 1, slotsIn(now, column, current.id)));
      return;
    }
    const { column, index } = current.target;
    const note = column === current.origin.column ? "" : limitNote(column, current.id);
    setAnnouncement(words.dropped(name, titleOf(column), index + 1, slotsIn(now, column, current.id)) + note);
    if (samePosition(current.origin, current.target)) return;
    if (current.mode === "keyboard") refocus.current = current.id;
    latest.current.onValueChange(moveItem(latest.current.value, current.id, current.target), {
      id: current.id,
      from: current.origin,
      to: current.target,
    });
  };

  /** The place under a pointer at (`x`, `y`) for card `id`. */
  const pointTarget = (x: number, y: number, id: string): KanbanPosition | null => {
    const columnEls = [...(scrollerRef.current?.querySelectorAll<HTMLElement>(":scope > [data-kanban-column]") ?? [])];
    const boxes = columnEls.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.dataset.kanbanColumn ?? "", left: r.left, right: r.right, el };
    });
    const column = columnAt(boxes, x);
    if (column === null) return null;
    const slots = slotsIn(latest.current.byColumn, column, id);
    if (latest.current.folded.includes(column)) return { column, index: slots - 1 };
    const el = boxes.find((b) => b.id === column)?.el;
    const mids = [...(el?.querySelectorAll<HTMLElement>("[data-kanban-card]") ?? [])]
      .filter((card) => card.dataset.kanbanCard !== id)
      .map((card) => {
        const r = card.getBoundingClientRect();
        return r.top + r.height / 2;
      });
    return { column, index: Math.min(indexAt(mids, y), slots - 1) };
  };

  const placePreview = (p: Press) => {
    const preview = previewRef.current;
    if (!preview) return;
    preview.style.setProperty("--r-boards-preview-x", String(p.x - p.offsetX));
    preview.style.setProperty("--r-boards-preview-y", String(p.y - p.offsetY));
  };

  const followPointer = (p: Press) => {
    placePreview(p);
    const target = pointTarget(p.x, p.y, p.id);
    if (target) retarget(target, false);
  };

  /** One frame of edge scrolling: the board sideways, the target column's list and the page vertically. */
  const autoScroll = (p: Press) => {
    let moved = false;
    const scroller = scrollerRef.current;
    if (scroller && scroller.scrollWidth > scroller.clientWidth) {
      const r = scroller.getBoundingClientRect();
      if (p.y >= r.top && p.y <= r.bottom) moved = nudge(scroller, "x", edgeSpeed(p.x, r.left, r.right, EDGE_ZONE, EDGE_SPEED)) || moved;
    }
    const target = dragRef.current?.target.column;
    const list = [...(scroller?.querySelectorAll<HTMLElement>("[data-kanban-list]") ?? [])].find((el) => el.dataset.kanbanList === target);
    if (list && list.scrollHeight > list.clientHeight) {
      const r = list.getBoundingClientRect();
      if (p.x >= r.left && p.x <= r.right) moved = nudge(list, "y", edgeSpeed(p.y, r.top, r.bottom, EDGE_ZONE, EDGE_SPEED)) || moved;
    }
    if (p.page) {
      const isDocument = p.page === document.scrollingElement;
      const r = isDocument ? { top: 0, bottom: window.innerHeight } : p.page.getBoundingClientRect();
      moved = nudge(p.page, "y", edgeSpeed(p.y, r.top, r.bottom, EDGE_ZONE, EDGE_SPEED)) || moved;
    }
    if (moved) followPointer(p);
  };

  const activate = (p: Press) => {
    if (!pickUp(p.id, "pointer")) return endPress(p, null);
    p.active = true;
    const r = p.card.getBoundingClientRect();
    p.offsetX = p.x0 - r.left;
    p.offsetY = p.y0 - r.top;
    p.page = verticalScroller(rootRef.current);
    window.getSelection()?.removeAllRanges();
    try {
      p.card.setPointerCapture(p.pointerId);
    } catch {
      // The pointer is already gone (released between the timer and now); the next event ends the press.
    }
    const loop = () => {
      autoScroll(p);
      p.frame = requestAnimationFrame(loop);
    };
    p.frame = requestAnimationFrame(loop);
  };

  function endPress(p: Press, how: "drop" | "cancel" | null) {
    p.cleanup();
    if (press.current === p) press.current = null;
    if (how) finish(how);
  }

  const onCardPointerDown = (event: ReactPointerEvent<HTMLLIElement>, id: string) => {
    if (!movable || dragRef.current || press.current) return;
    if (!event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(FORM_CONTROL)) return;
    const p: Press = {
      id,
      pointerId: event.pointerId,
      touch: event.pointerType === "touch",
      card: event.currentTarget,
      x0: event.clientX,
      y0: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      offsetX: 0,
      offsetY: 0,
      page: null,
      timer: 0,
      frame: 0,
      cleanup: () => {},
    };
    const ours = (e: PointerEvent) => e.pointerId === p.pointerId;
    const onMove = (e: PointerEvent) => {
      if (!ours(e)) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (!p.active) {
        const distance = Math.hypot(p.x - p.x0, p.y - p.y0);
        // A touch that moves before the long press is a scroll; a mouse that moves far enough is a drag.
        if (p.touch) {
          if (distance > LONG_PRESS_SLOP) endPress(p, null);
          return;
        }
        if (distance < DRAG_THRESHOLD) return;
        activate(p);
        if (!p.active) return;
      }
      followPointer(p);
    };
    const onUp = (e: PointerEvent) => {
      if (!ours(e)) return;
      if (!p.active) return endPress(p, null);
      p.x = e.clientX;
      p.y = e.clientY;
      followPointer(p);
      endPress(p, "drop");
      // The release's click would follow a link or press a button in the card.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
    };
    const onCancel = (e: PointerEvent) => {
      if (ours(e)) endPress(p, p.active ? "cancel" : null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !p.active) return;
      e.preventDefault();
      e.stopPropagation();
      endPress(p, "cancel");
    };
    // A long press would otherwise open the system's menu or start a text selection.
    const onTouchDefault = (e: Event) => {
      if (p.touch) e.preventDefault();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onTouchDefault, true);
    window.addEventListener("selectstart", onTouchDefault, true);
    p.cleanup = () => {
      window.clearTimeout(p.timer);
      cancelAnimationFrame(p.frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("contextmenu", onTouchDefault, true);
      window.removeEventListener("selectstart", onTouchDefault, true);
    };
    press.current = p;
    if (p.touch) p.timer = window.setTimeout(() => activate(p), LONG_PRESS_MS);
  };

  const onCardKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>, id: string) => {
    // Keys inside the card's content (a link, a button) belong to that content.
    if (event.target !== event.currentTarget) return;
    const current = dragRef.current;
    if (!current) {
      if (movable && !press.current && (event.key === " " || event.key === "Enter")) {
        event.preventDefault();
        pickUp(id, "keyboard");
      }
      return;
    }
    if (current.mode !== "keyboard" || current.id !== id) return;
    const { columns: cols, byColumn: now, folded: shut } = latest.current;
    const { column, index } = current.target;
    const range = (col: string) => {
      const slots = slotsIn(now, col, id);
      // A collapsed column shows no cards to land between: it takes a card at its end.
      return { first: shut.includes(col) ? slots - 1 : 0, last: slots - 1 };
    };
    const within = (to: number) => {
      const { first, last } = range(column);
      return { column, index: Math.min(last, Math.max(first, to)) };
    };
    let next: KanbanPosition | null = null;
    switch (event.key) {
      case " ":
      case "Enter":
        event.preventDefault();
        finish("drop");
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        finish("cancel");
        return;
      case "Tab":
        return;
      case "ArrowUp":
        next = within(index - 1);
        break;
      case "ArrowDown":
        next = within(index + 1);
        break;
      case "Home":
        next = within(0);
        break;
      case "End":
        next = within(Number.POSITIVE_INFINITY);
        break;
      case "ArrowLeft":
      case "ArrowRight": {
        const forward = (event.key === "ArrowRight") !== isRtl(event.currentTarget);
        const neighbour = cols[cols.findIndex((c) => c.id === column) + (forward ? 1 : -1)];
        if (neighbour) {
          const { first, last } = range(neighbour.id);
          next = { column: neighbour.id, index: Math.min(last, Math.max(first, index)) };
        }
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    if (next) retarget(next, true);
  };

  const onCardBlur = (id: string) => {
    const current = dragRef.current;
    if (current?.mode === "keyboard" && current.id === id) finish("cancel");
  };

  // The preview: a copy of the card as it looked when picked up, promoted to the top layer.
  const previewing = drag?.mode === "pointer" ? drag.id : null;
  useLayoutEffect(() => {
    const preview = previewRef.current;
    const p = press.current;
    if (!previewing || !preview || !p) return;
    const copy = p.card.cloneNode(true) as HTMLElement;
    for (const el of [copy, ...copy.querySelectorAll("[id]")]) el.removeAttribute("id");
    copy.removeAttribute("data-kanban-card");
    copy.removeAttribute("tabindex");
    copy.removeAttribute("aria-describedby");
    copy.removeAttribute("data-drag-source");
    preview.replaceChildren(copy);
    preview.style.setProperty("--r-boards-preview-w", String(p.card.getBoundingClientRect().width));
    placePreview(p);
    if (typeof preview.showPopover === "function" && !preview.matches(":popover-open")) preview.showPopover();
    // Taken once per drag: later moves only reposition it.
  }, [previewing]);

  // The drop line: between the cards the target index falls between, in the target column's list.
  useLayoutEffect(() => {
    if (!drag) return;
    const indicator = indicatorRef.current;
    const list = indicator?.parentElement;
    if (indicator && list) {
      const placed = [...list.querySelectorAll<HTMLElement>(":scope > [data-kanban-card]")];
      const { origin, target } = drag;
      // Cards on screen still include the dragged one at its origin; skip past it.
      const k = target.column === origin.column && target.index >= origin.index ? target.index + 1 : target.index;
      const style = getComputedStyle(list);
      const gap = Number.parseFloat(style.rowGap) || 0;
      const next = placed[k];
      const prev = placed[k - 1];
      const y = next
        ? next.offsetTop - gap / 2
        : prev
          ? prev.offsetTop + prev.offsetHeight + gap / 2
          : Number.parseFloat(style.paddingTop) || 0;
      indicator.style.setProperty("--r-boards-indicator-y", String(y));
    }
    if (drag.mode !== "keyboard") return;
    // Keys move the target off screen: bring its whole column into the board's view, then the line (or the card).
    const scroller = scrollerRef.current;
    const column = [...(scroller?.querySelectorAll<HTMLElement>(":scope > [data-kanban-column]") ?? [])].find(
      (el) => el.dataset.kanbanColumn === drag.target.column,
    );
    if (scroller && column) {
      const c = column.getBoundingClientRect();
      const s = scroller.getBoundingClientRect();
      if (c.left < s.left) scroller.scrollLeft -= s.left - c.left;
      else if (c.right > s.right) scroller.scrollLeft += Math.min(c.right - s.right, c.left - s.left);
    }
    const shown = indicator ?? (samePosition(drag.origin, drag.target) ? cardElement(drag.id) : column);
    shown?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [drag]);

  // Once a touch has picked a card up, its moves drag the card instead of scrolling. The listener
  // is on the board for its life: added at the long press, it would come after the browser had
  // already decided this touch's moves cannot be cancelled.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onTouchMove = (e: TouchEvent) => {
      if (press.current?.active && e.cancelable) e.preventDefault();
    };
    root.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      root.removeEventListener("touchmove", onTouchMove);
      // An unmount mid-press leaves no window listener behind.
      press.current?.cleanup();
    };
  }, []);

  // A keyboard drop re-renders the card in its new place (another list, or moved within one),
  // which takes focus from it: give focus back to the card the keys are moving.
  const refocus = useRef<string | null>(null);
  useLayoutEffect(() => {
    const id = refocus.current;
    refocus.current = null;
    const active = document.activeElement;
    if (id && (!active || active === document.body)) cardElement(id)?.focus();
  }, [value]);

  const toggle = (id: string) => setCollapsed((all) => (all.includes(id) ? all.filter((c) => c !== id) : [...all, id]));

  return (
    <div
      ref={rootRefs}
      role="group"
      aria-busy={loading || undefined}
      data-dragging={drag?.mode}
      data-disabled={disabled || undefined}
      className={cn("r-boards-kanban @container", className)}
      {...props}
    >
      <div
        ref={scrollerRef}
        className={cn("r-boards-kanban-scroller", !drag && "@max-xl:snap-x @max-xl:snap-mandatory", classNames?.scroller)}
      >
        {columns.map((column) => {
          const items = byColumn.get(column.id) ?? [];
          const isCollapsed = folded.includes(column.id);
          const over = column.limit !== undefined && items.length > column.limit;
          const isTarget = drag?.target.column === column.id;
          const ids = { title: `${baseId}-${column.id}-title`, count: `${baseId}-${column.id}-count`, over: `${baseId}-${column.id}-over` };
          const list = `${baseId}-${column.id}-list`;
          const showIndicator = isTarget && !isCollapsed && drag !== null && !samePosition(drag.origin, drag.target);
          return (
            <div
              key={column.id}
              role="group"
              aria-labelledby={[ids.title, ids.count, over && ids.over].filter(Boolean).join(" ")}
              data-kanban-column={column.id}
              data-collapsed={isCollapsed || undefined}
              data-over-limit={over || undefined}
              data-drop-target={isTarget || undefined}
              data-drop-over-limit={(isTarget && drag && drag.origin.column !== column.id && limitNote(column.id, drag.id) !== "") || undefined}
              className={cn("r-boards-kanban-column", !isCollapsed && NARROW, classNames?.column)}
            >
              <div className={cn("r-boards-kanban-header", classNames?.header)}>
                <span id={ids.title} className="r-boards-kanban-title" title={column.title}>
                  {column.title}
                </span>
                <span className="r-boards-kanban-count" aria-hidden>
                  {formatNumber(items.length, { locale })}
                  {column.limit !== undefined && ` / ${formatNumber(column.limit, { locale })}`}
                </span>
                <span id={ids.count} className="sr-only">
                  {labels.count(items.length, column.limit)}
                </span>
                {over && (
                  <Badge id={ids.over} tone="warning" icon={<TriangleAlert />} className="r-boards-kanban-over">
                    {labels.overLimit}
                  </Badge>
                )}
                {collapsible && (
                  <IconButton
                    label={isCollapsed ? labels.expand(column.title) : labels.collapse(column.title)}
                    icon={isCollapsed ? <ChevronsLeftRight /> : <ChevronsRightLeft />}
                    aria-expanded={!isCollapsed}
                    aria-controls={list}
                    disabled={drag !== null}
                    onClick={() => toggle(column.id)}
                    className="r-boards-kanban-toggle"
                    data-print="hide"
                  />
                )}
              </div>
              <ul
                id={list}
                hidden={isCollapsed}
                aria-labelledby={ids.title}
                data-kanban-list={column.id}
                data-empty={(!loading && items.length === 0) || undefined}
                className={cn("r-boards-kanban-list", classNames?.list)}
              >
                {loading
                  ? [0, 1].map((n) => (
                      <li key={n} aria-hidden className="r-boards-kanban-card r-boards-kanban-placeholder">
                        <Skeleton lines={2} />
                      </li>
                    ))
                  : items.map((item) => {
                      const dragging = drag?.id === item.id;
                      return (
                        <li
                          key={item.id}
                          data-kanban-card={item.id}
                          tabIndex={0}
                          aria-describedby={movable ? instructionsId : undefined}
                          data-drag-source={dragging || undefined}
                          data-print="avoid-break"
                          className={cn("r-boards-kanban-card", classNames?.card)}
                          onPointerDown={(event) => onCardPointerDown(event, item.id)}
                          onKeyDown={(event) => onCardKeyDown(event, item.id)}
                          onBlur={() => onCardBlur(item.id)}
                          // Native drag of a link or image inside would steal the pointer (pointercancel).
                          onDragStart={(event) => event.preventDefault()}
                        >
                          {renderCard(item, { dragging })}
                        </li>
                      );
                    })}
                {showIndicator && <li ref={indicatorRef} aria-hidden className="r-boards-kanban-indicator" />}
              </ul>
              {!loading && !isCollapsed && items.length === 0 && <p className="r-boards-kanban-empty">{labels.empty}</p>}
              {renderAddCard && !isCollapsed && (
                <div className={cn("r-boards-kanban-footer", classNames?.footer)} data-print="hide">
                  {renderAddCard(column)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <span id={instructionsId} hidden>
        {labels.instructions}
      </span>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" data-kanban-status>
        {announcement}
      </div>
      {loading && (
        <span role="status" className="sr-only">
          {labels.loading}
        </span>
      )}
      {previewing && (
        <div
          ref={previewRef}
          popover="manual"
          aria-hidden
          inert
          data-print="hide"
          className={cn("r-boards-kanban-preview r-floating-top-layer", classNames?.preview)}
        />
      )}
    </div>
  );
}
