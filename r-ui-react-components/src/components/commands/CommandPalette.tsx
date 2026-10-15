"use client";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { ErrorLine } from "../../util/error-line";
import { type LabelsProp, mergeLabels } from "../../util/labels";
import { cn, type SlotClassNames } from "../../util/style";
import { MatchText } from "../../util/text-match";
import { Input } from "../form";
import { Dialog, type DialogContentProps } from "../overlays";
import { IconButton, Kbd, Spinner } from "../primitives";
import { listCommands, type ListItem } from "./command-filter";
import { usePageCommands, useSearchResults } from "./command-sources";

/** One thing the palette can do. */
export interface CommandPaletteCommand {
  /** Unique across the palette (recent commands are remembered by it). */
  id: string;
  label: string;
  /** Commands sharing a group are listed under its heading. */
  group?: string;
  /** Extra words that find it ("appearance" for "Change theme…"). Not shown. */
  keywords?: readonly string[];
  /** Display only: one key cap per entry (`["⌘", "D"]`). */
  shortcut?: string | readonly string[];
  /** Decorative leading icon. */
  icon?: ReactNode;
  disabled?: boolean;
  /** Runs once the palette has closed and handed focus back. */
  onSelect?: () => void;
  /** Opens a nested list instead of running ("Change theme…"). */
  page?: CommandPalettePage;
}

/** Commands now, or loaded once when their page first opens (cached for the palette's lifetime). */
export type CommandPaletteCommands =
  | readonly CommandPaletteCommand[]
  | ((options: { signal: AbortSignal }) => Promise<readonly CommandPaletteCommand[]>);

/** Results for what was typed (a server search). Called after a short pause; not filtered again. */
export type CommandPaletteSearch = (
  query: string,
  options: { signal: AbortSignal },
) => Promise<readonly CommandPaletteCommand[]>;

/** A nested list. Backspace in the empty field, or the back button, returns to the one before. */
export interface CommandPalettePage {
  /** Shown beside the field. Default: the command's label, without a trailing "…". */
  title?: string;
  placeholder?: string;
  commands?: CommandPaletteCommands;
  search?: CommandPaletteSearch;
}

/** The palette's own words. */
export interface CommandPaletteLabels {
  /** The dialog's accessible name. */
  label: string;
  inputLabel: string;
  placeholder: string;
  listLabel: string;
  recent: string;
  back: string;
  loading: string;
  error: string;
  empty: (query: string) => string;
  /** Announced as the results change. */
  count: (count: number) => string;
  navigate: string;
  run: string;
  close: string;
}

export const DEFAULT_COMMAND_PALETTE_LABELS: Readonly<CommandPaletteLabels> = {
  label: "Command palette",
  inputLabel: "Search commands",
  placeholder: "Type a command or search…",
  listLabel: "Commands",
  recent: "Recent",
  back: "Back",
  loading: "Loading…",
  error: "Could not load commands.",
  empty: (query) => (query ? `No commands match “${query}”` : "No commands"),
  count: (count) => (count === 1 ? "1 command" : `${count} commands`),
  navigate: "Navigate",
  run: "Run",
  close: "Close",
};

export interface CommandPaletteProps
  extends Omit<DialogContentProps, "children" | "role" | "showClose" | "labels" | "classNames"> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  commands: CommandPaletteCommands;
  search?: CommandPaletteSearch;
  /** The root commands are still arriving (fetched by the caller). */
  loading?: boolean;
  /** Ids of recently run commands, newest first, listed when the field is empty. In memory by default. */
  recent?: readonly string[];
  defaultRecent?: readonly string[];
  /** Persist recent commands here (localStorage, a user profile) and pass them back as `defaultRecent`. */
  onRecentChange?: (recent: string[]) => void;
  /** @default 5 */
  recentLimit?: number;
  /** @default 150 */
  searchDelayMs?: number;
  labels?: LabelsProp<CommandPaletteLabels>;
  classNames?: SlotClassNames<"input" | "list" | "group" | "option" | "footer">;
}

