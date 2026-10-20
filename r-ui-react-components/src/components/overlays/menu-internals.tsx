"use client";
import { Check, Circle } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { type Placement, useDismiss, useFloating, useInteractions } from "../../hooks/use-floating";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { onEscape, type OpenStateProps, topLayerExit, useExitPresence } from "./internal";

/*
 * The one menu implementation behind DropdownMenu and ContextMenu: open state,
 * the floating panel, the keyboard model and every item kind. The two differ
 * only in how they open (a button vs a right-click, Shift+F10 or a long press)
 * and what the panel is anchored to (the button vs a point or the focused
 * element), which their own roots and triggers decide.
 */

/** Where focus lands when the menu opens: keyboard opens on an item, a pointer on the menu. */
export type FocusIntent = "first" | "last" | "menu";

export interface MenuContextValue {
  open: boolean;
  /** Open, or still running its exit transition. */
  present: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  openWith: (intent: FocusIntent) => void;
  /** Close and hand focus back to `returnFocusRef` (every close except light dismiss). */
  close: (restoreFocus?: boolean) => void;
  intent: RefObject<FocusIntent>;
  contentId: string;
  /** Names the menu (`aria-labelledby`); a menu with no visible opener is named by its own `aria-label`. */
  labelledBy: string | undefined;
  /** Where focus goes back to when the menu closes: the trigger, or what had focus before a context menu opened. */
  returnFocusRef: RefObject<HTMLElement | null>;
  floating: ReturnType<typeof useFloating>;
  getFloatingProps: ReturnType<typeof useInteractions>["getFloatingProps"];
}

const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenu(part: string) {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error(`${part} must be used inside <DropdownMenu> or <ContextMenu>`);
  return ctx;
}

export interface MenuRootOptions extends OpenStateProps {
  placement: Placement;
  /** The custom property naming the gap between the anchor and the panel. */
  offset: `--${string}`;
  labelledBy?: string;
  returnFocusRef: RefObject<HTMLElement | null>;
}

/** The state a menu root provides. Each root adds how it opens on top. */
export function useMenuRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement,
  offset,
  labelledBy,
  returnFocusRef,
}: MenuRootOptions): MenuContextValue {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const contentId = useId();
  const intent = useRef<FocusIntent>("first");
  const panelRef = useRef<HTMLDivElement>(null);
  const present = useExitPresence(open, panelRef, topLayerExit);
  // Positioned and promoted for as long as it is on screen, exit included.
  const floating = useFloating({ placement, offset, open: present, onOpenChange: setOpen });
  // Pointer light dismiss only; every key is handled by the menu itself.
  const { getFloatingProps } = useInteractions([useDismiss(floating.context, { escapeKey: false })]);

  return useMemo<MenuContextValue>(
    () => ({
      open,
      present,
      panelRef,
      openWith: (next) => {
        intent.current = next;
        setOpen(true);
      },
      close: (restoreFocus = true) => {
        setOpen(false);
        if (restoreFocus) returnFocusRef.current?.focus();
      },
      intent,
      contentId,
      labelledBy,
      returnFocusRef,
      floating,
      getFloatingProps,
    }),
    [open, present, setOpen, contentId, labelledBy, returnFocusRef, floating, getFloatingProps]
  );
}

