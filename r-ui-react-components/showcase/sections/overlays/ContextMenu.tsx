import { Copy, Download, FileText, Image, Pencil, Scissors, Share2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Card } from "../../../src/components/primitives";
import { ContextMenu } from "../../../src/components/overlays";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "ContextMenu",
  group: "overlays",
  order: 32,
  description:
    "DropdownMenu's panel, items and keys, opened where you point: right-click opens it at the pointer, Shift+F10 or the Menu key at the focused element, a touch held still for half a second under the finger (a touch that moves, a scroll, never does). Focus returns to what had it. In place and in the top layer, so the compact card's menu is compact and escapes its clip.",
};

function CanvasMenu() {
  const [grid, setGrid] = useState(true);
  const [snap, setSnap] = useState(false);
  const [zoom, setZoom] = useState("fit");
  return (
    <ContextMenu.Content aria-label="Canvas actions">
      <ContextMenu.Item icon={<Scissors />} shortcut="⌘X">
        Cut
      </ContextMenu.Item>
      <ContextMenu.Item icon={<Copy />} shortcut="⌘C">
        Copy
      </ContextMenu.Item>
      <ContextMenu.Item icon={<Download />} disabled>
        Paste (clipboard empty)
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Label>Show</ContextMenu.Label>
      <ContextMenu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
        Grid
      </ContextMenu.CheckboxItem>
      <ContextMenu.CheckboxItem checked={snap} onCheckedChange={setSnap}>
        Snap to grid
      </ContextMenu.CheckboxItem>
      <ContextMenu.Separator />
      <ContextMenu.Label id="cm-zoom">Zoom</ContextMenu.Label>
      <ContextMenu.RadioGroup aria-labelledby="cm-zoom" value={zoom} onValueChange={setZoom}>
        <ContextMenu.RadioItem value="fit">Fit to screen</ContextMenu.RadioItem>
        <ContextMenu.RadioItem value="100">100%</ContextMenu.RadioItem>
      </ContextMenu.RadioGroup>
      <ContextMenu.Separator />
      <ContextMenu.Item icon={<Trash2 />} variant="danger">
        Clear canvas
      </ContextMenu.Item>
    </ContextMenu.Content>
  );
}

const FILES = [
  { name: "q3-latency-report.pdf", icon: <FileText /> },
  { name: "checkout-flow-diagram.png", icon: <Image /> },
  { name: "a-file-with-an-unreasonably-long-name-that-has-to-truncate.txt", icon: <FileText /> },
];

/** One menu for the list: the row under the pointer (or focus) decides what it acts on. */
function FileList() {
  const [file, setFile] = useState<string | null>(null);
  return (
    <ContextMenu>
      <ContextMenu.Trigger
        asChild
        onBeforeOpen={(target) => {
          const row = target.closest<HTMLElement>("[data-file]");
          if (!row) return false;
          setFile(row.dataset.file ?? null);
        }}
      >
        <ul className="flex flex-col divide-y rounded-md border border-border" aria-label="Files">
          {FILES.map(({ name, icon }) => (
            <li key={name} data-file={name} className="flex min-h-row min-w-0 items-center gap-r4 px-r4">
              <span aria-hidden className="flex shrink-0 text-fg-secondary [&>svg]:size-icon">
                {icon}
              </span>
              <a href="#/overview/overlays-contextmenu" className="min-w-0 truncate text-body-1 text-fg-primary" title={name}>
                {name}
              </a>
            </li>
          ))}
        </ul>
      </ContextMenu.Trigger>
      <ContextMenu.Content aria-label={file ? `Actions for ${file}` : "File actions"}>
        <ContextMenu.Label className="max-w-[calc(var(--ROW-H)*7)] truncate">{file}</ContextMenu.Label>
        <ContextMenu.Item icon={<Pencil />}>Rename</ContextMenu.Item>
        <ContextMenu.Item icon={<Share2 />}>Share…</ContextMenu.Item>
        <ContextMenu.Item icon={<Trash2 />} variant="danger">
          Delete
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu>
  );
}

function Canvas({ label, testId }: { label: string; testId: string }) {
  return (
    <ContextMenu>
      <ContextMenu.Trigger
        tabIndex={0}
        aria-label={`${label}: right-click, Shift+F10 or long-press for actions`}
        data-testid={testId}
        className="grid min-h-[calc(var(--ROW-H)*3)] place-items-center rounded-lg border border-dashed border-border-strong bg-surface-1 p-r3 text-center text-body-2 text-fg-secondary"
      >
        {label}: right-click, Shift+F10 or long-press
      </ContextMenu.Trigger>
      <CanvasMenu />
    </ContextMenu>
  );
}

export default function ContextMenuSection() {
  return (
    <Stack>
      <Row label="A canvas (a tab stop, so the keyboard can reach it): icons, shortcuts, disabled, checkbox, radio, destructive">
        <Canvas label="Canvas" testId="cm-canvas" />
      </Row>
      <Row label="One menu for a list: it acts on the row under the pointer, or the focused link (Shift+F10)">
        <FileList />
      </Row>
      <Row label="Compact card, overflow: hidden">
        <Card data-density="compact" className="h-[calc(var(--ROW-H)*4)] overflow-hidden p-r3" data-testid="cm-compact-card">
          <Canvas label="Compact" testId="cm-compact-canvas" />
        </Card>
      </Row>
      <Row label="RTL: the menu opens towards the inline start of the point">
        <div dir="rtl">
          <ContextMenu>
            <ContextMenu.Trigger
              tabIndex={0}
              className="grid min-h-[calc(var(--ROW-H)*2)] place-items-center rounded-lg border border-dashed border-border-strong bg-surface-1 p-r3 text-body-2 text-fg-secondary"
            >
              انقر بزر الفأرة الأيمن هنا
            </ContextMenu.Trigger>
            <ContextMenu.Content aria-label="إجراءات">
              <ContextMenu.Item icon={<Pencil />} shortcut="R">
                إعادة تسمية
              </ContextMenu.Item>
              <ContextMenu.Item icon={<Copy />}>تكرار</ContextMenu.Item>
              <ContextMenu.Separator />
              <ContextMenu.Item icon={<Trash2 />} variant="danger">
                حذف
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu>
        </div>
      </Row>
    </Stack>
  );
}
