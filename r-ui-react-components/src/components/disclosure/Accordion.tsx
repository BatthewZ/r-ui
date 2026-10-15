"use client";
import { ChevronDown } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  useContext,
  useId,
  useMemo,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { cn, type SlotClassNames } from "../../util/style";
import { DisclosurePanel, type DisclosurePanelProps } from "./panel";

/** The rank of the heading each trigger sits in. */
export type AccordionHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface AccordionContextValue {
  openValues: readonly string[];
  toggle: (value: string) => void;
  /** Single mode with `collapsible={false}`: the open item cannot be closed. */
  locked: boolean;
  headingLevel: AccordionHeadingLevel;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordion(part: string) {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error(`Accordion.${part} must be used inside <Accordion>`);
  return ctx;
}

interface ItemContextValue {
  value: string;
  open: boolean;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const ItemContext = createContext<ItemContextValue | null>(null);

function useItem(part: string) {
  const ctx = useContext(ItemContext);
  if (!ctx) throw new Error(`Accordion.${part} must be used inside <Accordion.Item>`);
  return ctx;
}

type AccordionBaseProps = Omit<ComponentPropsWithRef<"div">, "defaultValue" | "onChange"> & {
  /**
   * The rank of the heading each trigger sits in, so the sections appear in a
   * screen reader's heading list under the right parent. @default 3
   */
  headingLevel?: AccordionHeadingLevel;
};

export type AccordionSingleProps = AccordionBaseProps & {
  /** One item open at a time (the default). */
  multiple?: false;
  /** The open item, `null` for none. Controlled when not `undefined`. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Whether the open item can be closed again, leaving none open. @default true */
  collapsible?: boolean;
};

export type AccordionMultipleProps = AccordionBaseProps & {
  /** Any number of items open at once. */
  multiple: true;
  /** The open items. Controlled when not `undefined`. */
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  collapsible?: never;
};

export type AccordionProps = AccordionSingleProps | AccordionMultipleProps;

const toList = (value: string | null | readonly string[] | undefined): readonly string[] =>
  value == null ? [] : typeof value === "string" ? [value] : value;

const TRIGGER_ATTR = "data-accordion-trigger";
const ROOT_ATTR = "data-accordion";

/**
 * Stacked sections, each a heading with a button that shows and hides its panel
 * (the APG accordion pattern).
 *
 * - `multiple` lets several be open; otherwise opening one closes the other.
 *   Controlled (`value` + `onValueChange`) or not (`defaultValue`).
 * - Each trigger is a `<button>` inside an `h{headingLevel}`, with
 *   `aria-expanded` and `aria-controls`; each panel is a `region` named by its
 *   trigger. In single mode with `collapsible={false}` the open trigger is
 *   `aria-disabled`.
 * - Keyboard: Enter/Space toggle; Arrow Down/Up move between triggers (wrapping),
 *   Home/End go to the first/last; disabled items are skipped.
 * - Rows are `--ROW-H` tall at least (so they meet the hit floor) and follow
 *   density; panels animate their height, collapsing to nothing under reduced
 *   motion.
 */
function AccordionRoot(props: AccordionProps) {
  const {
    multiple = false,
    value,
    defaultValue,
    onValueChange: _onValueChange,
    collapsible = true,
    headingLevel = 3,
    className,
    children,
    ...rest
  } = props;

  const [openValues, setOpenValues] = useControllableState<readonly string[]>({
    value: value === undefined ? undefined : toList(value),
    // A single accordion seeded with several values opens only the first.
    defaultValue: multiple ? toList(defaultValue) : toList(defaultValue).slice(0, 1),
    onChange: (next) => {
      if (props.multiple) props.onValueChange?.([...next]);
      else props.onValueChange?.(next[0] ?? null);
    },
  });

  const locked = !multiple && !collapsible;
  const context = useMemo<AccordionContextValue>(
    () => ({
      openValues,
      locked,
      headingLevel,
      toggle: (item) =>
        setOpenValues((prev) => {
          const isOpen = prev.includes(item);
          if (multiple) return isOpen ? prev.filter((v) => v !== item) : [...prev, item];
          if (isOpen) return locked ? prev : [];
          return [item];
        }),
    }),
    [openValues, locked, headingLevel, multiple, setOpenValues]
  );

  return (
    <AccordionContext.Provider value={context}>
      <div
        data-accordion=""
        {...rest}
        className={cn("flex flex-col divide-y divide-border border-y border-border", className)}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export type AccordionItemProps = Omit<ComponentPropsWithRef<"div">, "value"> & {
  /** Identifies the item in `value`. */
  value: string;
  disabled?: boolean;
};

function AccordionItem({ value, disabled = false, children, ...props }: AccordionItemProps) {
  const { openValues } = useAccordion("Item");
  const open = openValues.includes(value);
  // Generated, never built from `value`: a value with a space would break the IDREFs.
  const baseId = useId();
  const item = useMemo(
    () => ({ value, open, disabled, triggerId: `${baseId}-trigger`, contentId: `${baseId}-content` }),
    [value, open, disabled, baseId]
  );
  return (
    <ItemContext.Provider value={item}>
      <div data-state={open ? "open" : "closed"} data-disabled={disabled || undefined} {...props}>
        {children}
      </div>
    </ItemContext.Provider>
  );
}

export type AccordionTriggerProps = ComponentPropsWithRef<"button"> & {
  /** `heading` is the `h1`–`h6` around the button; `chevron` the turning glyph. */
  classNames?: SlotClassNames<"heading" | "chevron">;
};

/** Arrow Down/Up, Home and End between this accordion's own enabled triggers. */
function moveFocus(event: KeyboardEvent<HTMLButtonElement>) {
  const root = event.currentTarget.closest(`[${ROOT_ATTR}]`);
  if (!root) return;
  // Only this accordion's: a nested accordion's triggers have another root.
  const triggers = [...root.querySelectorAll<HTMLButtonElement>(`[${TRIGGER_ATTR}]:not(:disabled)`)].filter(
    (trigger) => trigger.closest(`[${ROOT_ATTR}]`) === root
  );
  const index = triggers.indexOf(event.currentTarget);
  const last = triggers.length - 1;
  const target = {
    ArrowDown: index === last ? 0 : index + 1,
    ArrowUp: index <= 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key];
  if (target === undefined || index === -1) return;
  event.preventDefault();
  triggers[target]?.focus();
}

function AccordionTrigger({ className, classNames, children, onClick, onKeyDown, ...props }: AccordionTriggerProps) {
  const { toggle, locked, headingLevel } = useAccordion("Trigger");
  const { value, open, disabled, triggerId, contentId } = useItem("Trigger");
  const Heading = `h${headingLevel}` as const;
  const pinned = locked && open;
  return (
    <Heading className={cn("flex", classNames?.heading)}>
      <button
        type="button"
        data-accordion-trigger=""
        {...props}
        id={triggerId}
        aria-expanded={open}
        aria-controls={contentId}
        aria-disabled={pinned || undefined}
        disabled={disabled}
        onClick={composeEventHandlers(onClick, () => {
          if (!pinned) toggle(value);
        })}
        onKeyDown={composeEventHandlers(onKeyDown, moveFocus)}
        className={cn(
          "flex min-h-row w-full min-w-0 items-center gap-r4 px-r4 py-r5 text-start text-body-1 font-medium text-fg-primary transition-colors focus-visible:focus-ring-inset",
          !pinned && "cursor-pointer hover:bg-fg-primary/8 active:bg-fg-primary/12",
          "disabled:cursor-not-allowed disabled:opacity-disabled",
          className
        )}
      >
        <span className="min-w-0 flex-1 break-words">{children}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-icon shrink-0 text-fg-secondary transition-transform duration-normal ease-standard",
            open && "rotate-180",
            classNames?.chevron
          )}
        />
      </button>
    </Heading>
  );
}

export type AccordionContentProps = DisclosurePanelProps;

/** The item's panel: a `region` named by its trigger. Its height animates; closed, it is inert. */
function AccordionContent({ classNames, ...props }: AccordionContentProps) {
  const { open, triggerId, contentId } = useItem("Content");
  return (
    <DisclosurePanel
      role="region"
      aria-labelledby={triggerId}
      {...props}
      id={contentId}
      open={open}
      classNames={{ body: cn("px-r4 text-body-1 text-fg-secondary", classNames?.body) }}
    />
  );
}

export const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
  Trigger: AccordionTrigger,
  Content: AccordionContent,
});
