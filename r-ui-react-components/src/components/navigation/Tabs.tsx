"use client";
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useId,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { cn } from "../../util/style";

/**
 * - `underline`: tabs over a hairline, the selected one marked by the accent bar.
 * - `enclosed`: a segmented control; the selected segment is raised.
 */
export type TabsVariant = "underline" | "enclosed";

/**
 * - `automatic`: arrow keys select as they move (cheap panels).
 * - `manual`: arrow keys move focus; Enter or Space selects (panels that load).
 */
export type TabsActivation = "automatic" | "manual";

interface TabsContextValue {
  value: string;
  select: (value: string) => void;
  variant: TabsVariant;
  activation: TabsActivation;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(part: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<Tabs.${part}> must be used inside <Tabs>`);
  return ctx;
}

// IDREFs are space-separated, so a value with a space would name two elements.
const tabId = (baseId: string, value: string) => `${baseId}-tab-${encodeURIComponent(value)}`;
const panelId = (baseId: string, value: string) => `${baseId}-panel-${encodeURIComponent(value)}`;

type TabsValueProps =
  | { value: string; defaultValue?: never; onValueChange: (value: string) => void }
  | { value?: never; defaultValue: string; onValueChange?: (value: string) => void };

export type TabsProps = TabsValueProps & {
  variant?: TabsVariant;
  activation?: TabsActivation;
} & Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange">;

function TabsRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  variant = "underline",
  activation = "automatic",
  className,
  children,
  ...props
}: TabsProps) {
  const [value, select] = useControllableState<string>({
    value: valueProp,
    defaultValue: defaultValue ?? "",
    onChange: onValueChange,
  });
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, select, variant, activation, baseId }}>
      <div className={cn("flex min-w-0 flex-col gap-r3", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = ComponentPropsWithRef<"div">;

const LIST: Record<TabsVariant, string> = {
  underline: "r-navigation-tabs-underline flex max-w-full overflow-x-auto",
  enclosed: "r-navigation-tabs-enclosed inline-flex max-w-full gap-r6 self-start overflow-x-auto rounded-md border border-border bg-surface-2 p-r6",
};

/** The row of tabs. Name it with `aria-label` (or `aria-labelledby`). Scrolls when it overflows. */
function TabsList({ className, onKeyDown, ...props }: TabsListProps) {
  const { select, variant, activation } = useTabs("List");

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = event.currentTarget;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]')).filter(
      (tab) => !tab.disabled && tab.closest('[role="tablist"]') === list,
    );
    const current = tabs.indexOf(event.target as HTMLButtonElement);
    if (current === -1) return;

    const rtl = getComputedStyle(list).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next: number;
    switch (event.key) {
      case forward:
        next = (current + 1) % tabs.length;
        break;
      case back:
        next = (current - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const tab = tabs[next];
    if (!tab) return;
    tab.focus();
    if (activation === "automatic" && tab.dataset.value !== undefined) select(tab.dataset.value);
  };

  return (
    <div
      role="tablist"
      aria-orientation="horizontal"
      className={cn(LIST[variant], className)}
      onKeyDown={composeEventHandlers(onKeyDown, handleKeyDown)}
      {...props}
    />
  );
}

export type TabsTabProps = {
  value: string;
  /** Decorative icon before the label. */
  icon?: ReactNode;
} & Omit<ComponentPropsWithRef<"button">, "value">;

const TAB: Record<TabsVariant, string> = {
  underline:
    "r-navigation-tab-underline px-r3 text-fg-secondary enabled:hover:text-fg-primary aria-selected:text-fg-primary",
  enclosed:
    "rounded-sm px-r3 text-fg-secondary enabled:hover:text-fg-primary enabled:not-aria-selected:hover:bg-fg-primary/8 aria-selected:bg-surface-0 aria-selected:text-fg-primary aria-selected:shadow-[inset_0_0_0_1px_var(--C-BORDER-STRONG)]",
};

/** One tab. Roving tab stop: only the selected tab is in the Tab order. */
function TabsTab({ value, icon, disabled, className, onClick, children, ...props }: TabsTabProps) {
  const ctx = useTabs("Tab");
  const selected = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={tabId(ctx.baseId, value)}
      aria-selected={selected}
      aria-controls={panelId(ctx.baseId, value)}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      data-value={value}
      className={cn(
        "relative inline-flex h-control shrink-0 items-center justify-center gap-r5 whitespace-nowrap text-body-1 font-medium",
        "transition-colors focus-visible:focus-ring-inset disabled:opacity-disabled",
        TAB[ctx.variant],
        className,
      )}
      onClick={composeEventHandlers(onClick, () => ctx.select(value))}
      {...props}
    >
      {icon != null && <span className="inline-flex shrink-0 [&_svg]:size-icon">{icon}</span>}
      {children}
    </button>
  );
}

export type TabsPanelProps = { value: string } & ComponentPropsWithRef<"div">;

/** The content for one tab. Hidden (not unmounted) while its tab is not selected. */
function TabsPanel({ value, className, ...props }: TabsPanelProps) {
  const ctx = useTabs("Panel");
  const selected = ctx.value === value;
  return (
    <div
      role="tabpanel"
      id={panelId(ctx.baseId, value)}
      aria-labelledby={tabId(ctx.baseId, value)}
      tabIndex={0}
      hidden={!selected}
      className={cn("min-w-0 animate-fade-in rounded-sm", className)}
      {...props}
    />
  );
}

/**
 * Tabs (WAI-ARIA tabs pattern): `Tabs.List` > `Tabs.Tab`, then one `Tabs.Panel`
 * per tab. Arrow keys move between tabs (mirrored in RTL), Home/End jump to the
 * ends, disabled tabs are skipped.
 */
export const Tabs = Object.assign(TabsRoot, { List: TabsList, Tab: TabsTab, Panel: TabsPanel });
