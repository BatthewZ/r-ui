"use client";
import { ChevronDown } from "lucide-react";
import { type ComponentPropsWithRef, createContext, useContext, useId, useMemo } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { composeEventHandlers } from "../../util/merge-props";
import { cn } from "../../util/style";
import { Button, type ButtonProps } from "../primitives";
import { DisclosurePanel, type DisclosurePanelProps } from "./panel";

interface CollapsibleContextValue {
  open: boolean;
  toggle: () => void;
  disabled: boolean;
  triggerId: string;
  contentId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsible(part: string) {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error(`Collapsible.${part} must be used inside <Collapsible>`);
  return ctx;
}

export type CollapsibleProps = ComponentPropsWithRef<"div"> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
};

/**
 * One trigger that shows and hides one region (the APG disclosure pattern).
 * Controlled (`open` + `onOpenChange`) or not (`defaultOpen`). The root is a
 * plain `div` carrying `data-state`, so a caller can style the whole block.
 */
function CollapsibleRoot({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  children,
  ...props
}: CollapsibleProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const baseId = useId();
  const value = useMemo(
    () => ({
      open,
      toggle: () => {
        if (!disabled) setOpen((prev) => !prev);
      },
      disabled,
      triggerId: `${baseId}-trigger`,
      contentId: `${baseId}-content`,
    }),
    [open, disabled, setOpen, baseId]
  );
  return (
    <CollapsibleContext.Provider value={value}>
      <div data-state={open ? "open" : "closed"} data-disabled={disabled || undefined} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export type CollapsibleTriggerProps = ButtonProps & {
  /** Hide the chevron that turns with the state. */
  hideChevron?: boolean;
};

/**
 * A `Button` (ghost by default) with `aria-expanded` and `aria-controls`, and a
 * chevron after the label that turns when open. Enter and Space toggle it, as
 * any button.
 */
function CollapsibleTrigger({
  variant = "ghost",
  hideChevron = false,
  iconEnd,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const { open, toggle, disabled, triggerId, contentId } = useCollapsible("Trigger");
  return (
    <Button
      id={triggerId}
      variant={variant}
      disabled={disabled}
      {...props}
      aria-expanded={open}
      aria-controls={contentId}
      onClick={composeEventHandlers(onClick, toggle)}
      iconEnd={
        iconEnd ??
        (hideChevron ? undefined : (
          <ChevronDown
            className={cn("transition-transform duration-normal ease-standard", open && "rotate-180")}
          />
        ))
      }
    />
  );
}

export type CollapsibleContentProps = DisclosurePanelProps;

/** The region the trigger controls. Its height animates; closed, it is inert. */
function CollapsibleContent(props: CollapsibleContentProps) {
  const { open, contentId } = useCollapsible("Content");
  return <DisclosurePanel {...props} id={contentId} open={open} />;
}

export const Collapsible = Object.assign(CollapsibleRoot, {
  Trigger: CollapsibleTrigger,
  Content: CollapsibleContent,
});
