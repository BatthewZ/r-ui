"use client";
import { type ChangeEvent, type ComponentPropsWithRef, useCallback, useLayoutEffect, useRef } from "react";

import { mergeRefs } from "../../util/merge-refs";
import { cn } from "../../util/style";

import { useFieldControl, useFieldInputProps } from "./Field";

export interface TextareaProps extends ComponentPropsWithRef<"textarea"> {
  invalid?: boolean;
  /**
   * Grow with the content instead of scrolling. `rows` is then the minimum
   * height and `maxRows` the cap, past which the textarea scrolls.
   */
  autosize?: boolean;
  /** With `autosize`: the most rows to grow to. Unbounded when omitted. */
  maxRows?: number;
}

const px = (value: string) => Number.parseFloat(value) || 0;

function fitToContent(el: HTMLTextAreaElement, maxRows: number | undefined) {
  const style = getComputedStyle(el);
  // Physical on purpose: `style.height` is physical, so its parts must be too.
  const border = px(style.borderTopWidth) + px(style.borderBottomWidth);
  el.style.height = "auto";
  let height = el.scrollHeight + border;
  let overflow = "hidden";
  if (maxRows !== undefined) {
    const padding = px(style.paddingTop) + px(style.paddingBottom);
    const cap = px(style.lineHeight) * maxRows + padding + border;
    if (height > cap) {
      height = cap;
      overflow = "auto";
    }
  }
  el.style.height = `${height}px`;
  el.style.overflowY = overflow;
}

/** Multi-line text. The one control not at `h-control`: its height is its rows. */
export function Textarea({
  invalid: invalidProp,
  autosize = false,
  maxRows,
  rows = 3,
  className,
  ref,
  id: idProp,
  required: requiredProp,
  disabled: disabledProp,
  readOnly: readOnlyProp,
  "aria-describedby": describedByProp,
  "aria-invalid": ariaInvalidProp,
  onChange,
  ...props
}: TextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const field = useFieldControl({
    id: idProp,
    invalid: invalidProp,
    required: requiredProp,
    disabled: disabledProp,
    readOnly: readOnlyProp,
    "aria-describedby": describedByProp,
    "aria-invalid": ariaInvalidProp,
  });

  const fit = useCallback(() => {
    if (autosize && innerRef.current) fitToContent(innerRef.current, maxRows);
  }, [autosize, maxRows]);

  // Every render: a controlled value can change without an input event.
  useLayoutEffect(fit);

  // Re-fit when the width changes (wrapping moves), e.g. a container resize.
  // Keyed to the BORDER box's inline size, which neither the height a fit sets nor
  // the scrollbar it toggles at `maxRows` can move (`clientWidth` loses the
  // scrollbar's width, so a fit used to re-trigger itself). The fit runs in the
  // next frame, outside the observer's delivery: resizing an observed element
  // inside it is what the browser reports as a "ResizeObserver loop".
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!autosize || !el || typeof ResizeObserver === "undefined") return;
    let width = el.offsetWidth;
    let frame = 0;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.inlineSize ?? el.offsetWidth;
      if (next === width) return;
      width = next;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(el, { box: "border-box" });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [autosize, fit]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    // Uncontrolled typing re-renders nothing, so fit here too.
    fit();
  };
  // In a Field bound to a Form, the form owns the value (unless the caller passed one).
  const nativeProps = useFieldInputProps({ ...props, onChange: handleChange });

  return (
    <textarea
      ref={mergeRefs(ref, innerRef)}
      rows={rows}
      id={field.id}
      required={field.required}
      disabled={field.disabled}
      readOnly={field.readOnly}
      {...field.ariaProps}
      data-invalid={field.invalid ? "" : undefined}
      data-disabled={field.disabled ? "" : undefined}
      data-readonly={field.readOnly ? "" : undefined}
      className={cn(
        "r-form-frame block min-h-control w-full min-w-0 px-r3 py-r4 text-body-1 text-fg-primary",
        autosize ? "resize-none" : "resize-y data-disabled:resize-none",
        className,
      )}
      {...nativeProps}
    />
  );
}
