import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Download,
  Eraser,
  MousePointer2,
  Pen,
  Redo2,
  Save,
  Square,
  Trash2,
  Undo2,
  WholeWord,
} from "lucide-react";
import { useState } from "react";

import { Input } from "../../../src/components/form";
import { DropdownMenu } from "../../../src/components/overlays";
import { Button, IconButton } from "../../../src/components/primitives";
import { ToggleGroup, Toolbar } from "../../../src/components/toolbar";
import { cn } from "../../../src/util/style";
import { BAR_FRAME_CLASSES, EditorToolbar, type EditorWords, Row, SHOW_HIT_CLASSES, Stack } from "./parts/demo";

export const meta = {
  title: "Toolbar",
  group: "toolbar",
  order: 10,
  description:
    "One tab stop for a row of controls: arrows, Home and End move between them (mirrored right to left), a text input keeps its caret, a select its Up/Down. When the toolbar's own width runs out, trailing items move into More, in order. On coarse input the gap grows so no two hit areas overlap (show them, then switch Input to coarse).",
};

const GERMAN: EditorWords = {
  name: "Formatierung",
  history: "Verlauf",
  undo: "Rückgängig machen",
  redo: "Wiederherstellen",
  font: "Schriftart",
  style: "Textauszeichnung",
  bold: "Fett",
  italic: "Kursiv",
  underline: "Unterstrichen",
  strike: "Durchgestrichen",
  align: "Ausrichtung",
  start: "Am Anfang ausrichten",
  center: "Zentrieren",
  end: "Am Ende ausrichten",
  justify: "Blocksatz",
  link: "Link einfügen",
  image: "Bild einfügen",
  fonts: [
    ["ui", "Benutzeroberfläche"],
    ["serif", "Serifenschrift"],
    ["mono", "Festbreitenschrift"],
  ],
};

const ARABIC: EditorWords = {
  name: "التنسيق",
  history: "السجل",
  undo: "تراجع",
  redo: "إعادة",
  font: "الخط",
  style: "نمط النص",
  bold: "عريض",
  italic: "مائل",
  underline: "تسطير",
  strike: "يتوسطه خط",
  align: "المحاذاة",
  start: "محاذاة إلى البداية",
  center: "توسيط",
  end: "محاذاة إلى النهاية",
  justify: "ضبط",
  link: "إدراج رابط",
  image: "إدراج صورة",
  fonts: [
    ["ui", "الواجهة"],
    ["serif", "مذيل"],
    ["mono", "ثابت العرض"],
  ],
};

export default function ToolbarSection() {
  const [showHit, setShowHit] = useState(false);
  const [last, setLast] = useState("—");
  const hit = showHit ? SHOW_HIT_CLASSES : undefined;

  return (
    <Stack>
      <Row label="A text editor: history, a font Select (stays in the bar), style toggles (multiple), alignment (single), insert actions">
        <div className="grid min-w-0 gap-r5">
          <EditorToolbar data-sc="toolbar-editor" className={cn(BAR_FRAME_CLASSES, hit)} onAction={setLast} />
          <div className="flex flex-wrap items-center gap-r4">
            <output className="text-body-2 text-fg-secondary" data-sc="toolbar-last">
              Last action: {last}
            </output>
            <Button variant="secondary" aria-pressed={showHit} onClick={() => setShowHit((v) => !v)}>
              {showHit ? "Hide hit areas" : "Show hit areas"}
            </Button>
          </div>
        </div>
      </Row>

      <Row label="Narrow container: the trailing items move into More, in their order (insert actions, then alignment, style, history); the Select has no menu form and stays">
        <div className="grid min-w-0 gap-r4">
          <div className="max-w-column-md min-w-0">
            <EditorToolbar data-sc="toolbar-narrow" className={cn(BAR_FRAME_CLASSES, hit)} onAction={setLast} />
          </div>
          {/* The narrowest a pinned Select, the coarse gap and "More" still fit. */}
          <div className="min-w-0 max-w-[calc(var(--COLUMN-SM)+var(--R-SIZE-1))]">
            <EditorToolbar data-sc="toolbar-narrowest" className={cn(BAR_FRAME_CLASSES, hit)} onAction={setLast} />
          </div>
        </div>
      </Row>

      <Row label="Find bar: a text input keeps its arrows (they leave it only from the caret's edge), Home and End">
        <FindBar className={hit} />
      </Row>

      <Row label="A chart's toolbar: series toggles (uncontrolled, shared with More), range (single), export">
        <ChartToolbar className={hit} />
      </Row>

      <Row label="Vertical: Up and Down move; the separator lies across; no overflow">
        <Toolbar
          aria-label="Drawing tools"
          orientation="vertical"
          data-sc="toolbar-vertical"
          className={cn(BAR_FRAME_CLASSES, "self-start", hit)}
        >
          <ToggleGroup type="single" aria-label="Tool" defaultValue="select">
            <ToggleGroup.Item value="select" icon={<MousePointer2 />} label="Select" />
            <ToggleGroup.Item value="pen" icon={<Pen />} label="Pen" />
            <ToggleGroup.Item value="eraser" icon={<Eraser />} label="Eraser" />
            <ToggleGroup.Item value="shape" icon={<Square />} label="Shape" />
          </ToggleGroup>
          <Toolbar.Separator />
          <IconButton label="Undo" icon={<Undo2 />} />
          <IconButton label="Redo" icon={<Redo2 />} />
        </Toolbar>
      </Row>

      <Row label="States: a disabled control (passed over) · an aria-disabled one (focusable) · a busy save · a disabled toggle">
        <Toolbar aria-label="Document" data-sc="toolbar-states" className={cn(BAR_FRAME_CLASSES, hit)}>
          <IconButton label="Undo" icon={<Undo2 />} disabled />
          <IconButton label="Redo" icon={<Redo2 />} aria-disabled />
          <Toolbar.Separator />
          <ToggleGroup type="multiple" aria-label="View" defaultValue={["ruler"]}>
            <ToggleGroup.Item value="ruler">Ruler</ToggleGroup.Item>
            <ToggleGroup.Item value="grid" disabled>
              Grid
            </ToggleGroup.Item>
          </ToggleGroup>
          <Toolbar.Separator />
          <Button variant="secondary" iconStart={<Save />} loading>
            Save
          </Button>
          <IconButton label="Delete document" icon={<Trash2 />} variant="danger" />
        </Toolbar>
      </Row>

      <Row label="Compact density · long translated labels (German), More renamed">
        <div className="grid min-w-0 gap-r4">
          <div data-density="compact" className="min-w-0">
            <EditorToolbar data-sc="toolbar-compact" className={cn(BAR_FRAME_CLASSES, hit)} onAction={setLast} />
          </div>
          <EditorToolbar
            data-sc="toolbar-german"
            words={GERMAN}
            labels={{ more: "Weitere" }}
            className={cn(BAR_FRAME_CLASSES, hit)}
            onAction={setLast}
          />
        </div>
      </Row>

      <Row label="Right to left: arrows mirror, More sits at the inline end">
        <div dir="rtl" className="min-w-0">
          <EditorToolbar
            data-sc="toolbar-rtl"
            words={ARABIC}
            labels={{ more: "المزيد" }}
            className={cn(BAR_FRAME_CLASSES, hit)}
            onAction={setLast}
          />
        </div>
      </Row>
    </Stack>
  );
}

