import { useState } from "react";

import { Button, Chip } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Chip",
  group: "primitives",
  order: 24,
  description:
    "A value as a token (a choice, a tag, an applied filter): one line, truncated with its title, an optional square remove button that Backspace and Delete also press. The selection inputs and FilterBar draw theirs with it.",
};

const START = ["api", "checkout", "search", "identity", "payments-reconciliation-worker-eu-west-1"];

export default function ChipSection() {
  const [tags, setTags] = useState(START);
  return (
    <Stack>
      <Row label="Plain, removable, disabled">
        <div className="flex flex-wrap items-center gap-r5">
          <Chip>Read only</Chip>
          <Chip onRemove={() => {}}>Removable</Chip>
          <Chip onRemove={() => {}} disabled>
            Disabled
          </Chip>
        </div>
      </Row>
      <Row label="A list: remove one, Restore puts them back; the long one truncates">
        <ul aria-label="Services" className="flex max-w-column-md flex-wrap items-center gap-r5" data-sc="chip-list">
          {tags.map((tag) => (
            <Chip key={tag} as="li" onRemove={() => setTags((all) => all.filter((t) => t !== tag))}>
              {tag}
            </Chip>
          ))}
          {tags.length === 0 && <li className="text-body-2 text-fg-muted">No services</li>}
        </ul>
        <Button variant="secondary" className="justify-self-start" onClick={() => setTags(START)}>
          Restore
        </Button>
      </Row>
      <Row label="Compact, and right to left">
        <div className="flex flex-wrap items-center gap-r3">
          <div data-density="compact" className="flex flex-wrap items-center gap-r5">
            <Chip onRemove={() => {}}>Compact</Chip>
            <Chip>Plain</Chip>
          </div>
          <div dir="rtl" className="flex flex-wrap items-center gap-r5">
            <Chip onRemove={() => {}}>منطقة: الخليج</Chip>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
