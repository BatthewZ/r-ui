"use client";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type ElementType,
  type MouseEvent,
  type ReactNode,
  type Ref,
  useContext,
  useId,
  useMemo,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import type { PolymorphicProps } from "../../util/layout-polymorphic";
import { useLinkElement } from "../../util/router";
import { cn } from "../../util/style";
import { IconButton } from "../primitives";
import { NavLink, type NavLinkProps } from "./NavLink";

interface AppShellContextValue {
  collapsed: boolean;
  setCollapsed: (next: boolean | ((prev: boolean) => boolean)) => void;
  sidebarId: string;
  mainId: string;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

function useAppShell(part: string): AppShellContextValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) throw new Error(`<AppShell.${part}> must be used inside <AppShell>`);
  return ctx;
}

/* ─── Root ─────────────────────────────────────────────────────────────── */

export type AppShellProps = {
  /**
   * Controlled: the sidebar is collapsed to its icon rail. Only wide viewports
   * honour it; a medium viewport is always a rail, a phone always a bottom nav.
   */
  collapsed?: boolean;
  /** Uncontrolled initial collapse. Default `false`. */
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Text of the skip link, the first focusable element. Default "Skip to content". */
  skipLinkLabel?: string;
} & ComponentPropsWithRef<"div">;

/**
 * The page frame of an app: sidebar, header, main region and, on phones, a bottom
 * nav. The VIEWPORT picks the layout (the one place it may): a full sidebar on
 * wide screens, an icon rail on medium ones, the bottom nav on phones. Nothing
 * else changes with the viewport; density, input and theme flow through as usual.
 *
 * Parts: `Sidebar` > `Brand`, `SidebarSection` > `NavItem`; `SidebarToggle`;
 * `Header`; `Main`; `BottomNav` > `NavItem`. Without a `BottomNav`, phones keep the
 * icon rail instead.
 */
function AppShellRoot({
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  skipLinkLabel = "Skip to content",
  className,
  children,
  ...props
}: AppShellProps) {
  const [collapsed, setCollapsed] = useControllableState({
    value: collapsedProp,
    defaultValue: defaultCollapsed,
    onChange: onCollapsedChange,
  });
  const baseId = useId();
  const sidebarId = `${baseId}-sidebar`;
  const mainId = `${baseId}-main`;
  const ctx = useMemo(
    () => ({ collapsed, setCollapsed, sidebarId, mainId }),
    [collapsed, setCollapsed, sidebarId, mainId],
  );

  // The href is the fallback; JS moves focus itself so a hash router never sees it.
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById(mainId);
    if (!main) return;
    event.preventDefault();
    main.focus();
  };

  return (
    <AppShellContext.Provider value={ctx}>
      <div className={cn("r-navigation-shell", className)} data-collapsed={collapsed || undefined} {...props}>
        <a className="r-navigation-shell-skip" href={`#${mainId}`} onClick={skip}>
          {skipLinkLabel}
        </a>
        {children}
      </div>
    </AppShellContext.Provider>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────────────── */

export type AppShellSidebarProps = {
  /** The navigation landmark's name. Default "Primary". */
  label?: string;
} & ComponentPropsWithRef<"nav">;

/** The primary navigation: a full sidebar, an icon rail, or hidden behind the bottom nav. */
function Sidebar({ label = "Primary", className, children, ...props }: AppShellSidebarProps) {
  const { sidebarId } = useAppShell("Sidebar");
  return (
    <div className="r-navigation-shell-sidebar" id={sidebarId}>
      <nav aria-label={label} className={cn("r-navigation-shell-sidebar-inner", className)} {...props}>
        {children}
      </nav>
    </div>
  );
}

export type AppShellBrandProps<C extends ElementType = "a"> = PolymorphicProps<
  C,
  {
    /** The logo mark, shown alone in the rail. Decorative: the name is the label. */
    mark: ReactNode;
    /** The product name. */
    children: ReactNode;
  }
>;

/**
 * The product mark and name at the top of the sidebar: the router's link (an
 * `<a>` without a `RouterProvider`) unless `as` says otherwise.
 */
function Brand<C extends ElementType = "a">({ as, mark, className, children, ...props }: AppShellBrandProps<C>) {
  const Component = useLinkElement(as, (props as { href?: unknown }).href);
  return (
    <Component className={cn("r-navigation-shell-brand", className)} {...props}>
      <span className="r-navigation-shell-brand-mark" aria-hidden>
        {mark}
      </span>
      <span className="r-navigation-shell-brand-name">{children}</span>
    </Component>
  );
}

export type AppShellSidebarSectionProps = {
  /** A short group heading; in the rail it becomes a hairline divider. */
  title?: ReactNode;
  /** `end` pushes the section to the bottom of the sidebar (settings, account). */
  position?: "start" | "end";
} & ComponentPropsWithRef<"div">;

/** A group of `NavItem`s. Every item in the sidebar sits in one. */
function SidebarSection({ title, position = "start", className, children, ...props }: AppShellSidebarSectionProps) {
  const titleId = useId();
  return (
    <div
      role={title != null ? "group" : undefined}
      aria-labelledby={title != null ? titleId : undefined}
      data-position={position}
      className={cn("r-navigation-shell-section", className)}
      {...props}
    >
      {title != null && (
        <div id={titleId} className="r-navigation-shell-section-title">
          {title}
        </div>
      )}
      <ul className="r-navigation-shell-list">{children}</ul>
    </div>
  );
}

export type AppShellNavItemProps<C extends ElementType = "a"> = NavLinkProps<C>;

/**
 * One destination: the `RouterProvider`'s link (an `<a>` without one), or `as`.
 * `current` unset asks the router's `isCurrent(href)`. In the rail its label is
 * hidden visually but stays its accessible name, and shows beside the icon on
 * hover and keyboard focus.
 */
function NavItem<C extends ElementType = "a">(props: AppShellNavItemProps<C>) {
  return <NavLink {...props} />;
}

export type AppShellSidebarToggleProps = {
  /** Accessible names for the two states. */
  labels?: { collapse: string; expand: string };
  className?: string;
};

/**
 * Collapses the full sidebar to the rail and back. Shown only where collapse
 * means something (wide viewports); it renders nothing visible elsewhere.
 */
function SidebarToggle({
  labels = { collapse: "Collapse sidebar", expand: "Expand sidebar" },
  className,
}: AppShellSidebarToggleProps) {
  const { collapsed, setCollapsed, sidebarId } = useAppShell("SidebarToggle");
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <span className="r-navigation-shell-toggle">
      <IconButton
        variant="ghost"
        className={className}
        label={collapsed ? labels.expand : labels.collapse}
        icon={<Icon aria-hidden className="size-icon rtl:-scale-x-100" />}
        aria-controls={sidebarId}
        onClick={() => setCollapsed((c) => !c)}
      />
    </span>
  );
}

