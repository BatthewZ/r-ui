"use client";
import { Menu } from "lucide-react";
import {
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { useRouter } from "../../util/router";
import { cn, type SlotClassNames } from "../../util/style";
import { Accordion } from "../disclosure";
import { Drawer } from "../overlays";
import { IconButton } from "../primitives";
import {
  DEFAULT_NAVIGATION_MENU_LABELS,
  NavigationMenu,
  type NavigationMenuItem,
  NavigationMenuLinkRow,
  navigationMenuLinks,
  type NavigationMenuProps,
} from "./NavigationMenu";

export interface SiteHeaderLabels {
  /** The narrow header's menu button and the menu's title. */
  menu: string;
  /** The skip link's text (rendered with `skipTo`). */
  skipToContent: string;
}

export const DEFAULT_SITE_HEADER_LABELS: SiteHeaderLabels = { menu: "Menu", skipToContent: "Skip to content" };

declare module "../../util/locale" {
  interface LabelsRegistry {
    SiteHeader: SiteHeaderLabels;
  }
}

/**
 * - `solid` (default): the canvas, edged by a hairline.
 * - `transparent`: over the content after it (a hero), with no fill or edge
 *   until its scroller moves, then solid.
 */
export type SiteHeaderVariant = "solid" | "transparent";

/** The header's own width below which the navigation folds into the menu: 42rem, 56rem or 72rem. */
export type SiteHeaderCollapse = "sm" | "md" | "lg";

// Container queries need literal steps (`verify:utilities-exist` reads each class).
const WIDE_ONLY: Record<SiteHeaderCollapse, string> = {
  sm: "hidden @2xl:flex",
  md: "hidden @4xl:flex",
  lg: "hidden @6xl:flex",
};
const NARROW_ONLY: Record<SiteHeaderCollapse, string> = {
  sm: "@2xl:hidden",
  md: "@4xl:hidden",
  lg: "@6xl:hidden",
};

/** A scroll smaller than this, either way, neither hides nor shows the header (jitter, inertia). */
const SCROLL_SLOP = 8;

export type SiteHeaderProps = Omit<ComponentPropsWithRef<"header">, "children"> & {
  /** The logo or wordmark, usually a link home. */
  brand?: ReactNode;
  /** The site navigation: drawn as a `NavigationMenu` when the header is wide, and as an accordion in the menu when narrow. */
  items?: readonly NavigationMenuItem[];
  /** The calls to action (sign in, start free). Beside the navigation when wide; at the foot of the menu when narrow. */
  actions?: ReactNode;
  variant?: SiteHeaderVariant;
  /**
   * Stick to the top of its scroller (the page, or the nearest scrolling
   * ancestor), on the sticky layer, `--r-marketing-site-header-top` below it
   * (default 0).
   */
  sticky?: boolean;
  /**
   * Slide away while the reader scrolls down and come back on any scroll up.
   * Implies `sticky`. Never hides while focus is inside it or a panel or the
   * menu is open, and focus arriving in it brings it back. Under reduced motion
   * it is shown and hidden without the slide.
   */
  hideOnScroll?: boolean;
  /** Below this header width the navigation and actions fold into the menu. @default "md" */
  collapseBelow?: SiteHeaderCollapse;
  /**
   * An in-page target (`"#main"`) for a skip link, rendered first and shown on
   * focus. The target is focused (made focusable if it is not).
   */
  skipTo?: string;
  /** The narrow header's menu (a drawer). Controlled when not `undefined`. */
  menuOpen?: boolean;
  defaultMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  /** Passed to the `NavigationMenu` (its labels also name the menu's navigation). */
  navigationProps?: Omit<NavigationMenuProps, "items" | "anchorRef">;
  labels?: LabelsProp<SiteHeaderLabels>;
  classNames?: SlotClassNames<"bar" | "brand" | "navigation" | "actions" | "menuButton" | "menu" | "menuActions" | "skipLink">;
};

/** The nearest ancestor that scrolls vertically (the one `position: sticky` sticks in), else null for the page. */
function scrollerOf(element: Element): HTMLElement | null {
  const doc = element.ownerDocument;
  for (let node = element.parentElement; node && node !== doc.body && node !== doc.documentElement; node = node.parentElement) {
    if (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/**
 * A marketing site's top bar: brand, navigation, calls to action, and below a
 * width of its own a menu button that opens the same navigation in a drawer.
 *
 * - **Its own width decides** (a container query, `collapseBelow`), never the
 *   viewport: wide, the `NavigationMenu` (mega panels span the bar) and the
 *   actions; narrow, the brand and a menu button. The menu is a modal `Drawer`
 *   from the inline end holding the same links as an accordion (a group with
 *   the current page starts open) and the actions; following a link closes it.
 * - `sticky` sticks it to the top of its scroller on the sticky layer;
 *   `hideOnScroll` also slides it away on a scroll down and back on any scroll
 *   up, but never while focus or an open panel is inside it. Under a bar the
 *   host already sticks there, set `--r-marketing-site-header-top` (on the
 *   header or an ancestor) to that bar's height: the header sticks below it and
 *   slides fully past it when hidden.
 * - `transparent` lets the content after it run underneath: the header takes
 *   no room in the flow (a negative margin of its own height,
 *   `--r-marketing-site-header-h`) and paints no fill or edge until its
 *   scroller moves. **What the content under it must provide:** room at its top
 *   of at least `--r-marketing-site-header-h` (e.g. a Hero's
 *   `className="pt-[calc(var(--r-marketing-site-header-h)+var(--SECTION-2))]"`),
 *   and, behind the bar, the canvas or a contract surface (a plain or band
 *   Hero), where the contract's text roles the header writes hold 4.5:1. A
 *   photograph or a brand fill there needs its own scrim that keeps them so.
 * - A sticky header covers what an in-page link or focus scrolls to: give the
 *   scroller `scroll-padding-block-start: var(--r-marketing-site-header-h)`
 *   (plus the offset above it).
 * - `skipTo` renders a skip link before everything else. The header is a
 *   `<header>` (a banner landmark at the top of a page); it never prints.
 */
export function SiteHeader({
  brand,
  items = [],
  actions,
  variant = "solid",
  sticky = false,
  hideOnScroll = false,
  collapseBelow = "md",
  skipTo,
  menuOpen: menuOpenProp,
  defaultMenuOpen = false,
  onMenuOpenChange,
  navigationProps,
  labels: labelsProp,
  classNames,
  className,
  ref,
  onFocus,
  ...props
}: SiteHeaderProps) {
  const labels = useLabels("SiteHeader", DEFAULT_SITE_HEADER_LABELS, labelsProp);
  const navigationLabels = useLabels("NavigationMenu", DEFAULT_NAVIGATION_MENU_LABELS, navigationProps?.labels);
  const [menuOpen, setMenuOpen] = useControllableState({
    value: menuOpenProp,
    defaultValue: defaultMenuOpen,
    onChange: onMenuOpenChange,
  });
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuId = `${useId()}-menu`;
  const stuck = sticky || hideOnScroll;
  const hasMenu = items.length > 0 || actions != null;

  // Read by the scroll handler without re-subscribing.
  const menuOpenRef = useRef(menuOpen);
  useLayoutEffect(() => {
    menuOpenRef.current = menuOpen;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root || (!hideOnScroll && variant !== "transparent")) return;
    const scroller = scrollerOf(root);
    const view = root.ownerDocument.defaultView;
    const read = () => (scroller ? scroller.scrollTop : (view?.scrollY ?? 0));
    // An open panel is read from the DOM, so a controlled or default-open menu holds it too.
    const holding = () =>
      menuOpenRef.current ||
      root.contains(root.ownerDocument.activeElement) ||
      root.querySelector("[data-nav-panel]:not([inert])") !== null;
    let from = read();
    const update = () => {
      const y = read();
      setScrolled(y > 0);
      if (!hideOnScroll) return;
      if (y <= root.offsetHeight) {
        setHidden(false);
        from = y;
      } else if (y - from > SCROLL_SLOP) {
        if (!holding()) setHidden(true);
        from = y;
      } else if (from - y > SCROLL_SLOP) {
        setHidden(false);
        from = y;
      }
    };
    update();
    const target = scroller ?? view;
    target?.addEventListener("scroll", update, { passive: true });
    return () => target?.removeEventListener("scroll", update);
  }, [hideOnScroll, variant]);

  // The menu belongs to the narrow form: once the header is wide again (its button no longer
  // drawn), an open menu closes rather than float over a header that no longer offers it.
  useEffect(() => {
    const root = rootRef.current;
    if (!menuOpen || !root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const button = menuButtonRef.current;
      if (button && getComputedStyle(button).display === "none") setMenuOpen(false);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [menuOpen, setMenuOpen]);

  // Focus arriving in a hidden header (Shift+Tab back into it) brings it back.
  const reveal = () => setHidden(false);

  // The href is the fallback; the target is focused here so a hash router never sees it.
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!skipTo?.startsWith("#")) return;
    const target = event.currentTarget.ownerDocument.getElementById(decodeURIComponent(skipTo.slice(1)));
    if (!target) return;
    event.preventDefault();
    if (!target.hasAttribute("tabindex") && target.tabIndex < 0) target.setAttribute("tabindex", "-1");
    target.focus();
  };

  return (
    <header
      data-print="hide"
      {...props}
      ref={mergeRefs(ref, rootRef)}
      data-variant={variant}
      data-sticky={stuck || undefined}
      data-hidden={(hideOnScroll && hidden) || undefined}
      data-scrolled={scrolled || undefined}
      onFocus={composeEventHandlers(onFocus, reveal)}
      className={cn(
        "r-marketing-site-header @container",
        stuck ? "sticky z-sticky" : variant === "transparent" && "relative z-sticky",
        className
      )}
    >
      {skipTo && (
        <a href={skipTo} onClick={skip} className={cn("r-marketing-site-header-skip", classNames?.skipLink)}>
          {labels.skipToContent}
        </a>
      )}
      <div ref={barRef} className={cn("mx-auto flex h-full max-w-page min-w-0 items-center gap-r3 px-gutter", classNames?.bar)}>
        {brand != null && (
          <div className={cn("flex min-w-0 shrink items-center text-fg-primary", classNames?.brand)}>{brand}</div>
        )}
        {items.length > 0 && (
          <NavigationMenu
            {...navigationProps}
            items={items}
            anchorRef={barRef}
            onOpenChange={(open) => {
              if (open !== null) setHidden(false);
              navigationProps?.onOpenChange?.(open);
            }}
            className={cn(WIDE_ONLY[collapseBelow], "flex-1", navigationProps?.className, classNames?.navigation)}
          />
        )}
        {actions != null && (
          <div className={cn(WIDE_ONLY[collapseBelow], "ms-auto shrink-0 items-center gap-r4", classNames?.actions)}>
            {actions}
          </div>
        )}
        {hasMenu && (
          <IconButton
            ref={menuButtonRef}
            label={labels.menu}
            icon={<Menu />}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen(true)}
            className={cn(NARROW_ONLY[collapseBelow], "ms-auto shrink-0", classNames?.menuButton)}
          />
        )}
      </div>
      {hasMenu && (
        <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
          <Drawer.Content id={menuId} side="end" className={classNames?.menu}>
            <Drawer.Header>
              <Drawer.Title>{labels.menu}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              {items.length > 0 && (
                <MenuNavigation items={items} label={navigationLabels.navigation} onNavigate={() => setMenuOpen(false)} />
              )}
            </Drawer.Body>
            {actions != null && (
              <Drawer.Footer className={cn("justify-stretch *:grow", classNames?.menuActions)}>{actions}</Drawer.Footer>
            )}
          </Drawer.Content>
        </Drawer>
      )}
    </header>
  );
}

/** The navigation as the narrow header's menu draws it: links as rows, panels as accordion sections. */
function MenuNavigation({
  items,
  label,
  onNavigate,
}: {
  items: readonly NavigationMenuItem[];
  label: string;
  onNavigate: () => void;
}) {
  const { isCurrent } = useRouter();
  const holdingCurrent = items
    .filter((item) => navigationMenuLinks(item).some((link) => link.current ?? isCurrent(link.href)))
    .map((item) => item.id);
  return (
    <nav
      aria-label={label}
      onClick={(event) => {
        if ((event.target as Element).closest("a[href]")) onNavigate();
      }}
    >
      <Accordion multiple headingLevel={3} defaultValue={holdingCurrent} className="border-y-0">
        {items.map((item) =>
          item.href !== undefined ? (
            <NavigationMenuLinkRow
              key={item.id}
              as="div"
              link={{ label: item.label, href: item.href, current: item.current }}
              className="py-r5"
            />
          ) : (
            <Accordion.Item key={item.id} value={item.id}>
              <Accordion.Trigger>{item.label}</Accordion.Trigger>
              <Accordion.Content classNames={{ body: "px-0" }}>
                {item.links ? (
                  <ul className="flex flex-col gap-r6">
                    {item.links.map((link) => (
                      <NavigationMenuLinkRow key={link.id ?? link.href} link={link} />
                    ))}
                  </ul>
                ) : (
                  <div className="flex flex-col gap-r4">
                    {item.columns.map((column) => (
                      <MenuColumn key={column.id} title={column.title}>
                        {column.links.map((link) => (
                          <NavigationMenuLinkRow key={link.id ?? link.href} link={link} />
                        ))}
                      </MenuColumn>
                    ))}
                    {item.featured != null && <div className="min-w-0">{item.featured}</div>}
                  </div>
                )}
              </Accordion.Content>
            </Accordion.Item>
          )
        )}
      </Accordion>
    </nav>
  );
}

function MenuColumn({ title, children }: { title: ReactNode; children: ReactNode }) {
  const titleId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-r6">
      {title != null && (
        <p id={titleId} className="px-r4 py-r6 text-body-3 font-medium text-fg-muted">
          {title}
        </p>
      )}
      <ul aria-labelledby={title != null ? titleId : undefined} className="flex flex-col gap-r6">
        {children}
      </ul>
    </div>
  );
}
