"use client";
import { ChevronDown } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useFloating } from "../../hooks/use-floating";
import { isRtl } from "../../util/direction";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { useIsCurrent, useLinkElement, useRouter } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { topLayerExit, useExitPresence } from "../overlays/internal";

/** One destination in a panel. */
export interface NavigationMenuLink {
  /** Unique among its siblings. Default: `href`. */
  id?: string;
  label: ReactNode;
  href: string;
  /** A line under the label. It describes the link (`aria-describedby`); the label alone names it. */
  description?: ReactNode;
  /** Decorative glyph before the label. */
  icon?: ReactNode;
  /** This is the page being shown. Unset, the `RouterProvider`'s `isCurrent(href)` decides. */
  current?: boolean;
}

/** A titled column of a mega panel. */
export interface NavigationMenuColumn {
  id: string;
  /** The column's heading; it names the column's list. */
  title?: ReactNode;
  links: readonly NavigationMenuLink[];
}

interface ItemBase {
  /** Unique in the menu; it is the value of `open`. */
  id: string;
  label: ReactNode;
}

/** A plain top-level link. */
export interface NavigationMenuLinkItem extends ItemBase {
  href: string;
  current?: boolean;
  links?: never;
  columns?: never;
}

/** A button opening a dropdown: one list of links. */
export interface NavigationMenuListItem extends ItemBase {
  links: readonly NavigationMenuLink[];
  href?: never;
  columns?: never;
}

/** A button opening a mega panel: titled columns and an optional featured slot. */
export interface NavigationMenuMegaItem extends ItemBase {
  columns: readonly NavigationMenuColumn[];
  /** Anything beside the columns (a card with its own link); it follows them in the tab order. */
  featured?: ReactNode;
  href?: never;
  links?: never;
}

export type NavigationMenuItem = NavigationMenuLinkItem | NavigationMenuListItem | NavigationMenuMegaItem;

/** Every link an item's panel holds, columns flattened in order (none for a plain link). */
export function navigationMenuLinks(item: NavigationMenuItem): readonly NavigationMenuLink[] {
  if (item.links) return item.links;
  if (item.columns) return item.columns.flatMap((column) => column.links);
  return [];
}

export interface NavigationMenuLabels {
  /** The navigation landmark's name. */
  navigation: string;
}

export const DEFAULT_NAVIGATION_MENU_LABELS: NavigationMenuLabels = { navigation: "Main" };

declare module "../../util/locale" {
  interface LabelsRegistry {
    NavigationMenu: NavigationMenuLabels;
  }
}

type NavigationMenuSlot =
  | "list"
  | "item"
  | "trigger"
  | "link"
  | "panel"
  | "panelLink"
  | "column"
  | "columnTitle"
  | "featured";

export type NavigationMenuProps = Omit<ComponentPropsWithRef<"nav">, "children"> & {
  items: readonly NavigationMenuItem[];
  /** The open item's `id`, `null` for none. Controlled when not `undefined`. */
  open?: string | null;
  defaultOpen?: string | null;
  onOpenChange?: (open: string | null) => void;
  /** Hover intent: how long a fine pointer rests on a closed menu's button before its panel opens, in ms. @default 150 */
  openDelay?: number;
  /** How long a hover-opened panel waits once the pointer has left it and its button, in ms. @default 300 */
  closeDelay?: number;
  /**
   * The box a mega panel lines up under and spans (a site header's bar).
   * Default: the menu itself. A dropdown always opens under its own button.
   */
  anchorRef?: RefObject<HTMLElement | null>;
  labels?: LabelsProp<NavigationMenuLabels>;
  classNames?: SlotClassNames<NavigationMenuSlot>;
};

type OpenReason = "hover" | "press";

/** After a panel closes, the pointer reaching another button within this long opens it at once. */
const SKIP_DELAY_MS = 300;

const TOP_ITEM =
  "r-marketing-nav-top relative inline-flex h-control max-w-full items-center gap-r6 rounded-md px-r4 text-body-1 font-medium whitespace-nowrap text-fg-secondary transition-colors hover:text-fg-primary aria-expanded:text-fg-primary aria-[current=page]:text-fg-primary data-current:text-fg-primary";

/** A top-level label truncates when the bar is short of room; a plain-text one shows in full on hover. */
const labelTitle = (label: ReactNode) => (typeof label === "string" ? label : undefined);

