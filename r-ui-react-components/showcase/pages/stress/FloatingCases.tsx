import { Archive, BookOpen, Copy, Download, LifeBuoy, Newspaper, Pin, Scissors, Settings, Share2, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { CommandPalette, type CommandPaletteCommand } from "../../../src/components/commands";
import { DatePicker, DateRangePicker, TimePicker } from "../../../src/components/dates";
import { ColorPicker, Combobox, Field, MultiSelect, TagInput } from "../../../src/components/form";
import { NavigationMenu } from "../../../src/components/marketing";
import { ContextMenu, HoverCard } from "../../../src/components/overlays";
import { Button, Card, Link } from "../../../src/components/primitives";
import { BRAND_PALETTE, START } from "../../sections/form/parts/brand-palette.examples";
import { LABEL_SUGGESTIONS, REGIONS } from "../../sections/form/parts/selection-data";

/**
 * One more floating component in a compact card that clips and is barely taller than
 * its trigger, so a panel kept in the card's box would be cut off. `sweep-floating.js`
 * opens each (`data-floating-case`) and measures the panel against its card.
 */
function ClipCase({ name, children }: { name: string; children: ReactNode }) {
  return (
    <Card data-density="compact" data-floating-case={name} className="min-w-0 overflow-hidden p-r3">
      <div className="flex min-w-0 flex-wrap items-center gap-r4">{children}</div>
    </Card>
  );
}

const PALETTE_COMMANDS: CommandPaletteCommand[] = [
  { id: "stress-duplicate", label: "Duplicate dashboard", group: "Dashboard", icon: <Copy />, onSelect: () => undefined },
  { id: "stress-share", label: "Share…", group: "Dashboard", icon: <Share2 />, onSelect: () => undefined },
  { id: "stress-export", label: "Export CSV", group: "Dashboard", icon: <Download />, onSelect: () => undefined },
  { id: "stress-pin", label: "Pin to sidebar", group: "Dashboard", icon: <Pin />, onSelect: () => undefined },
  { id: "stress-archive", label: "Archive", group: "Dashboard", icon: <Archive />, onSelect: () => undefined },
  { id: "stress-settings", label: "Open settings", group: "Navigate", icon: <Settings />, onSelect: () => undefined },
];

function PaletteCase() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open the palette
      </Button>
      <CommandPalette open={open} onOpenChange={setOpen} commands={PALETTE_COMMANDS} />
    </>
  );
}

export function FloatingCases() {
  return (
    <div className="grid grid-cols-1 gap-r3 @3xl:grid-cols-3">
      <ClipCase name="contextmenu">
        <ContextMenu>
          <ContextMenu.Trigger tabIndex={0} aria-label="Canvas: Shift+F10 for its actions" className="rounded-md border border-dashed border-border-strong px-r4 text-body-2 text-fg-secondary">
            Canvas
          </ContextMenu.Trigger>
          <ContextMenu.Content aria-label="Canvas actions">
            <ContextMenu.Item icon={<Scissors />}>Cut</ContextMenu.Item>
            <ContextMenu.Item icon={<Copy />}>Copy</ContextMenu.Item>
            <ContextMenu.Item icon={<Download />}>Export</ContextMenu.Item>
            <ContextMenu.Item icon={<Pin />}>Pin</ContextMenu.Item>
            <ContextMenu.Separator />
            <ContextMenu.Item icon={<Trash2 />} variant="danger">
              Clear
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu>
      </ClipCase>
      <ClipCase name="hovercard">
        <HoverCard openDelay={0}>
          <HoverCard.Trigger>
            <Link href="#/stress/stress-floating">@grace</Link>
          </HoverCard.Trigger>
          <HoverCard.Content>
            <div className="grid gap-r4">
              <span className="font-semibold text-fg-primary">Grace Hopper</span>
              <p className="text-body-2 text-fg-secondary">Compilers, nanoseconds and a moth.</p>
            </div>
          </HoverCard.Content>
        </HoverCard>
      </ClipCase>
      <ClipCase name="navigationmenu">
        <NavigationMenu
          labels={{ navigation: "Card navigation" }}
          items={[
            {
              id: "resources",
              label: "Resources",
              links: [
                { id: "docs", label: "Documentation", href: "#/stress/stress-floating", icon: <BookOpen /> },
                { id: "journal", label: "Journal", href: "#/stress/stress-floating", icon: <Newspaper /> },
                { id: "support", label: "Support", href: "#/stress/stress-floating", icon: <LifeBuoy /> },
              ],
            },
          ]}
        />
      </ClipCase>
      <ClipCase name="combobox">
        <Field className="w-full max-w-column-sm">
          <Field.Label>Region</Field.Label>
          <Combobox options={REGIONS} placeholder="Any region" />
        </Field>
      </ClipCase>
      <ClipCase name="multiselect">
        <Field className="w-full max-w-column-sm">
          <Field.Label>Regions</Field.Label>
          <MultiSelect options={REGIONS} placeholder="Any region" />
        </Field>
      </ClipCase>
      <ClipCase name="taginput">
        <Field className="w-full max-w-column-sm">
          <Field.Label>Labels</Field.Label>
          <TagInput suggestions={LABEL_SUGGESTIONS} />
        </Field>
      </ClipCase>
      <ClipCase name="colorpicker">
        <Field className="w-full max-w-column-sm">
          <Field.Label>Label colour</Field.Label>
          <ColorPicker swatches={BRAND_PALETTE} defaultValue={START.brand} />
        </Field>
      </ClipCase>
      <ClipCase name="datepicker">
        <Field className="w-full max-w-column-sm">
          <Field.Label>Snooze until</Field.Label>
          <DatePicker locale="en-US" defaultValue={new Date(2026, 9, 22)} />
        </Field>
      </ClipCase>
      <ClipCase name="daterangepicker">
        <DateRangePicker aria-label="Time range" locale="en-US" className="max-w-full" defaultValue={{ start: new Date(2026, 9, 9), end: new Date(2026, 9, 15) }} />
      </ClipCase>
      <ClipCase name="timepicker">
        <Field className="w-full max-w-column-sm">
          <Field.Label>Active from</Field.Label>
          <TimePicker locale="en-GB" step={15} defaultValue="09:00" />
        </Field>
      </ClipCase>
      <ClipCase name="commandpalette">
        <PaletteCase />
      </ClipCase>
    </div>
  );
}
