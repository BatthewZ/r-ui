import { Copy, Download, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { useState } from "react";

import { Card, IconButton } from "../../../src/components/primitives";
import { DropdownMenu } from "../../../src/components/overlays";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "DropdownMenu",
  group: "overlays",
  order: 30,
  description:
    "Arrows, Home/End and typeahead move; Enter/Space select; Escape returns focus. Items are --ROW-H tall. The compact card clips (overflow: hidden) and its menu is compact and unclipped.",
};

function ActionsMenu({ label = "Actions" }: { label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>{label}</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item icon={<Pencil />} shortcut="R">
          Rename
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={<Copy />} shortcut="⌘D">
          Duplicate
        </DropdownMenu.Item>
        <DropdownMenu.Item icon={<Share2 />}>Share…</DropdownMenu.Item>
        <DropdownMenu.Item icon={<Download />} disabled>
          Export (no data yet)
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item icon={<Trash2 />} variant="danger">
          Delete dashboard
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

function ViewMenu() {
  const [grid, setGrid] = useState(true);
  const [legend, setLegend] = useState(false);
  const [sort, setSort] = useState("severity");
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>View</DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Label>Show</DropdownMenu.Label>
        <DropdownMenu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
          Grid lines
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={legend} onCheckedChange={setLegend}>
          Legend
        </DropdownMenu.CheckboxItem>
        <DropdownMenu.Separator />
        <DropdownMenu.Label id="dm-sort">Sort by</DropdownMenu.Label>
        <DropdownMenu.RadioGroup aria-labelledby="dm-sort" value={sort} onValueChange={setSort}>
          <DropdownMenu.RadioItem value="severity">Severity</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="opened">Time opened</DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem value="owner">Owner</DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

export default function DropdownMenuSection() {
  return (
    <Stack>
      <Row label="Actions (icons, shortcuts, disabled, destructive) · checkbox and radio items">
        <div className="flex flex-wrap items-center gap-r4">
          <ActionsMenu />
          <ViewMenu />
          <DropdownMenu placement="bottom-end">
            <DropdownMenu.Trigger asChild>
              <IconButton label="More actions" icon={<MoreHorizontal />} variant="secondary" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>Pin to sidebar</DropdownMenu.Item>
              <DropdownMenu.Item>Copy link</DropdownMenu.Item>
              <DropdownMenu.Item>
                Move to another workspace with a deliberately long name that truncates
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </Row>

      <Row label="Comfortable card vs compact card, both overflow: hidden">
        <div className="grid gap-r3 @md:grid-cols-2">
          <Card className="h-[calc(var(--ROW-H)*3)] overflow-hidden px-r2" data-testid="dm-comfortable-card">
            <div className="flex items-center justify-between gap-r4">
              <span className="text-body-1 text-fg-primary">Comfortable</span>
              <ActionsMenu label="Open menu" />
            </div>
          </Card>
          <Card
            data-density="compact"
            className="h-[calc(var(--ROW-H)*3)] overflow-hidden px-r2"
            data-testid="dm-compact-card"
          >
            <div className="flex items-center justify-between gap-r4">
              <span className="text-body-1 text-fg-primary">Compact</span>
              <ActionsMenu label="Open menu" />
            </div>
          </Card>
        </div>
      </Row>

      <Row label="RTL">
        <div dir="rtl">
          <DropdownMenu>
            <DropdownMenu.Trigger>إجراءات</DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item icon={<Pencil />} shortcut="R">
                إعادة تسمية
              </DropdownMenu.Item>
              <DropdownMenu.Item icon={<Copy />}>تكرار</DropdownMenu.Item>
              <DropdownMenu.Separator />
              <DropdownMenu.Item icon={<Trash2 />} variant="danger">
                حذف
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        </div>
      </Row>
    </Stack>
  );
}
