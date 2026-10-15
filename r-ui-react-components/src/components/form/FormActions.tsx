"use client";
import { type ComponentPropsWithRef, useSyncExternalStore } from "react";

import { Button, type ButtonProps } from "../primitives";
import { cn, type SlotClassNames } from "../../util/style";

import { useFormStore } from "./form-state-context";

export interface FormActionsProps extends ComponentPropsWithRef<"div"> {
  /**
   * Keeps the row at the bottom of its scroll container while the form runs
   * past it (long forms), on `surface-0` with a top hairline, at the sticky
   * layer. Give it another `bg-*` when the form sits on another surface.
   */
  sticky?: boolean;
  classNames?: SlotClassNames<"row">;
}

/**
 * The form's submit / cancel row. Actions sit at the end, the primary one
 * last; when the row's OWN width is narrow they stack full-width with the
 * primary on top. Put the primary action last in the markup.
 */
function FormActionsRoot({ sticky = false, className, classNames, children, ...props }: FormActionsProps) {
  return (
    <div
      data-sticky={sticky ? "" : undefined}
      className={cn(
        // `shrink-0`: in a flex column (a dialog body beside a scroller) the
        // row keeps its height and the content scrolls instead.
        "@container shrink-0",
        sticky && "sticky bottom-0 z-sticky border-t bg-surface-0 py-r4",
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex flex-col-reverse gap-r5 *:w-full @sm:flex-row @sm:flex-wrap @sm:items-center @sm:justify-end @sm:*:w-auto",
          classNames?.row,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export type FormActionsSubmitProps = Omit<ButtonProps, "type">;

const subscribeNothing = () => () => {};

/**
 * The submit button: `type="submit"`, primary, and busy while the surrounding
 * `Form` submits (its async checks and `onSubmit` included), which also
 * ignores further presses. Outside a Form, `loading` is the caller's.
 */
function FormActionsSubmit({ loading, variant = "primary", ...props }: FormActionsSubmitProps) {
  const store = useFormStore();
  const getSubmitting = () => store?.getFormSnapshot().submitting ?? false;
  const submitting = useSyncExternalStore(store?.subscribe ?? subscribeNothing, getSubmitting, getSubmitting);
  return <Button type="submit" variant={variant} loading={loading ?? submitting} {...props} />;
}

export const FormActions = Object.assign(FormActionsRoot, { Submit: FormActionsSubmit });
