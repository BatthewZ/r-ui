"use client";

import {
  type ComponentPropsWithRef,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Tooltip } from "../overlays";
import { Avatar, Button, Skeleton } from "../primitives";
import { MISSING } from "../../util/format";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { type LabelsProp, mergeLabels } from "../../util/labels";
import { MARK_TEXT, type Tone, TONE_LABELS, TONE_SUBTLE_BG, TONE_TEXT, ToneGlyph } from "../../util/tone";
import { EmptyState } from "./EmptyState";
import {
  datetimeAttr,
  dayKey,
  formatAbsolute,
  formatDay,
  formatFull,
  formatRelative,
  type ParsedTime,
  parseTime,
  type TimelineTime,
} from "./timeline-time";

export type { TimelineTime } from "./timeline-time";

/** Who did it. A string is a name; an avatar URL is optional (initials otherwise). */
export interface TimelineActor {
  name: string;
  avatar?: string | null;
}

export interface TimelineEvent {
  /** Stable key, unique in the list. */
  id: string;
  /**
   * When it happened: an instant (`Date`, epoch ms, ISO date-time string), or a
   * bare `YYYY-MM-DD` calendar date (local, no time of day). Anything else
   * renders "—" and sorts last.
   */
  time: TimelineTime;
  title: ReactNode;
  /** Longer text, clamped to three lines with a "Read more" toggle when it runs over. */
  description?: ReactNode;
  /** What the event MEANS. A status tone gets a toned mark, its glyph and a visible word. */
  tone?: Tone;
  /** The visible status word; defaults to the tone's word in `labels.tones` ("Error", "Stale"…). */
  statusLabel?: string;
  /** Replaces the tone's glyph in the mark (decorative: the word names the state). */
  icon?: ReactNode;
  actor?: string | TimelineActor;
  /** A short secondary line: service, region, a commit. */
  meta?: ReactNode;
  /** Buttons or links for this event. */
  actions?: ReactNode;
}

export interface TimelineLabels {
  /** The list's "show more events" button. */
  more: string;
  /** A clamped description's toggle, closed and open. */
  expand: string;
  collapse: string;
  /** Empty state title. */
  empty: string;
  /** Announced while `loading`. */
  loading: string;
  /** The day header for events whose time is missing. */
  unknownDay: string;
  /** The scroll region's name when `scrollable` and no `label` is given. */
  region: string;
  /** The visible word per tone, where an event sets no `statusLabel`. Empty: no word (neutral). */
  tones: Record<Tone, string>;
}

export const DEFAULT_TIMELINE_LABELS: TimelineLabels = {
  more: "Show more",
  expand: "Read more",
  collapse: "Show less",
  empty: "No events yet",
  loading: "Loading events",
  unknownDay: "Date unknown",
  region: "Timeline",
  tones: TONE_LABELS,
};

export type TimelineProps = {
  events: readonly TimelineEvent[];
  /** Default `newest-first`. Day groups follow the same order. */
  order?: "newest-first" | "oldest-first";
  /** Group under a sticky header per local day (default). `false`: one flat list. */
  groupByDay?: boolean;
  /**
   * `relative` (default): "5 minutes ago", re-read every minute. `absolute`: the
   * time of day under a day header, date and time otherwise. Either way the
   * element is `<time datetime>`, focusable, with the full date, time and zone in
   * a Tooltip (hover or keyboard focus).
   */
  timeFormat?: "relative" | "absolute";
  /** The reference instant for relative times and Today/Yesterday. Omitted: the clock, ticking per minute. */
  now?: Date | number;
  /** BCP 47 locale for every date, time and relative word. Omitted: the runtime default. */
  locale?: string;
  /** Day headers as headings at this level. Default: plain text that names its day's list. */
  headingLevel?: 2 | 3 | 4 | 5 | 6;
  /** Accessible name: of the scroll region when `scrollable`, else of the list when ungrouped. */
  label?: string;
  /**
   * The timeline is its own scroller: a keyboard-focusable, labelled region the
   * day headers stick to the top of. Give it a block size (`className="max-h-…"`).
   */
  scrollable?: boolean;
  /** Show this many events, and that many more per "Show more" press. */
  pageSize?: number;
  /** More events exist beyond `events`: "Show more" (after any local pages) calls `onLoadMore`. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  /** `onLoadMore` is in flight: the button is busy and the list `aria-busy`. */
  loadingMore?: boolean;
  /** First load: skeleton rows and one announced status, instead of the events. */
  loading?: boolean;
  /** Replaces the default empty state. */
  empty?: ReactNode;
  labels?: LabelsProp<TimelineLabels>;
  classNames?: SlotClassNames<"day" | "list" | "item" | "mark" | "title" | "time" | "description" | "footer">;
} & Omit<ComponentPropsWithRef<"div">, "children">;

