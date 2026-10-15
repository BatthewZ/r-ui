"use client";

import { TextWrap } from "lucide-react";
import { type CSSProperties, type HTMLAttributes, type ReactNode, type Ref, useId, useMemo } from "react";

import { useControllableState } from "../../hooks/use-controllable-state";
import { cn, type SlotClassNames } from "../../util/style";
import { IconButton } from "../primitives";
import { type CodeRole, type CodeRun, highlighter, normaliseCode, toLines, useHighlightStatus } from "./code-highlight";
import { CopyButton, type CopyButtonLabels } from "./CopyButton";

export interface CodeBlockLabels extends CopyButtonLabels {
  /** The wrap toggle's name. Default "Wrap lines". */
  wrap?: string;
}

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The source, rendered verbatim (CRLF normalised, one trailing newline dropped). */
  code: string;
  /**
   * A grammar name or alias (`ts`, `tsx`, `html`, `sh`…). Highlighted once that
   * language's grammar has loaded; an unknown name, or none, stays plain text.
   * Never guessed: a confident wrong colouring is worse than none.
   */
  language?: string;
  /** Shown in the header (and names the block for assistive tech). */
  filename?: string;
  /** A gutter of line numbers. They are generated content: never selected or copied. */
  lineNumbers?: boolean;
  /** 1-based line numbers to mark (a band and an inline-start bar). */
  highlightLines?: readonly number[];
  /** Wrap long lines instead of scrolling them. Controlled with `onWrapChange`. */
  wrap?: boolean;
  defaultWrap?: boolean;
  onWrapChange?: (wrap: boolean) => void;
  /** Show the copy button (default true). */
  copyable?: boolean;
  /** Show the wrap toggle (default true). */
  wrapToggle?: boolean;
  labels?: CodeBlockLabels;
  classNames?: SlotClassNames<"header" | "title" | "language" | "actions" | "pre" | "code" | "line">;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Colour by MEANING (`--C-CODE-*` domain tokens). Hue is never the only cue:
 * keywords carry weight and comments slant, so they still read under forced
 * colors or in a theme whose hues collide. A role-less run is body ink.
 */
const ROLE_CLASSES: Record<CodeRole, string> = {
  keyword: "text-code-keyword font-semibold",
  string: "text-code-string",
  number: "text-code-number",
  function: "text-code-function",
  type: "text-code-type",
  comment: "text-code-comment italic",
  property: "text-code-property",
  addition: "text-code-addition",
  deletion: "text-code-deletion",
  emphasis: "italic",
  strong: "font-semibold",
};

function renderRuns(runs: readonly CodeRun[]): ReactNode {
  return runs.map((run, index) =>
    run.role === null ? (
      run.text
    ) : (
      <span key={index} data-token={run.role} className={ROLE_CLASSES[run.role]}>
        {run.text}
      </span>
    ),
  );
}

/**
 * A block of source code: a header (filename / language, wrap toggle, copy),
 * optional line numbers and highlighted lines, and syntax colour for the
 * curated languages.
 *
 * Long lines scroll inside the `<pre>` (focusable, so the keyboard can scroll
 * it) or wrap; the block never widens its container. Each language's grammar is
 * loaded on first use; until then, past the size budget, for an unknown
 * language or when the load fails, the code renders as plain text in body ink.
 * Nothing is injected as HTML: lowlight's tree becomes React elements.
 *
 * `data-highlight` on the root says which: `pending`, `on` or `off`. The block
 * is a UI island inside prose (`data-not-prose`): it keeps the UI type scale.
 */
export function CodeBlock({
  code,
  language,
  filename,
  lineNumbers = false,
  highlightLines,
  wrap: wrapProp,
  defaultWrap = false,
  onWrapChange,
  copyable = true,
  wrapToggle = true,
  labels,
  classNames,
  className,
  ref,
  "aria-label": ariaLabel,
  ...props
}: CodeBlockProps) {
  const titleId = useId();
  const [wrap, setWrap] = useControllableState({ value: wrapProp, defaultValue: defaultWrap, onChange: onWrapChange });
  const lang = language?.trim() || undefined;
  const text = useMemo(() => normaliseCode(code), [code]);
  const status = useHighlightStatus(lang);
  const highlighted = useMemo(
    () => (status === "ready" && lang ? highlighter.highlight(text, lang) : null),
    [status, lang, text],
  );
  const lines = useMemo(() => highlighted ?? toLines([{ text, role: null }]), [highlighted, text]);
  const marked = useMemo(() => new Set(highlightLines), [highlightLines]);
  const state = highlighted ? "on" : status === "pending" ? "pending" : "off";

  const showHeader = Boolean(filename || lang || copyable || wrapToggle);
  const named = Boolean(filename) || ariaLabel !== undefined;

  return (
    <div
      ref={ref}
      role={named ? "group" : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel === undefined && filename ? titleId : undefined}
      data-not-prose=""
      data-highlight={state}
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-surface-1 text-fg-primary",
        className,
      )}
      {...props}
    >
      {showHeader && (
        <div
          className={cn(
            "flex min-w-0 items-center gap-r4 border-b border-border py-r6 ps-r3 pe-r6 text-body-3",
            classNames?.header,
          )}
        >
          <div className="flex min-w-0 flex-1 items-baseline gap-r5">
            {filename && (
              <span id={titleId} className={cn("min-w-0 truncate font-mono text-fg-primary", classNames?.title)} title={filename}>
                {filename}
              </span>
            )}
            {lang && (
              <span className={cn("shrink-0 font-medium uppercase text-fg-muted", classNames?.language)}>{lang}</span>
            )}
          </div>
          {(wrapToggle || copyable) && (
            <div className={cn("flex shrink-0 items-center gap-r6", classNames?.actions)}>
              {wrapToggle && (
                <IconButton
                  label={labels?.wrap ?? "Wrap lines"}
                  icon={<TextWrap />}
                  aria-pressed={wrap}
                  onClick={() => setWrap(!wrap)}
                />
              )}
              {copyable && (
                <CopyButton
                  value={code}
                  disabled={text === ""}
                  labels={{ copy: "Copy code", ...labels }}
                />
              )}
            </div>
          )}
        </div>
      )}
      <pre
        // The scrollport the keyboard must be able to reach (WCAG 2.1.1). A
        // wrapped block never scrolls sideways, so it is no tab stop.
        tabIndex={wrap ? undefined : 0}
        // Code reads left to right in an RTL page too; the header follows the page.
        dir="ltr"
        data-wrap={wrap || undefined}
        className={cn("r-content-code-pre font-mono text-body-2 focus-visible:focus-ring-inset", classNames?.pre)}
      >
        <code
          data-line-numbers={lineNumbers || undefined}
          className={cn("r-content-code", classNames?.code)}
          style={lineNumbers ? ({ "--r-content-code-digits": String(lines.length).length } as CSSProperties) : undefined}
        >
          {lines.map((runs, index) => (
            <span
              key={index}
              data-line={index + 1}
              data-highlighted={marked.has(index + 1) || undefined}
              className={cn("r-content-code-line", classNames?.line)}
            >
              <span className="r-content-code-text">{renderRuns(runs)}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