interface PaletteEntry {
  command: CommandPaletteCommand;
  /** Titles of the pages it was found on, for a recent command listed out of its page. */
  trail: string[];
}

/**
 * A command launcher: a modal (the library's Dialog, so focus, scroll lock,
 * scrim and exit come from there) holding a search field that drives a grouped
 * list of commands (WAI-ARIA combobox + listbox). DOM focus stays in the field;
 * the highlighted command is `aria-activedescendant`.
 *
 * Arrows, Home and End move; Enter runs the highlighted command, closes and
 * returns focus to where it was (then the command runs); Escape closes. A
 * command with a `page` opens a nested list; Backspace in the empty field goes
 * back. Typing ranks: label prefix, then word start, then anywhere, all words,
 * keywords, then scattered letters ("cht" → "Change theme").
 *
 * Open it from a button or with `useCommandPaletteShortcut`.
 */
function CommandPaletteRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  commands,
  search,
  loading = false,
  recent: recentProp,
  defaultRecent = [],
  onRecentChange,
  recentLimit = 5,
  searchDelayMs = 150,
  labels: labelsProp,
  className,
  classNames,
  ...props
}: CommandPaletteProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [recent, setRecent] = useControllableState<readonly string[]>({
    value: recentProp,
    defaultValue: defaultRecent,
    onChange: (next) => onRecentChange?.([...next]),
  });
  const labels = mergeLabels(DEFAULT_COMMAND_PALETTE_LABELS, labelsProp);
  // Every command the palette has listed, so a recent id resolves after its page closed.
  const seen = useRef(new Map<string, PaletteEntry>());
  // Loaded command lists, by loader: a page opened twice loads once.
  const loaded = useRef(new WeakMap<object, readonly CommandPaletteCommand[]>());
  const pendingRun = useRef<(() => void) | null>(null);

  // Static commands on static pages, so a recent one from a nested page is
  // listed even before that page has been opened this session.
  const known = useMemo(() => {
    const map = new Map<string, PaletteEntry>();
    const walk = (list: CommandPaletteCommands | undefined, trail: string[]) => {
      if (typeof list === "function" || !list) return;
      for (const command of list) {
        map.set(command.id, { command, trail });
        if (command.page) walk(command.page.commands, [...trail, pageTitle(command)]);
      }
    };
    walk(commands, []);
    return map;
  }, [commands]);

  // After the dialog has closed and focus is home: a command that moves focus
  // (opens a dialog, focuses a field) is not overridden by the return.
  useLayoutEffect(() => {
    if (open || !pendingRun.current) return;
    const run = pendingRun.current;
    pendingRun.current = null;
    run();
  }, [open]);

  const run = (entry: PaletteEntry) => {
    const { command } = entry;
    seen.current.set(command.id, entry);
    setRecent([command.id, ...recent.filter((id) => id !== command.id)].slice(0, recentLimit));
    pendingRun.current = command.onSelect ?? null;
    setOpen(false);
  };

  const recentEntries = recent.flatMap((id) => {
    const entry = known.get(id) ?? seen.current.get(id);
    return entry && !entry.command.page ? [entry] : [];
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Dialog.Content
        aria-label={labels.label}
        showClose={false}
        {...props}
        className={cn(
          "r-commands-palette mt-[calc(var(--R-SIZE-1)*3)] mb-auto gap-0 overflow-hidden p-0",
          className,
        )}
      >
        <PaletteBody
          root={{ commands, search }}
          rootLoading={loading}
          recent={recentEntries}
          seen={seen}
          loaded={loaded}
          searchDelayMs={searchDelayMs}
          labels={labels}
          classNames={classNames}
          onRun={run}
        />
      </Dialog.Content>
    </Dialog>
  );
}

