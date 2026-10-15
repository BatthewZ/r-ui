"use client";
import { type ComponentPropsWithRef, type MouseEvent, type ReactNode, useSyncExternalStore } from "react";

import { Alert, Link } from "../primitives";
import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";

import { useFormStore } from "./form-state-context";
import type { FormErrorEntry } from "./form-state-store";

export interface ErrorSummaryProps extends Omit<ComponentPropsWithRef<"div">, "title" | "children"> {
  /** The headline, in the caller's language. */
  title?: ReactNode;
}

const subscribeNothing = () => () => {};
const NONE: FormErrorEntry[] = [];

function byDomOrder(entries: FormErrorEntry[]): Array<FormErrorEntry & { element: HTMLElement | null }> {
  const rows = entries.map((entry) => ({ ...entry, element: entry.field?.getElement() ?? null }));
  // Fields in the order they sit on the page; errors with no field after them.
  return rows.sort((a, b) => {
    if (!a.element || !b.element) return a.element ? -1 : b.element ? 1 : 0;
    if (a.element === b.element) return 0;
    return a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/**
 * The form's errors after a failed submit, for long forms: an error alert
 * (announced when it appears) listing each problem as a link that focuses
 * its field. Focus itself goes to the first invalid field, not here; with no
 * field to go to (a form-level server error) it comes here. Entries leave as
 * their fields are fixed, and the summary leaves with the last one.
 * Render it inside `Form`, above the fields.
 */
export function ErrorSummary({ title = "Fix these to continue", className, ref, ...props }: ErrorSummaryProps) {
  const store = useFormStore();
  const subscribe = store?.subscribe ?? subscribeNothing;
  const getFailed = () => store?.getFormSnapshot().submitFailed ?? false;
  const failed = useSyncExternalStore(subscribe, getFailed, getFailed);
  const getEntries = () => store?.getErrorEntries() ?? NONE;
  const entries = useSyncExternalStore(subscribe, getEntries, getEntries);
  if (!store) throw new Error("<ErrorSummary> must be rendered inside a <Form>.");
  if (!failed || entries.length === 0) return null;

  const focusField = (element: HTMLElement | null) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!element) return;
    element.focus({ preventScroll: true });
    element.scrollIntoView?.({ block: "center" });
  };

  return (
    <Alert ref={mergeRefs(ref, store.registerSummary)} tabIndex={-1} tone="error" title={title} className={cn("scroll-m-r2", className)} {...props}>
      <ul className="grid gap-r6">
        {byDomOrder(entries).map(({ path, message, field, element }) => {
          const label = field?.getLabel();
          const text = label ? `${label}: ${message}` : message;
          return (
            <li key={path} className="break-words">
              {element ? (
                <Link as="a" href={element.id ? `#${element.id}` : "#"} onClick={focusField(element)}>
                  {text}
                </Link>
              ) : (
                text
              )}
            </li>
          );
        })}
      </ul>
    </Alert>
  );
}