/* ─── Header, Main, BottomNav ──────────────────────────────────────────── */

export type AppShellHeaderProps = ComponentPropsWithRef<"header">;

/** The page's top bar: title, search, actions. Sticks to the top while the page scrolls. */
function Header({ className, ...props }: AppShellHeaderProps) {
  return <header className={cn("r-navigation-shell-header", className)} {...props} />;
}

export type AppShellMainProps = {
  /**
   * The element. `main` (default) is the page's main landmark. A shell embedded
   * in a page that already has its own `<main>` passes `div`, because a document
   * has one main landmark and a nested one is invalid.
   */
  as?: "main" | "div";
} & Omit<ComponentPropsWithRef<"main">, "id">;

/** The page content: the skip link's target. Padded by the shell; override with `className`. */
function Main({ as = "main", className, ref, ...props }: AppShellMainProps) {
  const { mainId } = useAppShell("Main");
  const shared = { id: mainId, tabIndex: -1, className: cn("r-navigation-shell-main", className), ...props };
  // The ref is typed for any HTMLElement (main's own type), which a div is.
  return as === "div" ? <div ref={ref as Ref<HTMLDivElement>} {...shared} /> : <main ref={ref} {...shared} />;
}

export type AppShellBottomNavProps = {
  /** The navigation landmark's name. Default "Primary" (it replaces the sidebar on phones). */
  label?: string;
} & ComponentPropsWithRef<"nav">;

/**
 * The phone navigation: up to five `NavItem`s, icon above label, pinned to the
 * bottom of the screen. Rendered only on narrow viewports.
 */
function BottomNav({ label = "Primary", className, children, ...props }: AppShellBottomNavProps) {
  useAppShell("BottomNav");
  return (
    <nav aria-label={label} className={cn("r-navigation-shell-bottomnav", className)} {...props}>
      <ul className="r-navigation-shell-bottomnav-list">{children}</ul>
    </nav>
  );
}

export const AppShell = Object.assign(AppShellRoot, {
  Sidebar,
  Brand,
  SidebarSection,
  NavItem,
  SidebarToggle,
  Header,
  Main,
  BottomNav,
});