const pageTitle = (command: CommandPaletteCommand) => command.page?.title ?? command.label.replace(/\s*(…|\.\.\.)$/u, "");

interface PageState {
  page: CommandPalettePage;
  title: string;
  /** The query and highlight to restore when coming back to this page. */
  query: string;
  activeKey: string | null;
}

/** Scrolls `list` the least that shows `option`; the first option of a group brings its heading. */
function scrollIntoList(list: HTMLElement, option: HTMLElement) {
  const group = option.parentElement?.getAttribute("role") === "group" ? option.parentElement : null;
  const first = group && group.querySelector('[role="option"]') === option ? group : option;
  const view = list.getBoundingClientRect();
  const top = first.getBoundingClientRect().top - view.top + list.scrollTop;
  const bottom = option.getBoundingClientRect().bottom - view.top + list.scrollTop;
  if (top < list.scrollTop) list.scrollTop = top;
  else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
}

const FIRST = "\u0000first";

interface PaletteBodyProps {
  root: CommandPalettePage;
  rootLoading: boolean;
  recent: PaletteEntry[];
  seen: RefObject<Map<string, PaletteEntry>>;
  loaded: RefObject<WeakMap<object, readonly CommandPaletteCommand[]>>;
  searchDelayMs: number;
  labels: CommandPaletteLabels;
  classNames: CommandPaletteProps["classNames"];
  onRun: (entry: PaletteEntry) => void;
}

