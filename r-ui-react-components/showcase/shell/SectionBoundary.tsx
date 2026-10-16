import type { ErrorInfo, ReactNode } from "react";

import { ErrorBoundary, ErrorFallback } from "../../src/components/feedback";

interface Props {
  /** Shown in the fallback, so a broken demo says which one it is. */
  title: string;
  children: ReactNode;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * One per demo section, on the library's own ErrorBoundary: a section that
 * throws renders the fallback instead of blanking the whole page.
 * `data-section-error` is what the browser checks count, so a tripped boundary
 * fails them even though the page still renders.
 */
export function SectionBoundary({ title, children }: Props) {
  const report = (error: unknown, info: ErrorInfo) =>
    console.error(`showcase: the "${title}" section threw`, error, info.componentStack);
  return (
    <ErrorBoundary
      onError={report}
      fallback={({ error, reset }) => (
        <ErrorFallback data-section-error={title} error={error} onRetry={reset} details>
          “{title}” failed to render: {messageOf(error)}
        </ErrorFallback>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
