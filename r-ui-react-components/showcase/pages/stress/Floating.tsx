import { Archive, Copy, Download, Pencil, Pin, Share2, Trash2, UserPlus } from "lucide-react";

import { Field, Input, Select } from "../../../src/components/form";
import { DropdownMenu, Popover, Tooltip } from "../../../src/components/overlays";
import { Button, Card } from "../../../src/components/primitives";
import { TokenReadout } from "./parts";

/**
 * A compact card that clips (`overflow: hidden`) and is barely taller than its
 * controls. Every panel opened from it is longer than the card, so a panel that
 * stayed in the card's box would be visibly cut off.
 */
export function FloatingPanel() {
  return (
    <Card data-density="compact" data-testid="stress-clip-card" className="overflow-hidden p-r3">
      <div className="flex flex-col gap-r4">
        <div className="flex flex-wrap items-baseline justify-between gap-r4">
          <span className="text-body-1 font-medium text-fg-primary">Compact card, overflow: hidden</span>
          <TokenReadout />
        </div>
        <div className="flex flex-wrap items-center gap-r4">
          <DropdownMenu>
            <DropdownMenu.Trigger>Row actions</DropdownMenu.Trigger>
            <DropdownMenu.Content aria-label="Row actions">
              <DropdownMenu.Item icon={<Pencil />} shortcut="R">
                Rename
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<Copy />} shortcut="⌘D">
                Duplicate
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<Share2 />}>Share…</DropdownMenu.Item>
              <DropdownMenu.Item icon={<UserPlus />}>Assign owner</DropdownMenu.Item>
              <DropdownMenu.Item icon={<Pin />}>Pin to sidebar</DropdownMenu.Item>
              <DropdownMenu.Item icon={<Download />}>Export CSV</DropdownMenu.Item>
              <DropdownMenu.Item icon={<Archive />}>Archive</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item icon={<Trash2 />} variant="danger">
                Delete row
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>

          <Popover>
            <Popover.Trigger>Filters</Popover.Trigger>
            <Popover.Content aria-label="Compact filters" className="w-column-md">
              <div className="flex flex-col gap-r3">
                <h3 className="text-h5 text-fg-primary">Filter rows</h3>
                <Field>
                  <Field.Label>Owner</Field.Label>
                  <Input placeholder="Anyone" />
                </Field>
                <Field>
                  <Field.Label>Region</Field.Label>
                  <Select defaultValue="eu">
                    <option value="eu">Europe</option>
                    <option value="us">US East</option>
                  </Select>
                </Field>
                <div className="flex justify-end gap-r4">
                  <Popover.Close variant="ghost">Reset</Popover.Close>
                  <Popover.Close variant="primary">Apply</Popover.Close>
                </div>
              </div>
            </Popover.Content>
          </Popover>

          <Tooltip content="This tip escapes the card through the top layer, and its text is compact" placement="bottom">
            <Button variant="ghost">Hover or focus me</Button>
          </Tooltip>

          <Select aria-label="Time range" defaultValue="24h" className="w-auto">
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </Select>
        </div>
      </div>
    </Card>
  );
}
