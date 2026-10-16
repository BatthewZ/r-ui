"use client";

import { RotateCw } from "lucide-react";
import {
  Component,
  type ComponentPropsWithRef,
  createContext,
  type ErrorInfo,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";

import { type LabelsProp, useLabels } from "../../util/locale";
import { cn, type SlotClassNames } from "../../util/style";
import { MARK_TEXT, ToneGlyph } from "../../util/tone";
import { Button } from "../primitives";

export interface ErrorFallbackLabels {
  title: string;
  /** The sentence under the title. */
  message: string;
  /** The retry button. */
  retry: string;
  /** The details disclosure's summary, and the name of the error text's scroller. */
  details: string;
}

export const DEFAULT_ERROR_FALLBACK_LABELS: ErrorFallbackLabels = {
  title: "Something went wrong",
  message: "This part of the page could not be shown. The rest of the page still works.",
  retry: "Try again",
  details: "Error details",
};

declare module "../../util/locale" {
  interface LabelsRegistry {
    ErrorFallback: ErrorFallbackLabels;
  }
}

/** The error as readable text: the stack where there is one (it starts with the message in V8), else its string. */
export function errorText(error: unknown): string {
  try {
    if (error instanceof Error) {
      const head = `${error.name}: ${error.message}`;
      const stack = error.stack ?? "";
      if (!stack) return head;
      return stack.includes(error.message) ? stack : `${head}\n${stack}`;
    }
    return typeof error === "string" ? error : String(error);
  } catch {
    // An object whose toString throws, or one with no prototype.
    return Object.prototype.toString.call(error);
  }
}

/** Set by an ErrorBoundary while it re-renders after its fallback's retry, so a fallback that comes back takes focus. */
const RetryFocusContext = createContext(false);

export type ErrorFallbackProps = {
  /** What was thrown; shown under `details`. */
  error?: unknown;
  /** Shows the retry button. Inside an ErrorBoundary: its reset. */
  onRetry?: () => void;
  /**
   * Shows the error's text (the stack, where there is one) in a disclosure.
   * Off by default: a stack names files and internals, so turn it on for an
   * audience that can use it.
   */
  details?: boolean;
  /** Replaces `labels.message`. */
  children?: ReactNode;
  labels?: LabelsProp<ErrorFallbackLabels>;
  classNames?: SlotClassNames<"icon" | "title" | "message" | "retry" | "details">;
} & Omit<ComponentPropsWithRef<"div">, "children">;

/**
 * The look of a part of the page that failed: the error glyph, a title, a
 * sentence, "Try again" and, optionally, the error text in a disclosure.
 * `role="alert"`. Sized by its content (it stands in for a card or a widget,
 * never the viewport). `ErrorBoundary` renders it; it also stands alone for a
 * failure that was never thrown (a fetch that came back 500).
 */
export function ErrorFallback({
  error,
  onRetry,
  details = false,
  children,
  labels: labelsProp,
  classNames,
  className,
  ...props
}: ErrorFallbackProps) {
  const labels = useLabels("ErrorFallback", DEFAULT_ERROR_FALLBACK_LABELS, labelsProp);
  const titleId = useId();
  const retryRef = useRef<HTMLButtonElement>(null);
  const refocus = useContext(RetryFocusContext);
  useEffect(() => {
    if (refocus) retryRef.current?.focus();
  }, [refocus]);

  return (
    <div
      role="alert"
      aria-labelledby={titleId}
      className={cn(
        "flex min-w-0 items-start gap-r4 rounded-md border border-border bg-surface-0 p-r3 text-body-1 text-fg-primary",
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn("inline-flex h-lh shrink-0 items-center", MARK_TEXT.error, classNames?.icon)}>
        <ToneGlyph tone="error" className="size-icon" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-r5 break-words">
        <div className="flex min-w-0 max-w-full flex-col gap-r6">
          <p id={titleId} className={cn("font-semibold", classNames?.title)}>
            {labels.title}
          </p>
          <div className={cn("text-body-2 text-fg-secondary", classNames?.message)}>{children ?? labels.message}</div>
        </div>
        {onRetry && (
          <Button
            ref={retryRef}
            data-print="hide"
            variant="secondary"
            iconStart={<RotateCw />}
            onClick={onRetry}
            className={classNames?.retry}
          >
            {labels.retry}
          </Button>
        )}
        {details && error !== undefined && (
          <details className={cn("min-w-0 max-w-full self-stretch", classNames?.details)}>
            <summary className="w-fit min-h-hit cursor-pointer content-center rounded-sm text-body-2 text-fg-secondary">
              {labels.details}
            </summary>
            <pre
              tabIndex={0}
              aria-label={labels.details}
              className="mt-r5 max-h-[calc(var(--ROW-H)*8)] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-surface-1 p-r4 font-mono text-body-3 text-fg-primary [overflow-wrap:anywhere]"
            >
              {errorText(error)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/** What a custom `fallback` receives. */
export interface ErrorBoundaryFallbackProps {
  error: unknown;
  /** Clears the error and renders the children again. */
  reset: () => void;
}

export type ErrorBoundaryResetReason = "retry" | "resetKeys";

export interface ErrorBoundaryProps {
  children?: ReactNode;
  /**
   * Replaces the `ErrorFallback`. A function receives the error and `reset`,
   * so a custom fallback keeps the retry.
   */
  fallback?: ReactNode | ((props: ErrorBoundaryFallbackProps) => ReactNode);
  /** Reports what was caught (to your logger), once per error, with React's component stack. */
  onError?: (error: unknown, info: ErrorInfo) => void;
  /**
   * Called as the boundary clears its error, before the children render
   * again: put right what made them throw here (clear a cache, refetch).
   * `retry` is the fallback's button or a custom fallback's `reset`;
   * `resetKeys` is a change of those keys.
   */
  onReset?: (reason: ErrorBoundaryResetReason) => void;
  /**
   * Values whose change clears the error by itself (a route, a filter, the
   * record shown): compared item by item with `Object.is`.
   */
  resetKeys?: readonly unknown[];
  /** Passed to the default fallback. */
  details?: boolean;
  /** Passed to the default fallback. */
  labels?: LabelsProp<ErrorFallbackLabels>;
  /** Passed to the default fallback's root. */
  className?: string;
}

interface ErrorBoundaryState {
  /** Separate from `error`: `throw undefined` is legal and must still trip the boundary. */
  failed: boolean;
  error: unknown;
}

const keysChanged = (a: readonly unknown[] = [], b: readonly unknown[] = []) =>
  a.length !== b.length || a.some((item, i) => !Object.is(item, b[i]));

/**
 * Contains a render error to one part of the page: wrap each widget, card or
 * section on its own, and one that throws shows an `ErrorFallback` in its
 * place while its siblings keep working. A class component because React
 * catches render errors only in one (`getDerivedStateFromError`).
 *
 * Catches what React catches: errors thrown while rendering, in lifecycle
 * methods and in effects below it. Not event handlers, async code or the
 * boundary's own fallback (those reach the next boundary up, or the page).
 * React reports each caught error itself (to `console.error` by default, or
 * the root's `onCaughtError`); `onError` is for your own reporting.
 *
 * "Try again" (`reset`) renders the children afresh; if they throw again, the
 * fallback returns with focus on its retry button, so a keyboard user is not
 * dropped to the document. When they recover, the fallback (and the focused
 * button) is gone: move focus in `onReset` if the recovered content has a
 * sensible target.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false, error: undefined };

  /** True from a retry until the children render without throwing. */
  private retrying = false;

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { failed: true, error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps, prevState: ErrorBoundaryState) {
    if (!this.state.failed) {
      this.retrying = false;
      return;
    }
    // Only an error that was already showing: keys that changed in the very
    // update that threw must not clear it at once.
    if (prevState.failed && keysChanged(prevProps.resetKeys, this.props.resetKeys)) this.clear("resetKeys");
  }

  private clear(reason: ErrorBoundaryResetReason) {
    this.retrying = reason === "retry";
    this.props.onReset?.(reason);
    this.setState({ failed: false, error: undefined });
  }

  /** Bound: handed to fallbacks. */
  reset = () => this.clear("retry");

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback, details, labels, className } = this.props;
    const { error } = this.state;
    const content =
      fallback === undefined ? (
        <ErrorFallback error={error} onRetry={this.reset} details={details} labels={labels} className={className} />
      ) : typeof fallback === "function" ? (
        fallback({ error, reset: this.reset })
      ) : (
        fallback
      );
    return <RetryFocusContext value={this.retrying}>{content}</RetryFocusContext>;
  }
}