const onlyMouse = (handler: () => void) => (event: PointerEvent) => {
  if (event.pointerType === "mouse") handler();
};

interface MenuApi {
  openId: string | null;
  rootRef: RefObject<HTMLElement | null>;
  anchorRef: RefObject<HTMLElement | null> | undefined;
  triggers: Map<string, HTMLButtonElement>;
  pendingFocus: RefObject<{ id: string; edge: Edge } | null>;
  classNames: NavigationMenuProps["classNames"];
  press: (id: string) => void;
  close: () => void;
  hoverTrigger: (id: string) => void;
  hoverLink: () => void;
  hoverPanel: () => void;
  leave: () => void;
  /** Focus has gone into an item's panel: the keyboard holds it now, so the pointer leaving does not close it. */
  pin: (id: string) => void;
}

type Edge = "first" | "last";

const panelLinks = (panel: Element | null) => [...(panel?.querySelectorAll<HTMLElement>("[data-nav-link]") ?? [])];

function focusEdge(panel: Element | null, edge: Edge) {
  const links = panelLinks(panel);
  (edge === "first" ? links[0] : links.at(-1))?.focus({ preventScroll: true });
}

/**
 * A site's top navigation: plain links and buttons that open panels of links,
 * a dropdown (one list) or a mega panel (titled columns and a featured slot).
 *
 * - The APG **disclosure navigation** pattern, not a menu: every destination is
 *   a link, each button has `aria-expanded` and `aria-controls`, and a panel is
 *   rendered right after its button, so Tab walks from the button into its
 *   links and on to the next item. Enter or Space toggles a panel; Escape
 *   closes it and returns focus to its button; focus leaving an item closes its
 *   panel. Arrow keys are a shortcut on top: Left and Right (mirrored in RTL),
 *   Home and End move between the top-level items; Down or Up on a button opens
 *   its panel on its first or last link (a horizontal bar's way down, where the
 *   APG example's vertical reading would move sideways); Down and Up walk the
 *   links, and Up from the first returns to the button.
 * - One panel at a time: `open` is a single id.
 * - Hover intent on fine pointers only: a panel opens once the pointer has
 *   rested `openDelay` on its button, or at once when another panel is open (or
 *   just closed), and closes `closeDelay` after the pointer leaves both. A
 *   transparent bridge spans the gap between button and panel, so the pointer
 *   crossing it never closes the panel. A press pins a hover-opened panel
 *   instead of closing it, and touch opens and closes by press alone. A press
 *   outside, or Escape from anywhere, closes it.
 * - Panels render in place and are promoted to the top layer (density and
 *   direction follow where the menu is written; no ancestor clips them), capped
 *   by the shared surface width and fading in and out. A dropdown opens under
 *   its button; a mega panel under `anchorRef` (or the menu), as wide as it.
 * - Links render through `RouterProvider` and carry `aria-current="page"` and
 *   the accent marker when current; a button whose panel holds the current
 *   page carries the marker too.
 */
