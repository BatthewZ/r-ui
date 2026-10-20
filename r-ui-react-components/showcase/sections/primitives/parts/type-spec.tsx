import { type ElementType, type ReactNode, useLayoutEffect, useRef, useState } from "react";

const px = (value: string) => `${Math.round(Number.parseFloat(value) * 10) / 10}px`;

/**
 * A type sample with what it resolved to under the current View, read from the
 * browser (size / line height · weight, and the width for a measured block), so
 * flipping theme or density shows the numbers move with the text.
 */
export function TypeSample({
  name,
  as: Tag = "p",
  className,
  width = false,
  children,
}: {
  /** What the sample is: the utility or element it shows ("text-h1", "prose p"). */
  name: string;
  as?: ElementType;
  className?: string;
  /** Also report the block's width (a measure). */
  width?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [spec, setSpec] = useState("");

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const cs = getComputedStyle(el);
      const size = `${px(cs.fontSize)} / ${px(cs.lineHeight)} · ${cs.fontWeight}`;
      setSpec(width ? `${size} · ${px(String(el.getBoundingClientRect().width))} wide` : size);
    };
    read();
    // The View (theme, density, input) lives on <html>; a fluid size also moves with the box.
    const views = new MutationObserver(read);
    views.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-density", "data-input"] });
    const sizes = new ResizeObserver(read);
    sizes.observe(el);
    return () => {
      views.disconnect();
      sizes.disconnect();
    };
  }, [width]);

  return (
    <div className="grid min-w-0 gap-r6">
      <div className="flex flex-wrap items-baseline gap-x-r4 font-mono text-body-3 text-fg-muted">
        <span className="text-fg-secondary">{name}</span>
        <span>{spec}</span>
      </div>
      <Tag ref={ref} className={className}>
        {children}
      </Tag>
    </div>
  );
}
