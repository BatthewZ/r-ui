"use client";
import { Check, Circle } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type ReactNode,
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
import { Button, type ButtonProps } from "../primitives";
import { Slot } from "./internal";

/** Where focus lands when the menu opens: keyboard opens on an item, a pointer on the menu. */
type FocusIntent = "first" | "last" | "menu";

interface MenuContextValue {
  open: boolean;
  openWith: (intent: FocusIntent) => void;
  /** Close and hand focus back to the trigger (every close except Tab-out and light dismiss). */
  close: (restoreFocus?: boolean) => void;
  intent: React.RefObject<FocusIntent>;
  triggerId: string;
  contentId: string;
  triggerRef: React.RefObject<HTMLElement | null>;
  floating: ReturnType<typeof useFloating>;
  getFloatingProps: ReturnType<typeof useInteractions>["getFloatingProps"];
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenu(part: string) {
  const ctx = useContext(MenuContext);
  if (!ctx) throw new Error(`DropdownMenu.${part} must be used inside <DropdownMenu>`);
  return ctx;
}

export interface DropdownMenuProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** @default "bottom-start" */
  placement?: Placement;
  children: ReactNode;
}

function DropdownMenuRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  placement = "bottom-start",
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const triggerId = useId();
  const contentId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const intent = useRef<FocusIntent>("first");
  const floating = useFloating({ placement, offsetPx: 4, open, onOpenChange: setOpen });
  // Pointer light dismiss only; every key is handled by the menu itself.
  const { getFloatingProps } = useInteractions([useDismiss(floating.context, { escapeKey: false })]);

  const value = useMemo<MenuContextValue>(
    () => ({
      open,
      openWith: (next) => {
        intent.current = next;
        setOpen(true);
      },
      close: (restoreFocus = true) => {
        setOpen(false);
        if (restoreFocus) triggerRef.current?.focus();
      },
      intent,
      triggerId,
      contentId,
      triggerRef,
      floating,
      getFloatingProps,
    }),
    [open, setOpen, triggerId, contentId, floating, getFloatingProps]
  );
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export type DropdownMenuTriggerProps = ButtonProps & {
  /** Put the trigger behaviour on your own single child (an `IconButton`, say) instead of a `Button`. */
  asChild?: boolean;
};

function DropdownMenuTrigger({ asChild = false, children, onClick, onKeyDown, ...props }: DropdownMenuTriggerProps) {
  const { open, openWith, close, triggerId, contentId, triggerRef, floating } = useMenu("Trigger");
  const triggerProps = {
    id: triggerId,
    ...props,
    ref: mergeRefs((props as { ref?: React.Ref<HTMLButtonElement> }).ref, triggerRef, floating.refs.setReference),
    "aria-haspopup": "menu" as const,
    "aria-expanded": open,
    "aria-controls": open ? contentId : undefined,
    // `detail === 0` is a click synthesised from Enter/Space: open on the first item.
    onClick: composeEventHandlers(onClick, (event: React.MouseEvent) => {
      if (open) close(false);
      else openWith(event.detail === 0 ? "first" : "menu");
    }),
    onKeyDown: composeEventHandlers(onKeyDown, (event: KeyboardEvent) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        openWith(event.key === "ArrowDown" ? "first" : "last");
      }
    }),
  };
  if (asChild) return <Slot {...triggerProps}>{children}</Slot>;
  return (
    <Button variant="secondary" {...(triggerProps as ButtonProps)}>
      {children}
    </Button>
  );
}

const ITEM_SELECTOR = '[role^="menuitem"]:not([aria-disabled="true"])';
const TYPEAHEAD_RESET_MS = 600;

export type DropdownMenuContentProps = ComponentPropsWithRef<"div">;

/**
 * The menu panel (`role="menu"`). Arrow keys, Home/End and typeahead move
 * between enabled items; Enter/Space activates; Escape closes and returns focus
 * to the trigger; Tab closes and moves on.
 *
 * Rendered in place (a DOM sibling of the trigger) and promoted to the top
 * layer: a menu opened inside a `[data-density="compact"]` card is compact, and
 * an `overflow: hidden` ancestor does not clip it.
 */
