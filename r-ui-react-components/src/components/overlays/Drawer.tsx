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

// Only the edge that faces the page carries the hairline. The second shadow is the drawer's
// fill continued past the edge it is flush with (`--r-overlays-drawer-bleed`, styles.css).
const BLEED_SHADOW = "shadow-[shadow:var(--SHADOW-LG),var(--r-overlays-drawer-bleed)]";
const sideClasses = {
  end: `r-overlays-drawer-end border-0 border-s ${BLEED_SHADOW}`,
  bottom: `r-overlays-drawer-bottom border-0 border-t rounded-ss-lg rounded-se-lg ${BLEED_SHADOW}`,
} as const;

/** A modal panel attached to an edge. Same parts and behaviour as `Dialog`. */
function DrawerContent({ side = "end", className, ...props }: DrawerContentProps) {
  return <ModalContent data-side={side} className={cn(sideClasses[side], className)} {...props} />;
}

function DrawerRoot(props: DrawerProps) {
  return <ModalRoot {...props} />;
}

export const Drawer = Object.assign(DrawerRoot, { ...modalParts, Content: DrawerContent });
