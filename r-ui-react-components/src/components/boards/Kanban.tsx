"use client";
import { ChevronsLeftRight, ChevronsRightLeft, TriangleAlert } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type PressDrag, usePressDrag } from "../../hooks/use-press-drag";
import { isRtl } from "../../util/direction";
import { formatNumber } from "../../util/format";
import { type LabelsProp, useLabels, useLocale } from "../../util/locale";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { Badge, IconButton, Skeleton } from "../primitives";

import {
  cardsByColumn,
  columnAt,
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

/** What a pointer press is about. */
interface Grab {
  id: string;
  card: HTMLElement;
}

/** The pointer drag's card, its grab point inside it (so the preview stays under the same point) and the pointer. */
interface Held {
  card: HTMLElement;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
}

const NONE: readonly string[] = [];
const NARROW = "@max-xl:snap-start @max-xl:basis-[calc(100cqi*0.85)]";

const samePosition = (a: KanbanPosition, b: KanbanPosition) => a.column === b.column && a.index === b.index;

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
  const held = useRef<Held | null>(null);

  // Drag callbacks run from window listeners and timers, after the render that made them; they read the latest props here.
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

  const placePreview = (h: Held) => {
    previewRef.current?.style.setProperty("--r-boards-preview-x", String(h.x - h.offsetX));
    previewRef.current?.style.setProperty("--r-boards-preview-y", String(h.y - h.offsetY));
  };

  const followPointer = ({ payload, x, y }: PressDrag<Grab>) => {
    const h = held.current;
    if (h) {
      h.x = x;
      h.y = y;
      placePreview(h);
    }
    const target = pointTarget(x, y, payload.id);
    if (target) retarget(target, false);
  };

  const pointer = usePressDrag<Grab>({
    enabled: movable,
    onStart: ({ payload: { id, card }, x0, y0, x, y }) => {
      // A keyboard drag began while this press waited.
      if (dragRef.current) return false;
      const r = card.getBoundingClientRect();
      held.current = { card, offsetX: x0 - r.left, offsetY: y0 - r.top, x, y };
      return pickUp(id, "pointer");
    },
    onMove: followPointer,
    onEnd: (_, how) => {
      held.current = null;
      finish(how);
    },
    // The board sideways and the target column's list; the hook adds the page, found from the scroller.
    scrollers: () => {
      const target = dragRef.current?.target.column;
      const lists = scrollerRef.current?.querySelectorAll<HTMLElement>("[data-kanban-list]") ?? [];
      return [scrollerRef.current, [...lists].find((el) => el.dataset.kanbanList === target)];
    },
  });
  const rootRefs = useMemo(() => mergeRefs(rootRef, ref, pointer.rootRef), [ref, pointer.rootRef]);

  // Pressed on the scroller, not the card, so the page the hook scrolls is found above the board
  // (from a card it would be that card's own list, which is not the page).
  const onScrollerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-kanban-card]") : null;
    const id = card?.dataset.kanbanCard;
    if (!card || id === undefined || dragRef.current) return;
    pointer.onPointerDown(event, { id, card });
  };

  const onCardKeyDown = (event: ReactKeyboardEvent<HTMLLIElement>, id: string) => {
    // Keys inside the card's content (a link, a button) belong to that content.
    if (event.target !== event.currentTarget) return;
    const current = dragRef.current;
    if (!current) {
      if (movable && (event.key === " " || event.key === "Enter")) {
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
    const h = held.current;
    if (!previewing || !preview || !h) return;
    const copy = h.card.cloneNode(true) as HTMLElement;
    for (const el of [copy, ...copy.querySelectorAll("[id]")]) el.removeAttribute("id");
    copy.removeAttribute("data-kanban-card");
    copy.removeAttribute("tabindex");
    copy.removeAttribute("aria-describedby");
    copy.removeAttribute("data-drag-source");
    preview.replaceChildren(copy);
    preview.style.setProperty("--r-boards-preview-w", String(h.card.getBoundingClientRect().width));
    placePreview(h);
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
        onPointerDown={onScrollerPointerDown}
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
