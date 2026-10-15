"use client";
import { cn } from "../../util/style";
import { type DialogProps, ModalContent, type ModalContentProps, modalParts, ModalRoot } from "./Dialog";

export type DrawerProps = DialogProps;

export type DrawerContentProps = ModalContentProps & {
  /**
   * The edge it slides from. `end` is the inline end (right in LTR, left in
   * RTL); `bottom` is a sheet. Choosing `bottom` for a narrow layout is the
   * caller's call, made from whatever the caller knows about its own space:
   * the drawer never looks at the viewport.
   * @default "end"
   */
  side?: "end" | "bottom";
};

const sideClasses = {
  // Only the edge that faces the page carries the hairline.
  end: "r-overlays-drawer-end border-0 border-s animate-slide-in-end",
  bottom: "r-overlays-drawer-bottom border-0 border-t rounded-ss-lg rounded-se-lg",
} as const;

/** A modal panel attached to an edge. Same parts and behaviour as `Dialog`. */
function DrawerContent({ side = "end", className, ...props }: DrawerContentProps) {
  return <ModalContent data-side={side} className={cn(sideClasses[side], className)} {...props} />;
}

function DrawerRoot(props: DrawerProps) {
  return <ModalRoot {...props} />;
}

export const Drawer = Object.assign(DrawerRoot, { ...modalParts, Content: DrawerContent });