interface Prepared {
  event: TimelineEvent;
  time: ParsedTime;
  valid: boolean;
  /** Position in the sorted, paged list (the reveal focus target). */
  index: number;
}

interface Group {
  key: string;
  ms: number;
  items: Prepared[];
}

/** Ticks once a minute while relative times are on screen and no `now` is given. */
function useNow(fixed: Date | number | undefined, ticking: boolean): number {
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    if (fixed !== undefined || !ticking) return;
    const id = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [fixed, ticking]);
  return fixed === undefined ? clock : fixed instanceof Date ? fixed.getTime() : fixed;
}

/**
 * Events in time: a semantic ordered list, a connector down the start edge and a
 * mark per event. A status tone is drawn three ways (the tone's glyph in its
 * mark colour, a visible word in its text-safe ink, and the disc behind it), so
 * it never rests on colour; an event with no state gets a plain dot.
 *
 * Grouped by local day (sticky day headers, on the contract's raised layer),
 * newest or oldest first, relative or absolute times with the full reading on
 * hover and focus. Long descriptions clamp to three lines with a toggle; `pageSize` and
 * `onLoadMore` page the list behind one "Show more" button; `loading` and an
 * empty list each have their own state. Density, input and RTL follow the
 * tokens and logical properties.
 */
export function Timeline({
  events,
  order = "newest-first",
  groupByDay = true,
  timeFormat = "relative",
  now: nowProp,
  locale,
  headingLevel,
  label,
  scrollable = false,
  pageSize,
  hasMore = false,
  onLoadMore,
  loadingMore = false,
  loading = false,
  empty,
  labels: labelsProp,
  classNames,
  className,
  ref,
  ...rest
}: TimelineProps) {
  const labels = mergeLabels(DEFAULT_TIMELINE_LABELS, labelsProp);
  const now = useNow(nowProp, timeFormat === "relative" || groupByDay);
  const baseId = useId();

  const sorted = useMemo(() => {
    const dir = order === "newest-first" ? -1 : 1;
    return events
      .map((event) => {
        const time = parseTime(event.time);
        return { event, time, valid: Number.isFinite(time.ms) };
      })
      .sort((a, b) => {
        // Missing times last, whatever the order; equal times keep the caller's order.
        if (a.valid !== b.valid) return a.valid ? -1 : 1;
        return a.valid && b.valid ? (a.time.ms - b.time.ms) * dir : 0;
      });
  }, [events, order]);

  const step = pageSize && pageSize > 0 ? Math.floor(pageSize) : undefined;
  const [shown, setShown] = useState(step ?? Number.POSITIVE_INFINITY);
  const visible: Prepared[] = sorted.slice(0, step ? shown : undefined).map((p, index) => ({ ...p, index }));
  const hiddenLocally = sorted.length - visible.length;
  const canShowMore = hiddenLocally > 0 || (hasMore && Boolean(onLoadMore));

  // "Show more" moves no focus while it stays; once a press has revealed (or
  // loaded) the last page the button is gone, and focus goes to the first new
  // event rather than to <body>.
  const [revealFrom, setRevealFrom] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (revealFrom === null || canShowMore || !root) return;
    const active = document.activeElement;
    if (active && active !== document.body && !root.contains(active)) return;
    root.querySelector<HTMLElement>(`[data-timeline-index="${revealFrom}"]`)?.focus();
  }, [revealFrom, canShowMore]);

  const showMore = () => {
    setRevealFrom(visible.length);
    // A page past what is loaded too, so the events this press loads show when they land.
    if (step) setShown(visible.length + step);
    if (hiddenLocally === 0) onLoadMore?.();
  };

  const groups: Group[] = [];
  for (const p of visible) {
    const key = groupByDay ? (p.valid ? dayKey(p.time.ms) : "unknown") : "all";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(p);
    else groups.push({ key, ms: p.time.ms, items: [p] });
  }

  const mergedRef = useMemo(() => mergeRefs(rootRef, ref), [ref]);
  const Heading = headingLevel ? (`h${headingLevel}` as const) : "div";
  const region = scrollable ? { role: "region", tabIndex: 0, "aria-label": label ?? labels.region } : {};

  let body: ReactNode;
  if (loading) {
    body = (
      <ol className={cn("r-data-timeline-list", classNames?.list)} aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i} className={cn("r-data-timeline-item", classNames?.item)}>
            <span className="r-data-timeline-rail">
              <span className="r-data-timeline-mark">
                <Skeleton shape="block" className="size-full rounded-full" />
              </span>
              <span className="r-data-timeline-line" />
            </span>
            <span className="r-data-timeline-body flex flex-col gap-r5">
              <Skeleton className="text-body-1 w-3/5" />
              <Skeleton className="text-body-2" lines={2} />
            </span>
          </li>
        ))}
      </ol>
    );
  } else if (sorted.length === 0) {
    body = empty ?? <EmptyState title={labels.empty} className="py-r2" />;
  } else {
    body = groups.map((group) => {
      const dayId = `${baseId}-day-${group.key}`;
      const list = (
        <ol
          className={cn("r-data-timeline-list", classNames?.list)}
          aria-labelledby={groupByDay ? dayId : undefined}
          aria-label={groupByDay ? undefined : scrollable ? undefined : label}
        >
          {group.items.map((p) => (
            <TimelineItem
              key={p.event.id}
              prepared={p}
              now={now}
              locale={locale}
              grouped={groupByDay}
              timeFormat={timeFormat}
              labels={labels}
              classNames={classNames}
              titleId={`${baseId}-title-${p.index}`}
              focusTarget={p.index === revealFrom}
            />
          ))}
        </ol>
      );
      if (!groupByDay) return <div key={group.key}>{list}</div>;
      return (
        <div key={group.key} className="r-data-timeline-group">
          <Heading
            id={dayId}
            className={cn(
              "sticky top-0 z-raised border-b border-border bg-surface-0 py-r5 text-body-3 font-medium text-fg-secondary",
              classNames?.day,
            )}
            data-timeline-day=""
          >
            {group.key === "unknown" ? (
              labels.unknownDay
            ) : (
              <time dateTime={group.key}>{formatDay(group.ms, now, locale)}</time>
            )}
          </Heading>
          {list}
        </div>
      );
    });
  }

  return (
    <div
      ref={mergedRef}
      {...region}
      {...rest}
      aria-busy={loading || loadingMore || undefined}
      data-timeline=""
      className={cn("flex min-w-0 flex-col", scrollable && "overflow-y-auto overscroll-contain", className)}
    >
      {loading && <span role="status" className="sr-only">{labels.loading}</span>}
      {body}
      {!loading && canShowMore && (
        <div data-print="hide" className={cn("flex justify-center pt-r4", classNames?.footer)}>
          <Button variant="secondary" loading={loadingMore} onClick={showMore}>
            {labels.more}
          </Button>
        </div>
      )}
    </div>
  );
}