/** Mounted per open (the Dialog mounts its children only while shown), so every open starts on the root page. */
function PaletteBody({ root, rootLoading, recent, seen, loaded, searchDelayMs, labels, classNames, onRun }: PaletteBodyProps) {
  const [stack, setStack] = useState<PageState[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<{ key: string | null; source: "keyboard" | "pointer" | "auto" }>({
    key: FIRST,
    source: "auto",
  });
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Where the root page was, restored on the way back to it.
  const rootState = useRef<{ query: string; activeKey: string | null }>({ query: "", activeKey: null });

  const current = stack[stack.length - 1];
  const page = current?.page ?? root;
  const own = usePageCommands(page.commands, loaded);
  const found = useSearchResults(page.search, query, searchDelayMs, current);
  const trimmed = query.trim();

  const groups = useMemo(
    () =>
      listCommands({
        own: own.commands,
        found: found.commands,
        query: trimmed,
        trail: stack.map((entry) => entry.title),
        // Recent commands are listed on the root page only.
        recent: stack.length === 0 ? recent : [],
        recentLabel: labels.recent,
      }),
    [own.commands, found.commands, trimmed, stack, recent, labels.recent],
  );

  // Remember what was listed, so a recent command resolves once its page is gone.
  useEffect(() => {
    for (const group of groups) {
      for (const item of group.items) if (!item.key.startsWith("r:")) seen.current.set(item.command.id, item);
    }
  }, [groups, seen]);

  const items = groups.flatMap((group) => group.items);
  // A fresh list highlights its first ENABLED command, so Enter right away runs
  // something; from there arrows land on disabled ones too (read as unavailable).
  const activeItem =
    (active.key === FIRST ? undefined : items.find((item) => item.key === active.key)) ??
    items.find((item) => !item.command.disabled);
  const activeIndex = activeItem ? items.indexOf(activeItem) : -1;
  // From the command's key, never its position: the id an assistive tech holds
  // through `aria-activedescendant` must name the same command after a re-filter.
  const optionId = (key: string) => `${listboxId}-o-${encodeURIComponent(key)}`;
  const loading = own.status === "loading" || found.status === "loading" || (stack.length === 0 && rootLoading);
  const failed = own.status === "error" || found.status === "error";

  // Keep the keyboard's command in view (never the pointer's: the list would
  // scroll under it). The first command of a group brings its heading.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !activeItem || active.source === "pointer") return;
    const option = list.ownerDocument.getElementById(optionId(activeItem.key));
    if (option) scrollIntoList(list, option);
  }, [activeItem?.key, active.source, listboxId]);

  const move = (to: "next" | "prev" | "first" | "last") => {
    if (items.length === 0) return;
    const at = activeIndex;
    const next =
      to === "first"
        ? 0
        : to === "last"
          ? items.length - 1
          : at < 0
            ? to === "next" ? 0 : items.length - 1
            : (at + (to === "next" ? 1 : -1) + items.length) % items.length;
    setActive({ key: items[next]?.key ?? null, source: "keyboard" });
  };

  const choose = (item: ListItem) => {
    if (item.command.disabled) return;
    const next = item.command.page;
    if (!next) {
      onRun({ command: item.command, trail: item.trail });
      return;
    }
    // The page being left keeps its query and highlight for the way back.
    const left = { query, activeKey: item.key };
    const entered: PageState = { page: next, title: pageTitle(item.command), query: "", activeKey: null };
    if (current) setStack([...stack.slice(0, -1), { ...current, ...left }, entered]);
    else {
      rootState.current = left;
      setStack([entered]);
    }
    setQuery("");
    setActive({ key: FIRST, source: "auto" });
    inputRef.current?.focus();
  };

  const back = () => {
    if (!current) return;
    const rest = stack.slice(0, -1);
    const previous = rest[rest.length - 1] ?? rootState.current;
    setStack(rest);
    setQuery(previous.query);
    setActive({ key: previous.activeKey ?? FIRST, source: "keyboard" });
    // The back button is about to unmount; the field keeps focus either way.
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        move(event.key === "ArrowDown" ? "next" : "prev");
        return;
      case "Home":
      case "End":
        if (event.shiftKey || items.length === 0) return;
        event.preventDefault();
        move(event.key === "Home" ? "first" : "last");
        return;
      case "Enter":
        event.preventDefault();
        if (activeItem) choose(activeItem);
        return;
      case "Backspace":
        if (query !== "" || !current) return;
        event.preventDefault();
        back();
        return;
    }
  };

  const status = loading ? labels.loading : failed ? labels.error : labels.count(items.length);
  const message = "flex min-h-row items-center gap-r4 px-r4 py-r6 text-body-2";

  return (
    <>
      <div className="shrink-0 p-r4">
        <Input
          ref={inputRef}
          role="combobox"
          aria-label={labels.inputLabel}
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeItem ? optionId(activeItem.key) : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder={page.placeholder ?? labels.placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive({ key: FIRST, source: "auto" });
          }}
          onKeyDown={onKeyDown}
          className={classNames?.input}
          start={
            current ? (
              <span className="flex min-w-0 shrink items-center gap-r5">
                <IconButton label={labels.back} icon={<ArrowLeft className="rtl:-scale-x-100" />} onClick={back} />
                <span className="max-w-[calc(var(--ROW-H)*4)] truncate rounded-sm border border-border px-r5 text-body-3 text-fg-secondary">
                  {current.title}
                </span>
              </span>
            ) : (
              <Search aria-hidden className="size-icon text-fg-muted" />
            )
          }
          end={loading ? <Spinner className="text-fg-muted" /> : undefined}
        />
      </div>
      <div role="status" className="sr-only">
        {status}
      </div>
      <div
        ref={listRef}
        // Options are not focusable: a press must not take focus from the field.
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "relative min-h-0 max-h-[calc(var(--ROW-H)*9)] flex-1 overflow-y-auto overscroll-contain px-r4 pb-r4",
          classNames?.list,
        )}
      >
        {failed && <ErrorLine className="px-r4 py-r6">{labels.error}</ErrorLine>}
        {items.length === 0 && loading && (
          <div className={cn(message, "text-fg-secondary")}>
            <Spinner />
            {labels.loading}
          </div>
        )}
        {items.length === 0 && !loading && !failed && (
          <div className={cn(message, "text-fg-muted")}>{labels.empty(trimmed)}</div>
        )}
        <div id={listboxId} role="listbox" aria-label={labels.listLabel}>
          {groups.map((group) => {
            const headerId = `${listboxId}-g-${encodeURIComponent(group.key)}`;
            const options = group.items.map((item) => {
              const isActive = item === activeItem;
              return (
                <Option
                  key={item.key}
                  id={optionId(item.key)}
                  item={item}
                  showTrail={item.key.startsWith("r:")}
                  active={isActive ? (active.source === "pointer" ? "pointer" : "keyboard") : undefined}
                  className={classNames?.option}
                  onHover={() => {
                    if (!item.command.disabled && !isActive) setActive({ key: item.key, source: "pointer" });
                  }}
                  onChoose={() => choose(item)}
                />
              );
            });
            if (group.label === undefined) return <div key={group.key}>{options}</div>;
            return (
              <div key={group.key} role="group" aria-labelledby={headerId} className={classNames?.group}>
                <div
                  id={headerId}
                  role="presentation"
                  className="flex items-end truncate px-r4 pb-r6 pt-r4 text-body-3 font-medium text-fg-muted"
                >
                  {group.label}
                </div>
                {options}
              </div>
            );
          })}
        </div>
      </div>
      <div
        aria-hidden
        className={cn(
          "flex shrink-0 flex-wrap items-center gap-x-r3 gap-y-r6 border-t border-border px-r4 py-r5 text-body-3 text-fg-muted",
          classNames?.footer,
        )}
      >
        <Hint keys={["↑", "↓"]}>{labels.navigate}</Hint>
        <Hint keys={["↵"]}>{labels.run}</Hint>
        {current && <Hint keys={["⌫"]}>{labels.back}</Hint>}
        <Hint keys={["Esc"]}>{labels.close}</Hint>
      </div>
    </>
  );
}

