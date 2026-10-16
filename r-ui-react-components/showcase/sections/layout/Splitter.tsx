import { Archive, Inbox, Send, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Button, EmptyState, Skeleton, Splitter, type SplitterProps, Textarea } from "../../../src";
import { Row } from "./parts/demo";

export const meta = {
  title: "Splitter",
  group: "layout",
  order: 70,
  description:
    "Resizable panes with a focusable separator between each pair (APG window splitter): drag it, or focus it and use the arrows, Home and End; Enter collapses a collapsible pane and restores it. Bounds are shares or token lengths, sizes persist through a callback, splitters nest, and the handle's hit area meets the coarse floor without growing.",
};

const STORAGE_KEY = "r-ui-showcase:splitter-mail";

function readSaved(): number[] | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    return Array.isArray(parsed) && parsed.every((n) => typeof n === "number") ? parsed : undefined;
  } catch {
    return undefined;
  }
}

const FOLDERS = [
  { name: "Inbox", icon: Inbox, count: 12 },
  { name: "Sent", icon: Send, count: 0 },
  { name: "Archive", icon: Archive, count: 0 },
  { name: "Trash", icon: Trash2, count: 3 },
];

const MESSAGES = [
  { from: "Ada Lovelace", subject: "Scheduler notes for the analytical engine, third draft" },
  { from: "Grace Hopper", subject: "Nanoseconds" },
  { from: "Maximiliane von Hohenzollern-Sigmaringen", subject: "Re: Re: Re: Fwd: Quarterly infrastructure review and the Donaudampfschifffahrt" },
  { from: "Status bot", subject: "checkout-api recovered" },
];

/** A pane's padded, scrolling body: the pane scrolls, so its own content only needs to wrap. */
function PaneBody({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="grid min-w-0 content-start gap-r5 p-r4">
      <h3 className="text-h6 break-words">{title}</h3>
      {children}
    </div>
  );
}

function MailClient(props: Omit<SplitterProps, "children">) {
  return (
    <Splitter className="h-[calc(var(--ROW-H)*9)] rounded-md border bg-surface-0" {...props}>
      <Splitter.Pane label="Folders" min="calc(var(--CONTROL-H) * 3)" max={35} collapsible className="bg-surface-1">
        <nav aria-label="Folders" className="grid min-w-0 gap-r6 p-r5">
          {FOLDERS.map(({ name, icon: Icon, count }) => (
            <a
              key={name}
              href={`#/overview/layout-splitter/${name.toLowerCase()}`}
              className="flex min-h-row min-w-0 items-center gap-r5 rounded-sm px-r5 text-body-2 text-fg-primary hover:bg-fg-primary/8"
            >
              <Icon className="size-icon shrink-0" aria-hidden />
              <span className="truncate">{name}</span>
              {count > 0 && <span className="ms-auto text-fg-secondary">{count}</span>}
            </a>
          ))}
        </nav>
      </Splitter.Pane>
      <Splitter.Pane label="Messages" min="calc(var(--CONTROL-H) * 4)">
        <ul aria-label="Messages" className="grid min-w-0 divide-y">
          {MESSAGES.map((m) => (
            <li key={m.subject} className="grid min-w-0 px-r4 py-r5">
              <span className="truncate text-body-2 font-medium">{m.from}</span>
              <span className="truncate text-body-3 text-fg-secondary">{m.subject}</span>
            </li>
          ))}
        </ul>
      </Splitter.Pane>
      <Splitter.Pane label="Message" min="calc(var(--CONTROL-H) * 4)">
        <PaneBody title="Scheduler notes for the analytical engine, third draft">
          <p className="text-body-2 break-words text-fg-secondary">
            From Ada Lovelace. The engine may act upon other things besides number, were objects found whose mutual
            fundamental relations could be expressed by those of the abstract science of operations.
          </p>
        </PaneBody>
      </Splitter.Pane>
    </Splitter>
  );
}

function PersistedMail() {
  const [saved, setSaved] = useState(readSaved);
  const [key, setKey] = useState(0);
  const commit = (sizes: number[]) => {
    setSaved(sizes);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
    } catch {
      /* storage unavailable: the sizes still hold for this visit */
    }
  };
  const reset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* nothing stored */
    }
    setSaved(undefined);
    // Uncontrolled: a fresh splitter takes the defaults again.
    setKey((k) => k + 1);
  };
  return (
    <div className="grid min-w-0 gap-r5">
      <div data-testid="sp-mail" className="min-w-0">
        <MailClient key={key} defaultSizes={saved ?? [20, 35, 45]} onSizesCommit={commit} />
      </div>
      <div className="flex flex-wrap items-center gap-r4 text-body-3 text-fg-secondary">
        <span data-testid="sp-mail-saved">
          {saved ? `Saved: ${saved.map((s) => Math.round(s)).join(" · ")}` : "Nothing saved yet: move a separator"}
        </span>
        <Button variant="ghost" onClick={reset}>
          Reset sizes
        </Button>
      </div>
    </div>
  );
}