export function NavigationMenu({
  items,
  open: openProp,
  defaultOpen = null,
  onOpenChange,
  openDelay = 150,
  closeDelay = 300,
  anchorRef,
  labels: labelsProp,
  classNames,
  className,
  ref,
  onKeyDown,
  onBlur,
  ...props
}: NavigationMenuProps) {
  const labels = useLabels("NavigationMenu", DEFAULT_NAVIGATION_MENU_LABELS, labelsProp);
  const [openId, setOpenId] = useControllableState<string | null>({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  const rootRef = useRef<HTMLElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>()).current;
  const pendingFocus = useRef<{ id: string; edge: Edge } | null>(null);
  // The latest open id for timers and document listeners; written again after every commit, so a
  // parent that refuses a controlled change is read back.
  const current = useRef(openId);
  useLayoutEffect(() => {
    current.current = openId;
  });
  const openedBy = useRef<OpenReason>("press");
  const lastClose = useRef(Number.NEGATIVE_INFINITY);
  const timers = useRef<{ open?: ReturnType<typeof setTimeout>; close?: ReturnType<typeof setTimeout> }>({});

  const clearTimers = () => {
    clearTimeout(timers.current.open);
    clearTimeout(timers.current.close);
  };
  useEffect(() => () => {
    clearTimeout(timers.current.open);
    clearTimeout(timers.current.close);
  }, []);

  const set = (id: string | null, reason: OpenReason) => {
    clearTimers();
    if (id === null && current.current !== null) lastClose.current = Date.now();
    openedBy.current = reason;
    current.current = id;
    setOpenId(id);
  };

  const scheduleClose = () => {
    clearTimeout(timers.current.close);
    timers.current.close = setTimeout(() => set(null, "hover"), closeDelay);
  };

  const api: MenuApi = {
    openId,
    rootRef,
    anchorRef,
    triggers,
    pendingFocus,
    classNames,
    press: (id) => {
      if (current.current !== id) return set(id, "press");
      // A press on a panel the pointer opened keeps it (the press was meant to open it).
      if (openedBy.current === "hover") {
        clearTimers();
        openedBy.current = "press";
        return;
      }
      set(null, "press");
    },
    close: () => set(null, "press"),
    hoverTrigger: (id) => {
      clearTimeout(timers.current.close);
      if (current.current === id) return;
      clearTimeout(timers.current.open);
      const warm = current.current !== null || Date.now() - lastClose.current < SKIP_DELAY_MS;
      if (warm) set(id, "hover");
      else timers.current.open = setTimeout(() => set(id, "hover"), openDelay);
    },
    hoverLink: () => {
      clearTimeout(timers.current.open);
      if (current.current !== null && openedBy.current === "hover") scheduleClose();
    },
    hoverPanel: () => clearTimeout(timers.current.close),
    leave: () => {
      clearTimeout(timers.current.open);
      if (current.current !== null && openedBy.current === "hover") scheduleClose();
    },
    pin: (id) => {
      if (current.current !== id) return;
      clearTimeout(timers.current.close);
      openedBy.current = "press";
    },
  };

  // While a panel is open: a press outside the menu closes it, and so does Escape from anywhere
  // (a hover-opened panel while focus is elsewhere, WCAG 1.4.13). Escape inside the menu is
  // handled first, on the menu, and prevented, so this stands down for it.
  const isOpen = openId !== null;
  useEffect(() => {
    if (!isOpen) return;
    const doc = rootRef.current?.ownerDocument ?? document;
    const onPointerDown = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node | null)) set(null, "press");
    };
    const onDocKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      set(null, "press");
    };
    doc.addEventListener("pointerdown", onPointerDown);
    doc.addEventListener("keydown", onDocKeyDown);
    return () => {
      doc.removeEventListener("pointerdown", onPointerDown);
      doc.removeEventListener("keydown", onDocKeyDown);
    };
    // `set` reads only refs and the stable setter, so the first one subscribed stays correct.
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const target = event.target as HTMLElement;

    if (event.key === "Escape") {
      const id = current.current;
      if (id === null) return;
      event.preventDefault();
      const trigger = triggers.get(id);
      // Focus goes home before the panel leaves (a focused node removed drops focus to <body>).
      if (trigger && trigger.parentElement?.contains(target)) trigger.focus();
      set(null, "press");
      return;
    }

    const tops = [...root.querySelectorAll<HTMLElement>("[data-nav-top]")];
    const index = tops.indexOf(target);
    if (index !== -1) {
      const rtl = isRtl(root);
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key as "ArrowRight" | "ArrowLeft"];
      const dest =
        step !== undefined
          ? tops[index + step]
          : event.key === "Home"
            ? tops[0]
            : event.key === "End"
              ? tops.at(-1)
              : undefined;
      if (step !== undefined || event.key === "Home" || event.key === "End") {
        event.preventDefault();
        dest?.focus();
        return;
      }
      const id = [...triggers].find(([, button]) => button === target)?.[0];
      if (id === undefined || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
      event.preventDefault();
      const edge: Edge = event.key === "ArrowDown" ? "first" : "last";
      if (current.current === id) {
        focusEdge(root.ownerDocument.getElementById(target.getAttribute("aria-controls") ?? ""), edge);
      } else {
        pendingFocus.current = { id, edge };
        set(id, "press");
      }
      return;
    }

    const panel = target.closest("[data-nav-panel]");
    if (!panel || !root.contains(panel)) return;
    const links = panelLinks(panel);
    const at = links.indexOf(target);
    if (at === -1) return;
    const moves: Record<string, HTMLElement | null | undefined> = {
      ArrowDown: links[at + 1],
      // Up from the first link goes back to the panel's button.
      ArrowUp: at === 0 ? (panel.previousElementSibling as HTMLElement | null) : links[at - 1],
      Home: links[0],
      End: links.at(-1),
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    moves[event.key]?.focus();
  };

  // Focus leaving the open item (to another item, or out of the menu) closes its panel. A null
  // `relatedTarget` is a press on something unfocusable, often inside the panel, or the window
  // losing focus: neither closes it (a press outside does, on its own).
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const id = current.current;
    const next = event.relatedTarget as Node | null;
    if (id === null || !next) return;
    const item = triggers.get(id)?.parentElement;
    if (item && !item.contains(next)) set(null, "press");
  };

  return (
    <nav
      aria-label={labels.navigation}
      {...props}
      ref={mergeRefs(ref, rootRef)}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      onBlur={composeEventHandlers(onBlur, handleBlur)}
      className={cn("flex min-w-0 items-center", className)}
    >
      <ul className={cn("flex min-w-0 items-center gap-r6", classNames?.list)}>
        {items.map((item) =>
          item.href !== undefined ? (
            <TopLink key={item.id} item={item} api={api} />
          ) : (
            <PanelItem key={item.id} item={item} api={api} />
          )
        )}
      </ul>
    </nav>
  );
}

