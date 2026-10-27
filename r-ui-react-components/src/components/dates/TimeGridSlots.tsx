"use client";
import {
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  memo,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePressDrag } from "../../hooks/use-press-drag";
import { isRtl } from "../../util/direction";
import { addDays, isSameDay, parseISODate, startOfDay, toISODate } from "./date-core";
import { minuteOfDay } from "./event-core";
import {
  type CalendarRange,
  describeRange,
  describeSlot,
  rangeTouchesDay,
  type SlotMinutes,
  type SlotPoint,
  slotRange,
  snapToSlot,
} from "./event-edit";
import type { EventCalendarLabels } from "./event-parts";
import { slotAt } from "./time-grid-geometry";

export interface TimeGridSlotsProps {
  /** The days shown, one column each (the time grid's own). */
  days: readonly Date[];
  /** The active day: the slot cursor starts on it, and a move onto another day changes it. */
  date: Date;
  onDateChange: (day: Date) => void;
  slotMinutes: SlotMinutes;
  selection: CalendarRange | null;
  onSelectionChange: (range: CalendarRange | null) => void;
  /** The hour the cursor starts at when nothing is picked. */
  scrollToHour: number;
  locale: string;
  labels: EventCalendarLabels;
  announce: (message: string) => void;
  /** The time grid's scroll region: kept on the active slot, edge-scrolled while dragging. */
  regionRef: RefObject<HTMLDivElement | null>;
  /** A pick is under way here, or no longer: what the picked range drawn elsewhere (the all-day row) gives way to. */
  onDraftChange?: (drafting: boolean) => void;
}

const DAY_MINUTES = 24 * 60;

/** A range being picked: from where it began to where the cursor or pointer is. */
interface Draft {
  anchor: SlotPoint;
  head: SlotPoint;
}

/** The wall-clock minutes `[start, end)` a timed range covers on `day`, or null. */
function minutesOn(range: CalendarRange, day: Date): [number, number] | null {
  if (range.allDay || !rangeTouchesDay(range, day)) return null;
  const start = minuteOfDay(range.start.getTime(), day) ?? 0;
  const end = minuteOfDay(range.end.getTime(), day) ?? DAY_MINUTES;
  return end > start ? [start, end] : null;
}

const sameSlot = (a: SlotPoint, b: SlotPoint) => a.minute === b.minute && isSameDay(a.day, b.day);

/** The slot a cell element stands for. */
function slotOf(target: EventTarget | null): SlotPoint | null {
  const cell = target instanceof Element ? target.closest<HTMLElement>("[data-slot-minute]") : null;
  const day = cell ? parseISODate(cell.dataset.slotDay ?? "") : null;
  return cell && day ? { day, minute: Number(cell.dataset.slotMinute) } : null;
}

/**
 * The slots under a week or day grid's events, where a range is picked: a
 * press on a slot picks it, a drag picks the slots it covers (across days,
 * either way), and the keyboard has a slot cursor. One tab stop, an APG grid
 * driven by `aria-activedescendant`: rows are slots, columns days. Arrows move
 * a slot or a day (mirrored right to left), Home / End go to the day's ends,
 * PageUp / PageDown an hour; with Shift each extends a draft from where Shift
 * was first held. Enter or Space picks the draft (or the cursor's slot),
 * Escape drops the draft and clears the picked range.
 */