function actorOf(actor: TimelineEvent["actor"]): TimelineActor | undefined {
  if (actor === undefined) return undefined;
  const a = typeof actor === "string" ? { name: actor } : actor;
  return a.name.trim() ? a : undefined;
}

function TimelineItem({
  prepared,
  now,
  locale,
  grouped,
  timeFormat,
  labels,
  classNames,
  titleId,
  focusTarget,
}: {
  prepared: Prepared;
  now: number;
  locale?: string;
  grouped: boolean;
  timeFormat: "relative" | "absolute";
  labels: TimelineLabels;
  classNames: TimelineProps["classNames"];
  titleId: string;
  focusTarget: boolean;
}) {
  const { event, time, valid, index } = prepared;
  const tone = event.tone ?? "neutral";
  const word = event.statusLabel ?? labels.tones[tone];
  const actor = actorOf(event.actor);
  const disc = tone !== "neutral" || event.icon !== undefined;

  return (
    <li
      className={cn("r-data-timeline-item", classNames?.item)}
      data-tone={tone}
      data-timeline-index={index}
      tabIndex={focusTarget ? -1 : undefined}
    >
      <span className="r-data-timeline-rail" aria-hidden>
        <span
          className={cn(
            "r-data-timeline-mark",
            disc && cn("border border-transparent", TONE_SUBTLE_BG[tone], MARK_TEXT[tone]),
            classNames?.mark,
          )}
          data-timeline-mark=""
        >
          {disc ? (event.icon ?? <ToneGlyph tone={tone} />) : <span className="r-data-timeline-dot" />}
        </span>
        <span className="r-data-timeline-line" />
      </span>
      <div className="r-data-timeline-body flex min-w-0 flex-col gap-r6">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-r3 gap-y-r6">
          <div
            id={titleId}
            className={cn("min-w-0 grow basis-column-sm break-words text-body-1 font-medium text-fg-primary", classNames?.title)}
          >
            {event.title}
          </div>
          {valid ? (
            // Focusable so a keyboard reaches the full reading too (a `title` is pointer-only).
            <Tooltip content={formatFull(time, locale)}>
              <time
                dateTime={datetimeAttr(time)}
                tabIndex={0}
                className={cn("shrink-0 whitespace-nowrap rounded-sm text-body-3 text-fg-muted", classNames?.time)}
              >
                {timeFormat === "relative" ? formatRelative(time, now, locale) : formatAbsolute(time, { grouped, locale })}
              </time>
            </Tooltip>
          ) : (
            <span className={cn("shrink-0 text-body-3 text-fg-muted", classNames?.time)}>{MISSING}</span>
          )}
        </div>
        {(word || actor || event.meta) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-r3 gap-y-r6 text-body-2 text-fg-secondary">
            {word && (
              <span className={cn("font-medium", TONE_TEXT[tone])} data-timeline-status="">
                {word}
              </span>
            )}
            {actor && (
              <span className="inline-flex min-w-0 max-w-full items-center gap-r5">
                <Avatar size="icon" name={actor.name} src={actor.avatar} alt="" />
                <span className="min-w-0 break-words">{actor.name}</span>
              </span>
            )}
            {event.meta && <span className="min-w-0 max-w-full break-words">{event.meta}</span>}
          </div>
        )}
        {event.description !== undefined && event.description !== null && event.description !== "" && (
          <Description titleId={titleId} labels={labels} className={classNames?.description}>
            {event.description}
          </Description>
        )}
        {event.actions && <div className="flex min-w-0 flex-wrap items-center gap-r5 pt-r6">{event.actions}</div>}
      </div>
    </li>
  );
}

