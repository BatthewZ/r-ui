import { SlidersHorizontal } from "lucide-react";

import { IconButton } from "../../../src/components/primitives";
import { Field, Input } from "../../../src/components/form";
import { Popover } from "../../../src/components/overlays";
import { ClipFrame, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Popover",
  group: "overlays",
  order: 20,
  description:
    "A non-modal dialog anchored to its trigger. Focus moves in and returns; a press outside, Tab out or Escape closes it. Rendered in place, promoted to the top layer.",
};

function FilterForm() {
  return (
    <div className="flex flex-col gap-r3">
      <div className="flex flex-col gap-r6">
        <h3 className="text-h5 text-fg-primary">Filter incidents</h3>
        <p className="text-body-2 text-fg-secondary">Applies to every panel on this dashboard.</p>
      </div>
      <Field>
        <Field.Label>Owner</Field.Label>
        <Input placeholder="Anyone" />
      </Field>
      <div className="flex justify-end gap-r4">
        <Popover.Close variant="ghost">Reset</Popover.Close>
        <Popover.Close variant="primary">Apply</Popover.Close>
      </div>
    </div>
  );
}

export default function PopoverSection() {
  return (
    <Stack>
      <Row label="With a form, and with an arrow">
        <div className="flex flex-wrap items-center gap-r4">
          <Popover>
            <Popover.Trigger iconStart={<SlidersHorizontal />}>Filters</Popover.Trigger>
            <Popover.Content aria-label="Filters" className="w-column-md">
              <FilterForm />
            </Popover.Content>
          </Popover>
          <Popover placement="top">
            <Popover.Trigger>With arrow</Popover.Trigger>
            <Popover.Content aria-label="About" arrow className="w-column-md">
              <p className="text-body-1">Arrows are optional; the panel's hairline continues around the pointer.</p>
            </Popover.Content>
          </Popover>
        </div>
      </Row>

      <Row label="asChild on an icon button">
        <Popover placement="bottom-start">
          <Popover.Trigger asChild>
            <IconButton label="Display options" icon={<SlidersHorizontal />} variant="secondary" />
          </Popover.Trigger>
          <Popover.Content aria-label="Display options">
            <p className="text-body-1">Anything focusable inside receives focus first.</p>
            <div className="mt-r3 flex justify-end">
              <Popover.Close>Done</Popover.Close>
            </div>
          </Popover.Content>
        </Popover>
      </Row>

      <Row label="Opened inside a compact, clipping frame">
        <ClipFrame label="overflow: hidden · compact" data-density="compact">
          <Popover>
            <Popover.Trigger>Open here</Popover.Trigger>
            <Popover.Content aria-label="Compact filters" className="w-column-md">
              <FilterForm />
            </Popover.Content>
          </Popover>
        </ClipFrame>
      </Row>

      <Row label="RTL">
        <div dir="rtl">
          <Popover placement="bottom-start">
            <Popover.Trigger>عوامل التصفية</Popover.Trigger>
            <Popover.Content aria-label="عوامل التصفية" arrow>
              <p className="text-body-1">يبدأ من الحافة اليمنى.</p>
              <div className="mt-r3 flex justify-end">
                <Popover.Close>تم</Popover.Close>
              </div>
            </Popover.Content>
          </Popover>
        </div>
      </Row>
    </Stack>
  );
}