function TopLink({ item, api }: { item: NavigationMenuLinkItem; api: MenuApi }) {
  const Component = useLinkElement(undefined, item.href);
  const current = useIsCurrent(item.current, item.href);
  return (
    <li className={cn("min-w-0", api.classNames?.item)}>
      <Component
        href={item.href}
        data-nav-top=""
        aria-current={current ? "page" : undefined}
        title={labelTitle(item.label)}
        onPointerEnter={onlyMouse(api.hoverLink)}
        onClick={() => {
          if (api.openId !== null) api.close();
        }}
        className={cn(TOP_ITEM, api.classNames?.link)}
      >
        <span className="min-w-0 truncate">{item.label}</span>
      </Component>
    </li>
  );
}

function PanelItem({ item, api }: { item: NavigationMenuListItem | NavigationMenuMegaItem; api: MenuApi }) {
  const open = api.openId === item.id;
  const mega = item.columns !== undefined;
  const panelId = `${useId()}-panel`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const present = useExitPresence(open, panelRef, topLayerExit);
  const floating = useFloating({ placement: "bottom-start", open: present });
  const { isCurrent } = useRouter();
  const holdsCurrent = navigationMenuLinks(item).some((link) => link.current ?? isCurrent(link.href));

  // A mega panel lines up under the anchor box and spans it; a dropdown stays on its button.
  const [anchorWidth, setAnchorWidth] = useState<number | null>(null);
  const setPositionReference = floating.refs.setPositionReference;
  useLayoutEffect(() => {
    if (!present || !mega) return;
    const anchor = api.anchorRef?.current ?? api.rootRef.current;
    if (!anchor) return;
    setPositionReference(anchor);
    const measure = () => setAnchorWidth(anchor.getBoundingClientRect().width);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [present, mega, api.anchorRef, api.rootRef, setPositionReference]);

  // The bridge: the gap between the button and the panel, measured as drawn (after every position
  // update), so the pointer crossing it is over the panel. Written straight to the element: it is
  // geometry, not state.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const trigger = triggerRef.current;
    if (!present || !panel || !trigger) return;
    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const below = p.top >= t.top;
    const gap = below ? p.top - t.bottom : t.top - p.bottom;
    panel.style.setProperty("--r-marketing-nav-bridge", `${Math.max(0, gap)}px`);
    panel.dataset.side = below ? "bottom" : "top";
  });

  // Opened from the keyboard with an arrow: land on the first or last link once it is there.
  useLayoutEffect(() => {
    const pending = api.pendingFocus.current;
    if (!open || !present || pending?.id !== item.id) return;
    api.pendingFocus.current = null;
    focusEdge(panelRef.current, pending.edge);
  }, [open, present, api.pendingFocus, item.id]);

  const closeOnNavigate = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest("a[href]")) api.close();
  };

  const classNames = api.classNames;
  return (
    <li className={cn("min-w-0", classNames?.item)}>
      <button
        type="button"
        ref={mergeRefs(triggerRef, floating.refs.setReference, (node: HTMLButtonElement | null) => {
          if (node) api.triggers.set(item.id, node);
          else api.triggers.delete(item.id);
        })}
        data-nav-top=""
        title={labelTitle(item.label)}
        data-current={holdsCurrent || undefined}
        aria-expanded={open}
        aria-controls={present ? panelId : undefined}
        onClick={() => api.press(item.id)}
        onPointerEnter={onlyMouse(() => api.hoverTrigger(item.id))}
        onPointerLeave={onlyMouse(api.leave)}
        className={cn(TOP_ITEM, "cursor-pointer", classNames?.trigger)}
      >
        <span className="min-w-0 truncate">{item.label}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-icon shrink-0 transition-transform duration-normal ease-standard", open && "rotate-180")}
        />
      </button>
      {present && (
        <div
          ref={mergeRefs(panelRef, floating.refs.setFloating)}
          id={panelId}
          data-nav-panel=""
          data-kind={mega ? "mega" : "list"}
          // Leaving: on screen for its exit, but no longer interactive.
          inert={!open}
          onFocus={() => api.pin(item.id)}
          onPointerEnter={onlyMouse(api.hoverPanel)}
          onPointerLeave={onlyMouse(api.leave)}
          onClick={closeOnNavigate}
          style={
            {
              ...floating.floatingStyles,
              ...(mega && anchorWidth !== null && { "--r-overlays-measure": `${anchorWidth}px` }),
            } as CSSProperties
          }
          className={cn(
            "r-overlays-surface r-marketing-nav-panel @container rounded-lg border border-border bg-surface-0 p-r4 text-start text-body-1 whitespace-normal text-fg-primary shadow-md",
            !mega && "w-column-lg",
            classNames?.panel
          )}
        >
          {item.links ? (
            <ul className="flex flex-col gap-r6">
              {item.links.map((link) => (
                <NavigationMenuLinkRow key={link.id ?? link.href} link={link} className={classNames?.panelLink} />
              ))}
            </ul>
          ) : (
            <MegaContent item={item} classNames={classNames} />
          )}
        </div>
      )}
    </li>
  );
}

