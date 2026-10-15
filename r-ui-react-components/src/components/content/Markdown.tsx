"use client";

import { Check } from "lucide-react";
import { type ComponentType, type HTMLAttributes, type ReactNode, type Ref, useMemo } from "react";

import { isExternalHref } from "../../util/router";
import { type LabelsProp, mergeLabels } from "../../util/labels";
import { cn } from "../../util/style";
import { Table } from "../data";
import { Link } from "../primitives";
import { CodeBlock } from "./CodeBlock";
import { type BlockNode, type HeadingLevel, type InlineNode, parseBlocks, type TableAlign } from "./markdown-parse";

export type MarkdownHeadingLevel = HeadingLevel;

/**
 * Renderers for each node the parser produces. Every one receives values the
 * component has already judged: a `link`'s `href` has passed `safeUrl`, an
 * `image` reaches `image` only when its `src` passed `safeUrl` AND the
 * allowlist. Text arrives as React children, never as markup.
 */
export interface MarkdownComponents {
  heading: ComponentType<{ level: MarkdownHeadingLevel; children: ReactNode }>;
  paragraph: ComponentType<{ children: ReactNode }>;
  strong: ComponentType<{ children: ReactNode }>;
  emphasis: ComponentType<{ children: ReactNode }>;
  strikethrough: ComponentType<{ children: ReactNode }>;
  /** `external`: it leaves the site for an http(s) page (as a browser resolves it: `/\host` is another host). */
  link: ComponentType<{ href: string; title?: string; external: boolean; children: ReactNode }>;
  image: ComponentType<{ src: string; alt: string; title?: string }>;
  inlineCode: ComponentType<{ children: string }>;
  codeBlock: ComponentType<{ code: string; language?: string }>;
  blockquote: ComponentType<{ children: ReactNode }>;
  list: ComponentType<{ ordered: boolean; start?: number; children: ReactNode }>;
  /** `checked` is set only on a task item (`- [ ]` / `- [x]`). */
  listItem: ComponentType<{ checked?: boolean; children: ReactNode }>;
  table: ComponentType<{ align: readonly TableAlign[]; header: readonly ReactNode[]; rows: readonly (readonly ReactNode[])[] }>;
  thematicBreak: ComponentType<object>;
}

export interface MarkdownLabels {
  /** Description of a link that opens in a new tab. */
  newTab: string;
  /** Spoken before a done task item. */
  taskDone: string;
  /** Spoken before an open task item. */
  taskOpen: string;
}

export const DEFAULT_MARKDOWN_LABELS: Readonly<MarkdownLabels> = {
  newTab: "(opens in a new tab)",
  taskDone: "Done:",
  taskOpen: "To do:",
};

export interface MarkdownProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The Markdown source (untrusted is fine: raw HTML renders as text, URLs are judged). */
  children: string;
  /** Added to every heading level, capped at 6: `1` makes `#` an `<h2>` under the page's own `<h1>`. */
  headingOffset?: number;
  /**
   * Where images may come from. Without it no image loads; each renders as its
   * alt text. Entries are absolute URL prefixes (`https://cdn.example.com/img/`,
   * matched by origin and path) or root-relative path prefixes (`/assets/`).
   */
  imageAllowlist?: readonly string[];
  /** Override how any node renders. */
  components?: Partial<MarkdownComponents>;
  labels?: LabelsProp<MarkdownLabels>;
  /** Cap the line length at the reading measure. Default false. */
  measure?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/* ------------------------------------------------------------------ */
/*  Judgements                                                         */
/* ------------------------------------------------------------------ */

const SITE = "https://r-ui.invalid";

/**
 * Whether a link opens another web page: it leaves the app (`isExternalHref`,
 * so `/\host` counts) for an http(s) URL. `mailto:` and `tel:` leave too, but
 * open no page to put in a tab.
 */
function isExternal(href: string): boolean {
  if (!isExternalHref(href)) return false;
  try {
    return /^https?:$/.test(new URL(href, SITE).protocol);
  } catch {
    return false;
  }
}

/**
 * The same-site path a root-relative `src` resolves to (dot segments resolved, so
 * `/assets/../secret.png` is not under `/assets/`), or null when it leaves the
 * site (`/\host/…` is another host to a URL parser) or does not parse.
 */
function sitePath(src: string): string | null {
  try {
    const url = new URL(src, SITE);
    return url.origin === SITE ? url.pathname : null;
  } catch {
    return null;
  }
}

