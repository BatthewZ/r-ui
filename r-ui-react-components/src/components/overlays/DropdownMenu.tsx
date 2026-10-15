"use client";
import { createContext, type KeyboardEvent, type MouseEvent, type ReactNode, useContext, useRef } from "react";

import type { Placement } from "../../hooks/use-floating";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import type { ButtonProps } from "../primitives";
import { ButtonOrSlot, type OpenStateProps, usePartId, useRegisteredId } from "./internal";
import {
  type MenuCheckboxItemProps,
  type MenuContentProps,
  type MenuItemProps,
  menuParts,
  MenuProvider,
  type MenuRadioGroupProps,
  type MenuRadioItemProps,
  useMenu,
  useMenuRoot,
} from "./menu-internals";

export interface DropdownMenuProps extends OpenStateProps {
  /** @default "bottom-start" */
  placement?: Placement;
  children: ReactNode;
}

/** Registers the id the trigger rendered, so the menu is named by it. */
const RegisterTriggerContext = createContext<((id: string | undefined) => void) | undefined>(undefined);

function DropdownMenuRoot({ open, defaultOpen, onOpenChange, placement = "bottom-start", children }: DropdownMenuProps) {
  const [triggerId, registerTrigger] = useRegisteredId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const menu = useMenuRoot({
    open,
    defaultOpen,
    onOpenChange,
    placement,
    offsetPx: 4,
    labelledBy: triggerId,
    returnFocusRef: triggerRef,
  });
  return (
    <RegisterTriggerContext.Provider value={registerTrigger}>
      <MenuProvider value={menu}>{children}</MenuProvider>
    </RegisterTriggerContext.Provider>
  );
}

export type DropdownMenuTriggerProps = ButtonProps & {
  /** Put the trigger behaviour on your own single child (an `IconButton`, say) instead of a `Button`. */
  asChild?: boolean;
};

function DropdownMenuTrigger({ asChild = false, id, ref, onClick, onKeyDown, ...props }: DropdownMenuTriggerProps) {
  const { open, openWith, close, contentId, returnFocusRef, floating } = useMenu("DropdownMenu.Trigger");
  // Your `id` if you give one, else a generated one: the menu is named by whichever renders.
  const ownId = usePartId(id, useContext(RegisterTriggerContext));
  return (
    <ButtonOrSlot
      asChild={asChild}
      {...props}
      id={ownId}
      ref={mergeRefs(ref, returnFocusRef, floating.refs.setReference)}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-controls={open ? contentId : undefined}
      // `detail === 0` is a click synthesised from Enter/Space: open on the first item.
      onClick={composeEventHandlers(onClick, (event: MouseEvent) => {
        if (open) close(false);
        else openWith(event.detail === 0 ? "first" : "menu");
      })}
      onKeyDown={composeEventHandlers(onKeyDown, (event: KeyboardEvent) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          openWith(event.key === "ArrowDown" ? "first" : "last");
        }
      })}
    />
  );
}

export type DropdownMenuContentProps = MenuContentProps;
export type DropdownMenuItemProps = MenuItemProps;
export type DropdownMenuCheckboxItemProps = MenuCheckboxItemProps;
export type DropdownMenuRadioGroupProps = MenuRadioGroupProps;
export type DropdownMenuRadioItemProps = MenuRadioItemProps;

/**
 * A button that opens a menu of actions (WAI-ARIA menu button). The panel,
 * items and keyboard model are shared with `ContextMenu`.
 */
export const DropdownMenu = Object.assign(DropdownMenuRoot, { Trigger: DropdownMenuTrigger, ...menuParts });
