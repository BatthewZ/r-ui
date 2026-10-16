"use client";
import { X } from "lucide-react";
import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { useLightDismiss } from "../../hooks/use-light-dismiss";
import { type LabelsProp, useLabels } from "../../util/locale";
import { composeEventHandlers } from "../../util/merge-props";
import { mergeRefs } from "../../util/merge-refs";
import { cn, type SlotClassNames } from "../../util/style";
import { type ButtonProps, IconButton } from "../primitives";
import { ButtonOrSlot, type OpenStateProps, useExitPresence, usePartId, useRegisteredId } from "./internal";

interface ModalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** The id the mounted Title rendered (the caller's or a generated one); undefined without a Title. */
  titleId: string | undefined;
  descriptionId: string | undefined;
  registerTitle: (id: string | undefined) => void;
  registerDescription: (id: string | undefined) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);
/** Whether Content shows its corner close button, so the Title can leave room for it. */
const CloseShownContext = createContext(false);

function useModal(part: string) {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error(`${part} must be used inside <Dialog> or <Drawer>`);
  return ctx;
}

export interface DialogProps extends OpenStateProps {
  children: ReactNode;
}

/** State root shared by `Dialog` and `Drawer`. Renders no element. */
function ModalRoot({ open: openProp, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [titleId, registerTitle] = useRegisteredId();
  const [descriptionId, registerDescription] = useRegisteredId();
  const value = useMemo(
    () => ({ open, setOpen, titleId, descriptionId, registerTitle, registerDescription }),
    [open, setOpen, titleId, descriptionId, registerTitle, registerDescription]
  );
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export type DialogTriggerProps = ButtonProps & {
  /** Put the open behaviour on your own single child instead of a `Button`. */
  asChild?: boolean;
};

function ModalTrigger({ asChild = false, onClick, ...props }: DialogTriggerProps) {
  const { open, setOpen } = useModal("Dialog.Trigger");
  return (
    <ButtonOrSlot
      asChild={asChild}
      {...props}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={composeEventHandlers(onClick, () => setOpen(true))}
    />
  );
}

/** The dialog's own words. */
export interface DialogLabels {
  /** The corner close button's accessible name. */
  close: string;
}

export const DEFAULT_DIALOG_LABELS: Readonly<DialogLabels> = { close: "Close" };

declare module "../../util/locale" {
  interface LabelsRegistry {
    Dialog: DialogLabels;
  }
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
  /**
   * Where focus lands on open, for an element `autoFocus` cannot reach (one
   * that is not a form control or button). Otherwise a child's `autoFocus`
   * wins, then the first focusable element, as the browser's `showModal()`
   * chooses.
   */
  initialFocus?: RefObject<HTMLElement | null>;
  labels?: LabelsProp<DialogLabels>;
  classNames?: SlotClassNames<"close">;
};

/**
 * Opens the `<dialog>` from its FIRST child, so it runs after the children are
 * in the DOM but before the later siblings' `autoFocus` (React commits siblings
 * in order, children before parents). A child's `autoFocus` then lands in an
 * open dialog; opened from the dialog's own effect, it would hit a
 * `display: none` element and do nothing, and `showModal()` would pick the
 * first focusable element instead. The dialog is found through a hidden
 * marker: its ref is attached before this effect runs, the dialog's own ref
 * (a parent) only after it.
 */
function ShowModal({ open }: { open: boolean }) {
  const marker = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const dialog = marker.current?.parentElement;
    if (!open || !(dialog instanceof HTMLDialogElement) || dialog.open) return;
    // Engines without `showModal` get a non-modal dialog rather than nothing.
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }, [open]);
  return <span ref={marker} hidden />;
}

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
  initialFocus,
  labels,
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

  const text = useLabels("Dialog", DEFAULT_DIALOG_LABELS, labels);

  // After `ShowModal` (a child, so its effect ran first) and any `autoFocus`.
  useLayoutEffect(() => {
    if (open) initialFocus?.current?.focus();
  }, [open, initialFocus]);

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
      // The caller's own wiring wins; the parts fill in only what it left unset.
      aria-labelledby={props["aria-labelledby"] ?? ctx.titleId}
      aria-describedby={props["aria-describedby"] ?? ctx.descriptionId}
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
          <ShowModal open={open} />
          {children}
          {close && (
            <IconButton
              label={text.close}
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

/** The accessible name of the dialog (wired to `aria-labelledby`, by your `id` if you give one). */
function ModalTitle({ className, id, ...props }: ComponentPropsWithRef<"h2">) {
  const ctx = useModal("Dialog.Title");
  const closeShown = useContext(CloseShownContext);
  const ownId = usePartId(id, ctx.registerTitle);
  return (
    <h2
      {...props}
      id={ownId}
      className={cn("text-h3 text-fg-primary", closeShown && "pe-control", className)}
    />
  );
}

/** The dialog's description (wired to `aria-describedby`, by your `id` if you give one). */
function ModalDescription({ className, id, ...props }: ComponentPropsWithRef<"p">) {
  const ctx = useModal("Dialog.Description");
  const ownId = usePartId(id, ctx.registerDescription);
  return <p {...props} id={ownId} className={cn("text-body-1 text-fg-secondary", className)} />;
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
function ModalClose({ asChild = false, onClick, ...props }: DialogCloseProps) {
  const { setOpen } = useModal("Dialog.Close");
  return <ButtonOrSlot asChild={asChild} {...props} onClick={composeEventHandlers(onClick, () => setOpen(false))} />;
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