export function MenuProvider({ value, children }: { value: MenuContextValue; children: ReactNode }) {
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

const TYPEAHEAD_RESET_MS = 600;

/**
 * The menu's items, in order, disabled ones included: a disabled item stays
 * focusable so arrows land on it and it is read out as unavailable (APG); it is
 * skipped only for activation.
 */
const menuItems = (menu: HTMLElement) => [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')];

export type MenuContentProps = ComponentPropsWithRef<"div">;

/**
 * The menu panel (`role="menu"`). Arrow keys, Home/End and typeahead move
 * between items (disabled ones too: they are focusable, not activatable);
 * Enter/Space activates; Escape closes and returns focus; Tab closes and moves on.
 *
 * Rendered in place (a DOM sibling of its trigger) and promoted to the top
 * layer: a menu opened inside a `[data-density="compact"]` card is compact, and
 * an `overflow: hidden` ancestor does not clip it.
 */
function MenuContent({ className, children, style, ref, onKeyDown, ...props }: MenuContentProps) {
  const { open, present, panelRef, close, intent, labelledBy, contentId, floating, getFloatingProps } = useMenu("Menu.Content");
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    const items = menuItems(menu);
    const target =
      intent.current === "first" ? items[0] : intent.current === "last" ? items[items.length - 1] : undefined;
    // `preventScroll`: the panel may not be positioned yet in this frame.
    (target ?? menu).focus({ preventScroll: true });
  }, [open, intent]);

  if (!present) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = menuItems(menu);
    const current = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (index: number) => items[index]?.focus();

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(current < 0 ? 0 : (current + 1) % items.length);
        return;
      case "ArrowUp":
        event.preventDefault();
        focusAt(current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length);
        return;
      case "Home":
        event.preventDefault();
        focusAt(0);
        return;
      case "End":
        event.preventDefault();
        focusAt(items.length - 1);
        return;
      case "Escape":
        onEscape(close)(event);
        return;
      case "Tab":
        // Focus goes back to the opener first, so the browser's own Tab move
        // continues from there (the panel is gone by the time it runs).
        close();
        return;
    }

    // Typeahead. Skipped when an item already used the key (Space activates).
    if (event.defaultPrevented || event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
    const state = typeahead.current;
    const fresh = event.timeStamp - state.at > TYPEAHEAD_RESET_MS;
    // A space only continues a query ("Save as"); on its own it is not a search.
    if (event.key === " " && fresh) return;
    event.preventDefault();
    state.text = fresh ? event.key : state.text + event.key;
    state.at = event.timeStamp;
    // The same letter typed repeatedly cycles through the items starting with it;
    // a longer query searches from the current item.
    const cycling = /^(.)\1*$/su.test(state.text);
    const query = (cycling ? event.key : state.text).toLocaleLowerCase();
    const start = cycling ? current + 1 : Math.max(current, 0);
    const ordered = [...items.slice(start), ...items.slice(0, start)];
    ordered.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(query))?.focus();
  };

  return (
    <div
      {...getFloatingProps({ ...props, onKeyDown: composeEventHandlers(onKeyDown, handleKeyDown) })}
      ref={mergeRefs(ref, menuRef, panelRef, floating.refs.setFloating)}
      id={contentId}
      role="menu"
      // Leaving: on screen for its exit, but no longer interactive.
      inert={!open}
      // The caller's own wiring wins over the trigger's name.
      aria-labelledby={props["aria-labelledby"] ?? labelledBy}
      aria-orientation="vertical"
      tabIndex={-1}
      style={{ ...floating.floatingStyles, ...style }}
      className={cn(
        "r-overlays-surface flex min-w-[calc(var(--ROW-H)*5)] max-h-[calc(var(--ROW-H)*12)] flex-col overflow-y-auto rounded-md border border-border bg-surface-0 p-r6 text-body-1 text-fg-primary shadow-md outline-none",
        className
      )}
    >
      {children}
    </div>
  );
}

interface ItemBaseProps extends Omit<ComponentPropsWithRef<"div">, "onSelect"> {
  disabled?: boolean;
  /** Runs on click, Enter or Space. */
  onSelect?: () => void;
  /** Keyboard shortcut hint shown at the end of the row. Display only. */
  shortcut?: ReactNode;
}

// The highlight is ink at low alpha, not a surface rung: rungs are recessed in
// every theme, so on a dark theme's raised panel a rung reads as a hole.
const itemClasses =
  "relative flex min-h-row w-full cursor-default select-none items-center gap-r4 rounded-sm px-r4 text-start outline-none focus:bg-fg-primary/8 focus-visible:focus-ring-inset forced-colors:focus:bg-selection aria-disabled:opacity-disabled";

/**
 * The behaviour every item kind shares: activation by click, Enter or Space,
 * highlight following the pointer, and disabled gating (`aria-disabled` keeps a
 * disabled item readable, so nothing native stops its events: they are gated
 * here). Returns the props to spread and the caller's remaining DOM props.
 */
function useItem<P extends ItemBaseProps>(props: P, closeOnSelect: boolean, select: () => void) {
  const { disabled = false, onSelect, onClick, onKeyDown, onPointerMove, onPointerLeave, shortcut, ...rest } = props;
  const { close } = useMenu("Menu.Item");
  const activate = () => {
    if (disabled) return;
    select();
    onSelect?.();
    if (closeOnSelect) close();
  };
  const itemProps = {
    tabIndex: -1,
    "aria-disabled": disabled || undefined,
    onClick: composeEventHandlers(onClick, activate),
    onKeyDown: composeEventHandlers(onKeyDown, (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    }),
    onPointerMove: composeEventHandlers(onPointerMove, (event: PointerEvent<HTMLDivElement>) => {
      if (!disabled && document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
    }),
    onPointerLeave: composeEventHandlers(onPointerLeave, (event: PointerEvent<HTMLDivElement>) => {
      (event.currentTarget.closest('[role="menu"]') as HTMLElement | null)?.focus({ preventScroll: true });
    }),
  };
  return { rest, shortcut, itemProps };
}

/** An item's label, truncated, and its shortcut hint at the row's end. */
function ItemText({
  children,
  shortcut,
  shortcutClassName,
}: {
  children: ReactNode;
  shortcut: ReactNode;
  shortcutClassName?: string;
}) {
  return (
    <>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <span className={cn("ms-auto ps-r3 text-body-3 text-fg-muted", shortcutClassName)}>{shortcut}</span>}
    </>
  );
}