function MegaContent({ item, classNames }: { item: NavigationMenuMegaItem; classNames: MenuApi["classNames"] }) {
  const baseId = useId();
  return (
    <div className={cn("grid gap-r3", item.featured != null && "@3xl:grid-cols-[minmax(0,1fr)_var(--COLUMN-LG)]")}>
      <div className="r-marketing-nav-columns">
        {item.columns.map((column) => {
          const titleId = `${baseId}-${column.id}`;
          return (
            <div key={column.id} className={cn("flex min-w-0 flex-col gap-r6", classNames?.column)}>
              {column.title != null && (
                <p id={titleId} className={cn("px-r4 py-r6 text-body-3 font-medium text-fg-muted", classNames?.columnTitle)}>
                  {column.title}
                </p>
              )}
              <ul aria-labelledby={column.title != null ? titleId : undefined} className="flex flex-col gap-r6">
                {column.links.map((link) => (
                  <NavigationMenuLinkRow key={link.id ?? link.href} link={link} className={classNames?.panelLink} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {item.featured != null && <div className={cn("min-w-0", classNames?.featured)}>{item.featured}</div>}
    </div>
  );
}

/**
 * One link row in a panel (and in a site header's mobile menu): the router's
 * link, the accent marker when current, an optional icon and description. The
 * label names it; the description describes it.
 * @internal
 */
export function NavigationMenuLinkRow({
  link,
  as: Wrapper = "li",
  className,
}: {
  link: NavigationMenuLink;
  as?: "li" | "div";
  className?: string;
}) {
  const Component = useLinkElement(undefined, link.href);
  const current = useIsCurrent(link.current, link.href);
  const descriptionId = `${useId()}-description`;
  return (
    <Wrapper className="min-w-0">
      <Component
        href={link.href}
        data-nav-link=""
        aria-current={current ? "page" : undefined}
        aria-describedby={link.description != null ? descriptionId : undefined}
        className={cn("r-marketing-nav-link", className)}
      >
        {link.icon != null && (
          <span className="r-marketing-nav-link-icon" aria-hidden>
            {link.icon}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-r6">
          <span className="min-w-0 break-words font-medium text-fg-primary">{link.label}</span>
          {link.description != null && (
            // Hidden from the name (it would make every link's name a sentence), read as its description.
            <span id={descriptionId} aria-hidden className="min-w-0 break-words text-body-2 text-fg-secondary">
              {link.description}
            </span>
          )}
        </span>
      </Component>
    </Wrapper>
  );
}