function DropdownMenuContent({ className, children, style, ref, onKeyDown, ...props }: DropdownMenuContentProps) {
  const { open, close, intent, triggerId, contentId, floating, getFloatingProps } = useMenu("Content");
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!open || !menu) return;
    const items = [...menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
    const target =
      intent.current === "first" ? items[0] : intent.current === "last" ? items[items.length - 1] : undefined;
    // `preventScroll`: the panel may not be positioned yet in this frame.
    (target ?? menu).focus({ preventScroll: true });
  }, [open, intent]);

  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    if (!menu) return;
    const items = [...menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)];
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
        if (event.defaultPrevented) return;
        event.preventDefault();
        close();
        return;
      case "Tab":
        // Focus goes back to the trigger first, so the browser's own Tab move
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
      ref={mergeRefs(ref, menuRef, floating.refs.setFloating)}
      id={contentId}
      role="menu"
      aria-labelledby={triggerId}
      aria-orientation="vertical"
      tabIndex={-1}
      style={{ ...floating.floatingStyles, ...style }}
      className={cn(
        "flex min-w-[calc(var(--ROW-H)*5)] max-w-[min(var(--MEASURE),calc(100vw-var(--R-SIZE-2)*2))] max-h-[calc(var(--ROW-H)*12)] flex-col overflow-y-auto rounded-md border border-border bg-surface-0 p-r6 text-body-1 text-fg-primary shadow-md outline-none animate-fade-in",
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
  "relative flex min-h-row w-full cursor-default select-none items-center gap-r4 rounded-sm px-r4 text-start outline-none focus:bg-fg-primary/8 focus-visible:focus-ring-inset aria-disabled:opacity-disabled";

/**
 * The behaviour every item kind shares: activation by click, Enter or Space,
 * highlight following the pointer, and disabled gating (`aria-disabled` keeps a
 * disabled item readable, so nothing native stops its events: they are gated
 * here). Returns the props to spread and the caller's remaining DOM props.
 */
function useItem<P extends ItemBaseProps>(props: P, closeOnSelect: boolean, select: () => void) {
  const { disabled = false, onSelect, onClick, onKeyDown, onPointerMove, onPointerLeave, shortcut: _shortcut, ...rest } =
    props;
  const { close } = useMenu("Item");
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
    onPointerMove: composeEventHandlers(onPointerMove, (event: React.PointerEvent<HTMLDivElement>) => {
      if (!disabled && document.activeElement !== event.currentTarget) event.currentTarget.focus({ preventScroll: true });
    }),
    onPointerLeave: composeEventHandlers(onPointerLeave, (event: React.PointerEvent<HTMLDivElement>) => {
      (event.currentTarget.closest('[role="menu"]') as HTMLElement | null)?.focus({ preventScroll: true });
    }),
  };
  return { rest, itemProps };
}

function Shortcut({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("ms-auto ps-r3 text-body-3 text-fg-muted", className)}>{children}</span>;
}

export interface DropdownMenuItemProps extends ItemBaseProps {
  /** `error` marks a destructive action. @default "neutral" */
  tone?: "neutral" | "error";
  /** Leading icon, decorative. */
  icon?: ReactNode;
  /** @default true */
  closeOnSelect?: boolean;
  classNames?: SlotClassNames<"icon" | "shortcut">;
}

function DropdownMenuItem({ tone = "neutral", icon, closeOnSelect = true, classNames, ...props }: DropdownMenuItemProps) {
  const { rest, itemProps } = useItem(props, closeOnSelect, () => {});
  const { className, children, ...dom } = rest;
  return (
    <div
      {...dom}
      {...itemProps}
      role="menuitem"
      data-tone={tone}
      className={cn(itemClasses, tone === "error" && "text-fg-error", className)}
    >
      {icon && (
        <span
          aria-hidden
          className={cn(
            "flex shrink-0 [&>svg]:size-icon",
            tone === "error" ? "text-fg-error" : "text-fg-secondary",
            classNames?.icon
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {props.shortcut && <Shortcut className={classNames?.shortcut}>{props.shortcut}</Shortcut>}
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

export interface DropdownMenuCheckboxItemProps extends ItemBaseProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** @default false: a checkbox is usually toggled several times in a row. */
  closeOnSelect?: boolean;
}

function DropdownMenuCheckboxItem({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  closeOnSelect = false,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const [checked, setChecked] = useControllableState({
    value: checkedProp,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });
  const { rest, itemProps } = useItem(props, closeOnSelect, () => setChecked(!checked));
  const { className, children, ...dom } = rest;
  return (
    <div {...dom} {...itemProps} role="menuitemcheckbox" aria-checked={checked} className={cn(itemClasses, className)}>
      <Indicator>{checked && <Check />}</Indicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {props.shortcut && <Shortcut>{props.shortcut}</Shortcut>}
    </div>
  );
}

interface RadioContextValue {
  value: string | undefined;
  setValue: (value: string) => void;
}
const RadioContext = createContext<RadioContextValue | null>(null);

export interface DropdownMenuRadioGroupProps extends ComponentPropsWithRef<"div"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/** A set of mutually exclusive `RadioItem`s (`role="group"`; name it with `aria-label` or `aria-labelledby`). */
function DropdownMenuRadioGroup({ value, defaultValue, onValueChange, className, ...props }: DropdownMenuRadioGroupProps) {
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

export interface DropdownMenuRadioItemProps extends ItemBaseProps {
  value: string;
  /** @default false */
  closeOnSelect?: boolean;
}

function DropdownMenuRadioItem({ value, closeOnSelect = false, ...props }: DropdownMenuRadioItemProps) {
  const group = useContext(RadioContext);
  if (!group) throw new Error("DropdownMenu.RadioItem must be used inside <DropdownMenu.RadioGroup>");
  const checked = group.value === value;
  const { rest, itemProps } = useItem(props, closeOnSelect, () => group.setValue(value));
  const { className, children, ...dom } = rest;
  return (
    <div {...dom} {...itemProps} role="menuitemradio" aria-checked={checked} className={cn(itemClasses, className)}>
      <Indicator>{checked && <Circle className="size-r5! fill-current" />}</Indicator>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {props.shortcut && <Shortcut>{props.shortcut}</Shortcut>}
    </div>
  );
}

function DropdownMenuSeparator({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div role="separator" className={cn("-mx-r6 my-r6 h-px shrink-0 bg-border", className)} {...props} />;
}

/** A non-interactive heading for the items that follow. Give its `id` to a RadioGroup's `aria-labelledby`. */
function DropdownMenuLabel({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("px-r4 pb-r6 pt-r5 text-body-3 font-medium text-fg-muted", className)} {...props} />;
}

export const DropdownMenu = Object.assign(DropdownMenuRoot, {
  Trigger: DropdownMenuTrigger,
  Content: DropdownMenuContent,
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Label: DropdownMenuLabel,
});