function FindBar({ className }: { className?: string }) {
  const [query, setQuery] = useState("toolbar");
  return (
    <Toolbar aria-label="Find in document" data-sc="toolbar-find" className={cn(BAR_FRAME_CLASSES, className)}>
      <IconButton label="Previous match" icon={<ChevronUp />} />
      <Input
        aria-label="Find"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        // Pinned units never shrink: sized so the bar and "More" fit a phone at coarse input.
        className="w-[calc(var(--COLUMN-SM)*0.75)]"
      />
      <IconButton label="Next match" icon={<ChevronDown />} />
      <Toolbar.Separator />
      <ToggleGroup type="multiple" aria-label="Match options">
        <ToggleGroup.Item value="case" icon={<CaseSensitive />} label="Match case" />
        <ToggleGroup.Item value="word" icon={<WholeWord />} label="Whole word" />
      </ToggleGroup>
    </Toolbar>
  );
}

const SERIES = [
  { value: "checkout", label: "Checkout", swatch: "bg-series-1" },
  { value: "search", label: "Search", swatch: "bg-series-2" },
  { value: "payments", label: "Payments", swatch: "bg-series-3" },
];

function ChartToolbar({ className }: { className?: string }) {
  const [exported, setExported] = useState(0);
  return (
    <div className="grid min-w-0 gap-r5">
      <Toolbar aria-label="Latency chart" data-sc="toolbar-chart" className={cn(BAR_FRAME_CLASSES, className)}>
        <ToggleGroup type="multiple" aria-label="Series" defaultValue={["checkout", "search"]}>
          {SERIES.map((s) => (
            <ToggleGroup.Item
              key={s.value}
              value={s.value}
              icon={<span aria-hidden className={cn("block size-r4 rounded-full", s.swatch)} data-print="exact" />}
            >
              {s.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
        <Toolbar.Separator />
        <ToggleGroup type="single" aria-label="Range" defaultValue="7d">
          <ToggleGroup.Item value="1d">1D</ToggleGroup.Item>
          <ToggleGroup.Item value="7d">7D</ToggleGroup.Item>
          <ToggleGroup.Item value="30d">30D</ToggleGroup.Item>
        </ToggleGroup>
        <Toolbar.Separator />
        <Toolbar.Item
          menu={
            <DropdownMenu.Item icon={<Download />} onSelect={() => setExported((n) => n + 1)}>
              Export CSV
            </DropdownMenu.Item>
          }
        >
          <IconButton label="Export CSV" icon={<Download />} onClick={() => setExported((n) => n + 1)} />
        </Toolbar.Item>
      </Toolbar>
      <output className="text-body-2 text-fg-secondary">Exports: {exported}</output>
    </div>
  );
}