export function TimeGridSlots({
  days,
  date,
  onDateChange,
  slotMinutes,
  selection,
  onSelectionChange,
  scrollToHour,
  locale,
  labels,
  announce,
  regionRef,
  onDraftChange,
}: TimeGridSlotsProps) {
  const baseId = useId();
  const cellId = (p: SlotPoint) => `${baseId}-${toISODate(p.day)}-${p.minute}`;
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState<SlotPoint | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  // The drag's draft as of the last pointer move: its drop reads it before a render.
  const dragDraft = useRef<Draft | null>(null);
  // Focus that a press gave the layer: the cursor is not scrolled to then.
  const pressFocus = useRef(false);

  const lastMinute = DAY_MINUTES - slotMinutes;
  const dayIndex = (day: Date) => days.findIndex((d) => isSameDay(d, day));
  const inView = (p: SlotPoint) => dayIndex(p.day) >= 0;

  // The cursor: where it was moved, while that day is shown; else the picked
  // range's first slot when shown; else `scrollToHour` on the active day.
  const start = (): SlotPoint => {
    if (selection && !selection.allDay) {
      const first = { day: startOfDay(selection.start), minute: snapToSlot(minuteOfDay(selection.start.getTime(), selection.start) ?? 0, slotMinutes) };
      if (inView(first)) return first;
    }
    return { day: days.find((d) => isSameDay(d, date)) ?? (days[0] as Date), minute: snapToSlot(scrollToHour * 60, slotMinutes) };
  };
  const active: SlotPoint = cursor && inView(cursor) ? { day: cursor.day, minute: snapToSlot(cursor.minute, slotMinutes) } : start();

  const commit = (range: CalendarRange) => {
    setDraft(null);
    onSelectionChange(range);
    announce(labels.selected(describeRange(range, locale, labels)));
  };

  const scrollToCell = (p: SlotPoint) =>
    document.getElementById(cellId(p))?.scrollIntoView?.({ block: "nearest", inline: "nearest" });

  const moveCursor = (to: SlotPoint, extend: boolean) => {
    const from = active;
    setCursor(to);
    setDraft(extend ? (was) => ({ anchor: was?.anchor ?? from, head: to }) : null);
    if (!isSameDay(to.day, from.day)) onDateChange(to.day);
    scrollToCell(to);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const within = (minute: number): SlotPoint => ({ day: active.day, minute: Math.min(Math.max(minute, 0), lastMinute) });
    const acrossDays = (step: number): SlotPoint => {
      const i = Math.min(Math.max(dayIndex(active.day) + step, 0), days.length - 1);
      return { day: days[i] as Date, minute: active.minute };
    };
    const forward = isRtl(event.currentTarget) ? -1 : 1;
    let to: SlotPoint;
    switch (event.key) {
      case "ArrowUp":
        to = within(active.minute - slotMinutes);
        break;
      case "ArrowDown":
        to = within(active.minute + slotMinutes);
        break;
      case "PageUp":
        to = within(active.minute - 60);
        break;
      case "PageDown":
        to = within(active.minute + 60);
        break;
      case "Home":
        to = within(0);
        break;
      case "End":
        to = within(lastMinute);
        break;
      case "ArrowRight":
        to = acrossDays(forward);
        break;
      case "ArrowLeft":
        to = acrossDays(-forward);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(draft ? slotRange(draft.anchor, draft.head, slotMinutes) : slotRange(active, active, slotMinutes));
        return;
      case "Escape":
        // Nothing to drop: the key is someone else's (a dialog around the calendar).
        if (!draft && !selection) return;
        event.preventDefault();
        event.stopPropagation();
        setDraft(null);
        if (selection) {
          onSelectionChange(null);
          announce(labels.selectionCleared);
        }
        return;
      default:
        return;
    }
    // At an edge the key is still the grid's: the region must not scroll under it.
    event.preventDefault();
    moveCursor(to, event.shiftKey);
  };

  // ── Pointer ───────────────────────────────────────────────────────────────
  const drag = usePressDrag<SlotPoint>({
    // The pick starts where the press lands, at once: the old one gives way to it
    // before the pointer moves, and comes back if the press comes to nothing.
    onPress: ({ payload }) => {
      dragDraft.current = { anchor: payload, head: payload };
      setDraft(dragDraft.current);
    },
    // A press that never became a drag: its click (if any) picks the slot first,
    // then whatever the press showed is dropped.
    onRelease: () => {
      window.setTimeout(() => {
        if (drag.isDragging()) return;
        dragDraft.current = null;
        setDraft(null);
      }, 0);
    },
    onStart: ({ payload }) => {
      dragDraft.current = { anchor: payload, head: payload };
      setDraft(dragDraft.current);
    },
    onMove: ({ x, y }) => {
      const body = layerRef.current?.parentElement;
      const at = body ? slotAt(body, x, y, slotMinutes) : null;
      const was = dragDraft.current;
      if (!at || !was || sameSlot(at, was.head)) return;
      dragDraft.current = { anchor: was.anchor, head: at };
      setDraft(dragDraft.current);
    },
    onEnd: (_drag, how) => {
      const done = dragDraft.current;
      dragDraft.current = null;
      if (how === "cancel" || !done) {
        setDraft(null);
        return;
      }
      setCursor(done.head);
      commit(slotRange(done.anchor, done.head, slotMinutes));
    },
    scrollers: () => [regionRef.current],
  });
  const { rootRef } = drag;
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      layerRef.current = el;
      rootRef(el);
    },
    [rootRef],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const p = slotOf(event.target);
    if (!p) return;
    pressFocus.current = document.activeElement !== event.currentTarget;
    drag.onPointerDown(event, p);
  };
  // A press that never became a drag (the engine swallows the click after one).
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    // Released over another part of the layer than the slot pressed: the pressed slot.
    const p = slotOf(event.target) ?? dragDraft.current?.anchor;
    if (!p) return;
    dragDraft.current = null;
    setDraft(null);
    setCursor(p);
    commit(slotRange(p, p, slotMinutes));
  };
  const onFocus = () => {
    if (pressFocus.current) pressFocus.current = false;
    else scrollToCell(active);
  };
  // Leaving drops an unfinished keyboard draft; a drag keeps its own until it ends.
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    pressFocus.current = false;
    if (!drag.isDragging() && !event.currentTarget.contains(event.relatedTarget)) setDraft(null);
  };

  // ── Drawing ───────────────────────────────────────────────────────────────
  const names = useMemo(
    () =>
      days.map((day) =>
        Array.from({ length: DAY_MINUTES / slotMinutes }, (_, i) => describeSlot({ day, minute: i * slotMinutes }, locale)),
      ),
    [days, slotMinutes, locale],
  );
  const drafting = draft !== null;
  useEffect(() => onDraftChange?.(drafting), [drafting, onDraftChange]);
  const draftRange = draft ? slotRange(draft.anchor, draft.head, slotMinutes) : null;
  // A pick under way replaces the one picked before, on screen and in the cells' names,
  // until it is picked or dropped.
  const ranges = (draftRange ? [draftRange] : [selection]).filter((r): r is CalendarRange => r !== null && !r.allDay);
  // Per day, the minutes each drawn range covers there.
  const windows = days.map((day) => ranges.map((r) => minutesOn(r, day)).filter((w): w is [number, number] => w !== null));
  const rows = DAY_MINUTES / slotMinutes;
  const activeId = cellId(active);

  return (
    <div
      ref={ref}
      role="grid"
      aria-label={labels.slots}
      aria-multiselectable
      aria-activedescendant={activeId}
      tabIndex={0}
      data-print="hide"
      data-slots=""
      className="r-dates-slots"
      style={{ "--r-dates-slots": rows, "--r-dates-slot": slotMinutes } as CSSProperties}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {Array.from({ length: rows }, (_, r) => {
        const minute = r * slotMinutes;
        return (
          <div key={minute} role="row" className="r-dates-slots-row" style={{ gridRow: r + 1 }}>
            {days.map((day, i) => {
              const selected = (windows[i] ?? []).some(([s, e]) => minute < e && minute + slotMinutes > s);
              const name = names[i]?.[r] ?? "";
              const iso = toISODate(day);
              const id = cellId({ day, minute });
              return (
                <Slot
                  key={iso}
                  id={id}
                  iso={iso}
                  minute={minute}
                  name={selected ? `${name}, ${labels.inSelection}` : name}
                  selected={selected}
                  active={id === activeId}
                />
              );
            })}
          </div>
        );
      })}
      {days.flatMap((day, i) =>
        ranges.map((range, k) => {
          const w = minutesOn(range, day);
          if (!w) return null;
          return (
            <div
              key={`${toISODate(day)}-${k}`}
              aria-hidden
              data-slots-draft={range === draftRange ? "draft" : "selection"}
              data-selection-piece={range === draftRange ? undefined : ""}
              data-continues-before={range.start < startOfDay(day) ? "" : undefined}
              data-continues-after={range.end > addDays(day, 1) ? "" : undefined}
              className="r-dates-event-draft r-dates-slots-piece"
              // `span 1`: an absolutely placed grid item's missing end line is the container's
              // edge, not the next line, so `i + 1` alone would run to the last day.
              style={{ gridColumn: `${i + 1} / span 1`, "--r-dates-start": w[0], "--r-dates-end": w[1] } as CSSProperties}
            />
          );
        }),
      )}
    </div>
  );
}

const Slot = memo(function Slot({
  id,
  iso,
  minute,
  name,
  selected,
  active,
}: {
  id: string;
  iso: string;
  minute: number;
  name: string;
  selected: boolean;
  active: boolean;
}) {
  return (
    <div
      id={id}
      role="gridcell"
      aria-label={name}
      aria-selected={selected}
      data-slot-day={iso}
      data-slot-minute={minute}
      data-active={active ? "" : undefined}
      className="r-dates-slot hover:bg-fg-primary/8"
    />
  );
});