/** Whether `src` (already through `safeUrl`) is under an allowlist entry. */
export function imageAllowed(src: string, allowlist: readonly string[]): boolean {
  const rootRelative = (s: string) => s.startsWith("/") && !s.startsWith("//");
  for (const entry of allowlist) {
    if (rootRelative(entry)) {
      if (rootRelative(src) && sitePath(src)?.startsWith(entry)) return true;
      continue;
    }
    let base: URL;
    let target: URL;
    try {
      base = new URL(entry);
      target = new URL(src);
    } catch {
      continue;
    }
    if (target.origin === base.origin && target.origin !== "null" && target.pathname.startsWith(base.pathname)) {
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Default renderers                                                  */
/* ------------------------------------------------------------------ */

const ALIGN_CLASSES: Record<Exclude<TableAlign, null>, string> = {
  left: "text-start",
  center: "text-center",
  right: "text-end",
};

const alignOf = (align: readonly TableAlign[], index: number) => {
  const value = align[index];
  return value ? ALIGN_CLASSES[value] : undefined;
};

const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function makeDefaults(labels: MarkdownLabels): MarkdownComponents {
  return {
    heading: ({ level, children }) => {
      const Tag = HEADING_TAGS[level - 1] ?? "h6";
      return <Tag>{children}</Tag>;
    },
    paragraph: ({ children }) => <p>{children}</p>,
    strong: ({ children }) => <strong>{children}</strong>,
    emphasis: ({ children }) => <em>{children}</em>,
    strikethrough: ({ children }) => <del>{children}</del>,
    // The library Link: theme link lever, `safeUrl` again (defence in depth), and
    // for a link that leaves the site a new tab with its glyph, `noopener`, and
    // the new-tab description.
    link: ({ href, title, external, children }) =>
      external ? (
        <Link href={href} title={title} target="_blank" labels={{ newTab: labels.newTab }}>
          {children}
        </Link>
      ) : (
        <Link href={href} title={title}>
          {children}
        </Link>
      ),
    image: ({ src, alt, title }) => <img src={src} alt={alt} title={title} loading="lazy" className="h-auto max-w-full" />,
    inlineCode: ({ children }) => <code>{children}</code>,
    codeBlock: ({ code, language }) => <CodeBlock code={code} language={language} className="r-content-md-block" />,
    blockquote: ({ children }) => <blockquote>{children}</blockquote>,
    list: ({ ordered, start, children }) => (ordered ? <ol start={start}>{children}</ol> : <ul>{children}</ul>),
    listItem: ({ checked, children }) =>
      checked === undefined ? (
        <li>{children}</li>
      ) : (
        <li className="r-content-md-task" data-checked={checked}>
          <span className="r-content-md-task-box" aria-hidden>
            {checked && <Check />}
          </span>
          <span className="sr-only">{checked ? labels.taskDone : labels.taskOpen} </span>
          {children}
        </li>
      ),
    // The library Table, a UI island: UI type and row height inside prose.
    // Cells wrap (prose-like values); a wide table scrolls inside its own box.
    table: ({ align, header, rows }) => (
      <Table data-not-prose="" className="r-content-md-block">
        <Table.Head>
          <Table.Row>
            {header.map((cell, index) => (
              <Table.HeaderCell key={index} wrap className={alignOf(align, index)}>
                {cell}
              </Table.HeaderCell>
            ))}
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {rows.map((row, rowIndex) => (
            <Table.Row key={rowIndex}>
              {row.map((cell, index) => (
                <Table.Cell key={index} wrap className={alignOf(align, index)}>
                  {cell}
                </Table.Cell>
              ))}
            </Table.Row>
          ))}
        </Table.Body>
      </Table>
    ),
    thematicBreak: () => <hr />,
  };
}

/* ------------------------------------------------------------------ */
/*  Rendering                                                          */
/* ------------------------------------------------------------------ */

interface Ctx {
  c: MarkdownComponents;
  offset: number;
  allowlist: readonly string[];
}

function renderInline(nodes: readonly InlineNode[], ctx: Ctx): ReactNode[] {
  const { c } = ctx;
  return nodes.map((node, key) => {
    switch (node.type) {
      case "text":
        // A string child: React escapes it, so `<script>` is eight visible characters.
        return node.value;
      case "code":
        return <c.inlineCode key={key}>{node.value}</c.inlineCode>;
      case "strong":
        return <c.strong key={key}>{renderInline(node.children, ctx)}</c.strong>;
      case "em":
        return <c.emphasis key={key}>{renderInline(node.children, ctx)}</c.emphasis>;
      case "del":
        return <c.strikethrough key={key}>{renderInline(node.children, ctx)}</c.strikethrough>;
      case "break":
        return <br key={key} />;
      case "link":
        return (
          <c.link key={key} href={node.href} title={node.title} external={isExternal(node.href)}>
            {renderInline(node.children, ctx)}
          </c.link>
        );
      case "image":
        // Not on the allowlist: the author's words stay, an image does not load.
        return imageAllowed(node.src, ctx.allowlist) ? (
          <c.image key={key} src={node.src} alt={node.alt} title={node.title} />
        ) : node.alt ? (
          <span key={key} className="r-content-md-image-alt">
            {node.alt}
          </span>
        ) : null;
    }
  });
}

/**
 * A tight list's single-paragraph item renders its inlines directly; a loose
 * one (a blank line between items) keeps its paragraphs and their rhythm.
 */
function renderItem(children: readonly BlockNode[], loose: boolean, ctx: Ctx): ReactNode {
  const [only] = children;
  if (!loose && children.length === 1 && only?.type === "paragraph") return renderInline(only.children, ctx);
  return renderBlocks(children, ctx);
}

function renderBlocks(nodes: readonly BlockNode[], ctx: Ctx): ReactNode[] {
  const { c } = ctx;
  return nodes.map((node, key) => {
    switch (node.type) {
      case "heading": {
        const level = Math.min(6, Math.max(1, node.level + ctx.offset)) as MarkdownHeadingLevel;
        return (
          <c.heading key={key} level={level}>
            {renderInline(node.children, ctx)}
          </c.heading>
        );
      }
      case "paragraph":
        return <c.paragraph key={key}>{renderInline(node.children, ctx)}</c.paragraph>;
      case "code":
        return <c.codeBlock key={key} code={node.value} language={node.lang} />;
      case "list":
        return (
          <c.list key={key} ordered={node.ordered} start={node.ordered && node.start !== 1 ? node.start : undefined}>
            {node.items.map((item, index) => (
              <c.listItem key={index} checked={item.checked}>
                {renderItem(item.children, node.loose, ctx)}
              </c.listItem>
            ))}
          </c.list>
        );
      case "blockquote":
        return <c.blockquote key={key}>{renderBlocks(node.children, ctx)}</c.blockquote>;
      case "table":
        return (
          <c.table
            key={key}
            align={node.align}
            header={node.header.map((cell) => renderInline(cell, ctx))}
            rows={node.rows.map((row) => row.map((cell) => renderInline(cell, ctx)))}
          />
        );
      case "hr":
        return <c.thematicBreak key={key} />;
    }
  });
}

/**
 * Renders a closed GFM subset of Markdown as real components, inside a prose
 * region (`.prose`: the prose type scale and reading leading). Code blocks are
 * `CodeBlock`s and tables the library `Table`, both UI islands that keep the UI
 * scale.
 *
 * Untrusted by default. Nothing becomes HTML: the parser builds a tree and this
 * renders React elements from it, so raw HTML (`<script>`) shows as text and
 * HTML comments are dropped. Links pass `safeUrl` (a `javascript:` or `data:`
 * link is its text, not a link), and one that leaves the site opens a new tab
 * with the Link primitive's glyph and description. Images load only from
 * `imageAllowlist`. Nesting deeper than the parser's caps is kept as text.
 */
export function Markdown({
  children,
  headingOffset = 0,
  imageAllowlist = [],
  components,
  labels,
  measure = false,
  className,
  ref,
  ...props
}: MarkdownProps) {
  const blocks = useMemo(() => parseBlocks(children), [children]);
  const newTab = labels?.newTab;
  const taskDone = labels?.taskDone;
  const taskOpen = labels?.taskOpen;
  const defaults = useMemo(
    () =>
      // Keyed by each label, not the `labels` object a caller rebuilds every render.
      makeDefaults(mergeLabels(DEFAULT_MARKDOWN_LABELS, { newTab, taskDone, taskOpen })),
    [newTab, taskDone, taskOpen],
  );
  // An override given as `undefined` must not erase the default renderer.
  const overrides = Object.fromEntries(
    Object.entries(components ?? {}).filter(([, renderer]) => renderer !== undefined),
  ) as Partial<MarkdownComponents>;
  const ctx: Ctx = {
    c: { ...defaults, ...overrides },
    offset: Math.trunc(headingOffset) || 0,
    allowlist: imageAllowlist,
  };

  return (
    <div
      ref={ref}
      className={cn("r-content-md prose min-w-0 text-fg-primary [overflow-wrap:anywhere]", measure && "max-w-measure", className)}
      {...props}
    >
      {renderBlocks(blocks, ctx)}
    </div>
  );
}