function Hint({ keys, children }: { keys: string[]; children: ReactNode }) {
  return (
    <span className="flex items-center gap-r6">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      <span className="ms-r6">{children}</span>
    </span>
  );
}

function Option({
  id,
  item,
  showTrail,
  active,
  className,
  onHover,
  onChoose,
}: {
  id: string;
  item: ListItem;
  showTrail: boolean;
  active: "keyboard" | "pointer" | undefined;
  className?: string;
  onHover: () => void;
  onChoose: () => void;
}) {
  const { command } = item;
  const keys = command.shortcut === undefined ? [] : typeof command.shortcut === "string" ? [command.shortcut] : command.shortcut;
  return (
    <div
      id={id}
      role="option"
      aria-selected={active !== undefined}
      aria-disabled={command.disabled || undefined}
      data-active={active}
      onPointerMove={onHover}
      onClick={() => {
        if (!command.disabled) onChoose();
      }}
      className={cn(
        "r-commands-palette-option relative flex min-h-row cursor-default select-none items-center gap-r4 rounded-sm px-r4 py-r6 text-body-1 text-fg-primary",
        // The wash alone is a weak cue: the row also takes an accent bar (styles.css),
        // and under forced colours the selection fill.
        "data-[active]:bg-fg-primary/8 forced-colors:data-[active]:bg-selection aria-disabled:opacity-disabled",
        className,
      )}
    >
      {command.icon && (
        <span aria-hidden className="flex shrink-0 text-fg-secondary [&>svg]:size-icon">
          {command.icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">
        {showTrail && item.trail.length > 0 && <span className="text-fg-muted">{item.trail.join(" › ")} › </span>}
        <MatchText text={command.label} ranges={item.ranges} />
      </span>
      {keys.length > 0 && (
        <kbd className="flex shrink-0 gap-r6">
          {keys.map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </kbd>
      )}
      {command.page && <ChevronRight aria-hidden className="size-icon shrink-0 text-fg-muted rtl:-scale-x-100" />}
    </div>
  );
}

export const CommandPalette = CommandPaletteRoot;

