import type { ErrorInfo, ReactNode } from "react";

import { ErrorBoundary, ErrorFallback } from "../../../src/components/feedback";
import type { Placement } from "./SideCards";

interface CardBoundaryProps extends Placement {
  /** The card's title: the fallback says which card failed. */
  title: string;
  /** The view the card shows: a new one retries a card that failed. */
  resetKeys: readonly unknown[];
  children: ReactNode;
}

/**
 * One per card, on the library's ErrorBoundary: a card that throws becomes a
 * fallback in its own grid cell (same id and placement, so the navigation still
 * scrolls to it) while every other card keeps working. Changing the view
 * (`resetKeys`) or "Try again" renders it afresh. `data-dashboard-error` is
 * what the browser check counts.
 */
export function CardBoundary({ title, resetKeys, id, className, children }: CardBoundaryProps) {
  const report = (error: unknown, info: ErrorInfo) =>
    console.error(`dashboard: the "${title}" card threw`, error, info.componentStack);
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onError={report}
      fallback={({ error, reset }) => (
        <ErrorFallback id={id} className={className} data-dashboard-error={title} error={error} onRetry={reset}>
          “{title}” could not be shown. The rest of the dashboard still works.
        </ErrorFallback>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