/**
 * Clamped to three lines; the toggle appears only when the text actually runs
 * over, measured (and re-measured on a width change) while clamped.
 */
function Description({
  titleId,
  labels,
  className,
  children,
}: {
  titleId: string;
  labels: TimelineLabels;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight - el.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, children]);

  return (
    <div className="flex min-w-0 flex-col items-start gap-r6">
      <div
        ref={ref}
        id={id}
        data-clamped={expanded ? undefined : ""}
        className={cn("r-data-timeline-description min-w-0 max-w-full break-words text-body-2 text-fg-secondary", className)}
      >
        {children}
      </div>
      {(overflows || expanded) && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          aria-describedby={titleId}
          onClick={() => setExpanded((e) => !e)}
          className="hit-area rounded-sm text-body-2 font-medium text-fg-accent hover:underline"
        >
          {expanded ? labels.collapse : labels.expand}
        </button>
      )}
    </div>
  );
}

/** One "actor verb object" entry of an `ActivityFeed`. */
export interface ActivityItem extends Omit<TimelineEvent, "title" | "actor"> {
  actor: string | TimelineActor;
  /** "merged", "commented on", "rolled back". */
  verb: ReactNode;
  /** What it was done to: "PR #482", "checkout v5.3.1". */
  object?: ReactNode;
}

export type ActivityFeedProps = Omit<TimelineProps, "events"> & { items: readonly ActivityItem[] };

/**
 * A preset of `Timeline`, not a second component: each item's title is the
 * sentence "avatar Actor verb object", and the actor moves out of the meta line
 * into it. Everything else (grouping, marks, paging, states) is the Timeline's.
 */
export function ActivityFeed({ items, ...props }: ActivityFeedProps) {
  const events = useMemo(
    () =>
      items.map(({ actor, verb, object, ...event }): TimelineEvent => {
        const who = typeof actor === "string" ? { name: actor } : actor;
        return {
          ...event,
          title: (
            <span className="inline-flex max-w-full flex-wrap items-center gap-x-r5 gap-y-r6 font-normal text-fg-secondary">
              <Avatar size="icon" name={who.name} src={who.avatar} alt="" />
              <span className="min-w-0 break-words font-medium text-fg-primary">{who.name}</span>
              <span>{verb}</span>
              {object !== undefined && <span className="min-w-0 break-words font-medium text-fg-primary">{object}</span>}
            </span>
          ),
        };
      }),
    [items],
  );
  return <Timeline {...props} events={events} />;
}