export interface MenuItemProps extends ItemBaseProps {
  /** `danger` marks a destructive action, as on `Button`. @default "default" */
  variant?: "default" | "danger";
  /** Leading icon, decorative. */
  icon?: ReactNode;
  /** @default true */
  closeOnSelect?: boolean;
  classNames?: SlotClassNames<"icon" | "shortcut">;
}

function MenuItem({ variant = "default", icon, closeOnSelect = true, classNames, ...props }: MenuItemProps) {
  const { rest, shortcut, itemProps } = useItem(props, closeOnSelect, () => {});
  const { className, children, ...dom } = rest;
  return (
    <div
      {...dom}
      {...itemProps}
      role="menuitem"
      data-variant={variant}
      className={cn(itemClasses, variant === "danger" && "text-fg-error", className)}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 [&>svg]:size-icon",
            variant === "danger" ? "text-fg-error" : "text-fg-secondary",
            classNames?.icon
          )}
        >
          {icon}
        </span>
      )}
      <ItemText shortcut={shortcut} shortcutClassName={classNames?.shortcut}>
        {children}
      </ItemText>
    </div>
  );
}

function Indicator({ children }: { children?: ReactNode }) {
  return (
    <span aria-hidden className="flex size-icon shrink-0 items-center justify-center text-fg-primary [&>svg]:size-icon">
      {children}
    </span>
  );
}

export interface MenuCheckboxItemProps extends ItemBaseProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** @default false: a checkbox is usually toggled several times in a row. */
  closeOnSelect?: boolean;
}

function MenuCheckboxItem({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  closeOnSelect = false,
  ...props
}: MenuCheckboxItemProps) {
  const [checked, setChecked] = useControllableState({
    value: checkedProp,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  const { rest, shortcut, itemProps } = useItem(props, closeOnSelect, () => setChecked(!checked));
  const { className, children, ...dom } = rest;
  return (
    <div {...dom} {...itemProps} role="menuitemcheckbox" aria-checked={checked} className={cn(itemClasses, className)}>
      <Indicator>{checked && <Check />}</Indicator>
      <ItemText shortcut={shortcut}>{children}</ItemText>
    </div>
  );
}

interface RadioContextValue {
  value: string | undefined;
  setValue: (value: string) => void;
}
const RadioContext = createContext<RadioContextValue | null>(null);

export interface MenuRadioGroupProps extends ComponentPropsWithRef<"div"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/** A set of mutually exclusive `RadioItem`s (`role="group"`; name it with `aria-label` or `aria-labelledby`). */
function MenuRadioGroup({ value, defaultValue, onValueChange, className, ...props }: MenuRadioGroupProps) {
  const [current, setCurrent] = useControllableState<string | undefined>({
    value,
    defaultValue,
    onChange: (next) => next !== undefined && onValueChange?.(next),
  });
  const ctx = useMemo(() => ({ value: current, setValue: setCurrent }), [current, setCurrent]);
  return (
    <RadioContext.Provider value={ctx}>
      <div role="group" className={cn("flex flex-col", className)} {...props} />
    </RadioContext.Provider>
  );
}

export interface MenuRadioItemProps extends ItemBaseProps {
  value: string;
  /** @default false */
  closeOnSelect?: boolean;
}

function MenuRadioItem({ value, closeOnSelect = false, ...props }: MenuRadioItemProps) {
  const group = useContext(RadioContext);
  if (!group) throw new Error("Menu.RadioItem must be used inside a menu's <RadioGroup>");
  const checked = group.value === value;
  const { rest, shortcut, itemProps } = useItem(props, closeOnSelect, () => group.setValue(value));
  const { className, children, ...dom } = rest;
  return (
    <div {...dom} {...itemProps} role="menuitemradio" aria-checked={checked} className={cn(itemClasses, className)}>
      <Indicator>{checked && <Circle className="size-r5! fill-current" />}</Indicator>
      <ItemText shortcut={shortcut}>{children}</ItemText>
    </div>
  );
}

function MenuSeparator({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div role="separator" className={cn("-mx-r6 my-r6 h-px shrink-0 bg-border", className)} {...props} />;
}

/** A non-interactive heading for the items that follow. Give its `id` to a RadioGroup's `aria-labelledby`. */
function MenuLabel({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("px-r4 pb-r6 pt-r5 text-body-3 font-medium text-fg-muted", className)} {...props} />;
}

/** The parts both menus share, assigned onto each root. */
export const menuParts = {
  Content: MenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  Separator: MenuSeparator,
  Label: MenuLabel,
};
