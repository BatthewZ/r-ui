"use client";
import { X } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useLightDismiss } from "../../hooks/use-light-dismiss";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { Button, type ButtonProps, IconButton } from "../primitives";
import { Slot, useExitPresence, usePresence, useRegister } from "./internal";

interface ModalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
  hasTitle: boolean;
  hasDescription: boolean;
  registerTitle: (present: boolean) => void;
  registerDescription: (present: boolean) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);
/** Whether Content shows its corner close button, so the Title can leave room for it. */
const CloseShownContext = createContext(false);

function useModal(part: string) {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error(`${part} must be used inside <Dialog> or <Drawer>`);
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** State root shared by `Dialog` and `Drawer`. Renders no element. */
function ModalRoot({ open: openProp, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const titleId = useId();
  const descriptionId = useId();
  const [hasTitle, registerTitle] = usePresence();
  const [hasDescription, registerDescription] = usePresence();
  const value = useMemo(
    () => ({
      open,
      setOpen,
      titleId,
      descriptionId,
      hasTitle,
      hasDescription,
      registerTitle,
      registerDescription,
    }),
    [open, setOpen, titleId, descriptionId, hasTitle, hasDescription, registerTitle, registerDescription]
  );
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export type DialogTriggerProps = ButtonProps & {
  /** Put the open behaviour on your own single child instead of a `Button`. */
  asChild?: boolean;
};

function ModalTrigger({ asChild = false, onClick, children, ...props }: DialogTriggerProps) {
  const { open, setOpen } = useModal("Dialog.Trigger");
  const triggerProps = {
    ...props,
    "aria-haspopup": "dialog" as const,
    "aria-expanded": open,
    onClick: composeEventHandlers(onClick, () => setOpen(true)),
  };
  if (asChild) return <Slot {...triggerProps}>{children}</Slot>;
  return (
    <Button variant="secondary" {...triggerProps}>
      {children}
    </Button>
  );
}

export type ModalContentProps = Omit<ComponentPropsWithRef<"dialog">, "open" | "role"> & {
  /**
   * `alertdialog` for a confirmation that interrupts: it has no corner close
   * button and no light dismiss, so the reader must answer it (Escape still
   * cancels). Put `autoFocus` on the least destructive action.
   * @default "dialog"
   */
  role?: "dialog" | "alertdialog";
  /** Close on a press that starts and ends on the scrim. @default true, false for `alertdialog` */
  lightDismiss?: boolean;
  /** Show the corner close button. @default true, false for `alertdialog` */
  showClose?: boolean;
  /** The close button's accessible name. @default "Close" */
  closeLabel?: string;
  classNames?: SlotClassNames<"close">;
};

/**
 * The `<dialog>` itself, opened with `showModal()`: the browser supplies the top
 * layer, the focus trap, inertness outside, the `::backdrop` scrim and Escape.
 * Rendered where it is written, so it keeps the density and direction of its
 * subtree. While open, the page behind does not scroll (the group's styles.css).
 *
 * It and its scrim transition in and out in CSS (the group's styles.css); on
 * close, focus returns at once while the panel finishes leaving.
 *
 * Children mount only while open (and through the exit), so a closed dialog
 * runs no effects and every open starts fresh.
 */
function ModalContent({
  role = "dialog",
  lightDismiss,
  showClose,
  closeLabel = "Close",
  className,
  classNames,
  children,
  ref,
  onPointerDown,
  onClick,
  onCancel,
  onClose,
  ...props
}: ModalContentProps) {
  const ctx = useModal("Dialog.Content");
  const { open, setOpen } = ctx;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isAlert = role === "alertdialog";
  const close = showClose ?? !isAlert;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    // Engines without `showModal` get a non-modal dialog rather than nothing.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, [open]);

  // Closing starts the CSS exit; the content stays mounted until it has run.
  const present = useExitPresence(open, dialogRef, { leave: closeDialog });

  const dismiss = useLightDismiss({
    ref: dialogRef,
    enabled: lightDismiss ?? !isAlert,
    onDismiss: () => setOpen(false),
    onPointerDown,
    onClick,
  });

  return (
    <dialog
      {...props}
      ref={mergeRefs(ref, dialogRef)}
      role={isAlert ? "alertdialog" : undefined}
      aria-labelledby={ctx.hasTitle ? ctx.titleId : undefined}
      aria-describedby={ctx.hasDescription ? ctx.descriptionId : undefined}
      // Escape: keep the element open until state says otherwise, so `open`
      // stays the single source of truth.
      onCancel={composeEventHandlers(onCancel, (event) => {
        event.preventDefault();
        setOpen(false);
      })}
      // The element can close itself (`<form method="dialog">`, `.close()`).
      onClose={composeEventHandlers(onClose, () => setOpen(false), { checkDefaultPrevented: false })}
      {...dismiss}
      // Leaving: on screen for its exit, but no longer interactive.
      inert={!open && present}
      className={cn(
        "r-overlays-modal flex-col gap-r3 border border-border bg-surface-0 p-r1 text-body-1 text-fg-primary shadow-lg open:flex backdrop:bg-scrim",
        className
      )}
    >
      {present && (
        <CloseShownContext.Provider value={close}>
          {children}
          {close && (
            <IconButton
              label={closeLabel}
              icon={<X />}
              variant="ghost"
              onClick={() => setOpen(false)}
              className={cn("absolute end-r3 top-r3", classNames?.close)}
            />
          )}
        </CloseShownContext.Provider>
      )}
    </dialog>
  );
}

function closeDialog(element: HTMLElement) {
  const dialog = element as HTMLDialogElement;
  if (!dialog.open) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

/** Title + description group at the top of the panel. Optional; `Title` alone works too. */
function ModalHeader({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("flex flex-col gap-r6", className)} {...props} />;
}

/** The accessible name of the dialog (wired to `aria-labelledby`). */
function ModalTitle({ className, ...props }: ComponentPropsWithRef<"h2">) {
  const ctx = useModal("Dialog.Title");
  const closeShown = useContext(CloseShownContext);
  useRegister(ctx.registerTitle);
  return (
    <h2
      id={ctx.titleId}
      className={cn("text-h3 text-fg-primary", closeShown && "pe-control", className)}
      {...props}
    />
  );
}

/** The dialog's description (wired to `aria-describedby`). */
function ModalDescription({ className, ...props }: ComponentPropsWithRef<"p">) {
  const ctx = useModal("Dialog.Description");
  useRegister(ctx.registerDescription);
  return <p id={ctx.descriptionId} className={cn("text-body-1 text-fg-secondary", className)} {...props} />;
}

/**
 * The part that scrolls when the content is taller than the panel; the header
 * and footer stay put. The padding (cancelled by an equal negative margin) is
 * room for focus rings, which the scroll container would otherwise clip.
 */
function ModalBody({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("relative -m-r5 min-h-0 flex-1 overflow-y-auto p-r5", className)} {...props} />;
}

/** The action row, at the inline end. Put the primary action last. */
function ModalFooter({ className, ...props }: ComponentPropsWithRef<"div">) {
  return <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-r4", className)} {...props} />;
}

export type DialogCloseProps = ButtonProps & {
  /** Put the close behaviour on your own single child instead of a `Button`. */
  asChild?: boolean;
};

/** Closes the dialog; focus returns to where it was before it opened. */
function ModalClose({ asChild = false, onClick, children, ...props }: DialogCloseProps) {
  const { setOpen } = useModal("Dialog.Close");
  const handleClick = composeEventHandlers(onClick, () => setOpen(false));
  if (asChild) return <Slot {...props} onClick={handleClick}>{children}</Slot>;
  return (
    <Button variant="secondary" {...props} onClick={handleClick}>
      {children}
    </Button>
  );
}

export const modalParts = {
  Trigger: ModalTrigger,
  Header: ModalHeader,
  Title: ModalTitle,
  Description: ModalDescription,
  Body: ModalBody,
  Footer: ModalFooter,
  Close: ModalClose,
};

export { ModalContent, ModalRoot };

export type DialogContentProps = ModalContentProps;

/** A centred modal panel. */
function DialogContent({ className, ...props }: DialogContentProps) {
  return <ModalContent className={cn("r-overlays-dialog m-auto rounded-lg", className)} {...props} />;
}

// A root of its own: `Object.assign` on the shared `ModalRoot` would hand
// Drawer's parts to Dialog too.
function DialogRoot(props: DialogProps) {
  return <ModalRoot {...props} />;
}

export const Dialog = Object.assign(DialogRoot, { ...modalParts, Content: DialogContent });