function EditorPreview() {
  const [text, setText] = useState(
    "Release notes\n\nSeparators follow density.\n\nThe preview collapses: focus the separator and press Enter."
  );
  return (
    <Splitter
      orientation="vertical"
      defaultSizes={[55, 45]}
      className="h-[calc(var(--ROW-H)*10)] rounded-md border bg-surface-0"
    >
      <Splitter.Pane label="Editor" min={25}>
        <div className="grid h-full min-w-0 p-r5">
          <Textarea aria-label="Markdown source" value={text} onChange={(e) => setText(e.target.value)} className="h-full" />
        </div>
      </Splitter.Pane>
      <Splitter.Pane label="Preview" min={20} collapsible>
        <PaneBody title="Preview">
          {text
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((para, i) => (
              <p key={i} className="text-body-2 break-words text-fg-secondary">
                {para}
              </p>
            ))}
        </PaneBody>
      </Splitter.Pane>
    </Splitter>
  );
}

function Nested() {
  return (
    <Splitter defaultSizes={[30, 70]} className="h-[calc(var(--ROW-H)*10)] rounded-md border bg-surface-0">
      {/* A pane scrolls what does not fit: at 375 this one is narrower than its empty state. */}
      <Splitter.Pane label="Explorer" min={15} max={50} data-sc-scrolls>
        <PaneBody title="Explorer">
          <EmptyState title="No folder open" description="Open a folder to see its files." headingLevel={4} />
        </PaneBody>
      </Splitter.Pane>
      <Splitter.Pane label="Workbench">
        <Splitter orientation="vertical" defaultSizes={[65, 35]} className="h-full">
          <Splitter.Pane label="Code" min={20}>
            <PaneBody title="Code">
              <Skeleton lines={4} label="Loading file" />
            </PaneBody>
          </Splitter.Pane>
          <Splitter.Pane label="Terminal" min={15} collapsible>
            <PaneBody title="Terminal">
              <p className="text-body-2 text-fg-error">Process exited with code 1.</p>
            </PaneBody>
          </Splitter.Pane>
        </Splitter>
      </Splitter.Pane>
    </Splitter>
  );
}

/** A sidebar pane collapsed by a button as well as by its separator: the sizes are the parent's. */
function CollapsibleSidebar() {
  const [sizes, setSizes] = useState<number[]>([25, 75]);
  const [last, setLast] = useState(25);
  const collapsed = sizes[0] === 0;
  const toggle = () => {
    if (collapsed) setSizes([last, 100 - last]);
    else {
      setLast(sizes[0] ?? 25);
      setSizes([0, 100]);
    }
  };
  return (
    <div className="grid min-w-0 gap-r5" data-testid="sp-sidebar">
      <div>
        <Button variant="secondary" aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? "Show sidebar" : "Hide sidebar"}
        </Button>
      </div>
      <Splitter
        sizes={sizes}
        onSizesChange={setSizes}
        className="h-[calc(var(--ROW-H)*6)] rounded-md border bg-surface-0"
      >
        <Splitter.Pane label="Sidebar" min={15} max={45} collapsible className="bg-surface-1">
          <PaneBody title="Sidebar">
            <p className="text-body-2 text-fg-secondary">Drag the separator to its start, press Enter on it, or use the button.</p>
          </PaneBody>
        </Splitter.Pane>
        <Splitter.Pane>
          <PaneBody title="Content">
            <p className="text-body-2 text-fg-secondary">
              {collapsed ? "The sidebar is collapsed: its separator stays at the edge." : "The sidebar is open."}
            </p>
          </PaneBody>
        </Splitter.Pane>
      </Splitter>
    </div>
  );
}

export default function SplitterSection() {
  return (
    <div className="grid min-w-0 gap-r2">
      <Row label="Mail client: three panes, the folders collapsible, bounds in tokens, sizes saved on each commit">
        <PersistedMail />
      </Row>
      <Row label="Editor over preview (vertical); the preview collapses">
        <div data-testid="sp-editor" className="min-w-0">
          <EditorPreview />
        </div>
      </Row>
      <Row label="Nested: an explorer beside code over a terminal (empty, loading and error panes)">
        <div data-testid="sp-nested" className="min-w-0">
          <Nested />
        </div>
      </Row>
      <Row label="A sidebar the parent collapses (controlled sizes)">
        <CollapsibleSidebar />
      </Row>
      <Row label="RTL: the separators mirror, ArrowLeft grows the pane before">
        <div dir="rtl" data-testid="sp-rtl" className="min-w-0">
          <MailClient defaultSizes={[20, 35, 45]} />
        </div>
      </Row>
      <Row label="Compact: a thinner gutter, the same hit floor">
        <div data-density="compact" data-testid="sp-compact" className="min-w-0">
          <MailClient defaultSizes={[20, 35, 45]} />
        </div>
      </Row>
    </div>
  );
}
