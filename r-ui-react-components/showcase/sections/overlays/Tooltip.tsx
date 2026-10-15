import { Copy, Info, Pencil, Trash2 } from "lucide-react";

import { Button, IconButton } from "../../../src/components/primitives";
import { Tooltip } from "../../../src/components/overlays";
import { ClipFrame, Row, Stack } from "./parts/demo";

export const meta = {
  title: "Tooltip",
  group: "overlays",
  order: 10,
  description:
    "Hover (after a delay) or keyboard focus opens it; Escape closes it; a tap never does. It describes, it never names: icon buttons keep their own labels.",
};

export default function TooltipSection() {
  return (
    <Stack>
      <Row label="On icon buttons (Tab through them: focus opens the tip)">
        <div className="flex flex-wrap items-center gap-r5">
          <Tooltip content="Copy the share link">
            <IconButton label="Copy link" icon={<Copy />} />
          </Tooltip>
          <Tooltip content="Rename this dashboard">
            <IconButton label="Rename" icon={<Pencil />} />
          </Tooltip>
          <Tooltip content="Moves it to the bin for 30 days" placement="bottom" arrow>
            <IconButton label="Delete" icon={<Trash2 />} />
          </Tooltip>
        </div>
      </Row>

      <Row label="Placements, with arrow">
        <div className="flex flex-wrap items-center gap-r4">
          {(["top", "right", "bottom", "left"] as const).map((placement) => (
            <Tooltip key={placement} content={`Placed ${placement}`} placement={placement} arrow>
              <Button variant="secondary">{placement}</Button>
            </Tooltip>
          ))}
        </div>
      </Row>

      <Row label="Long content wraps at half a measure">
        <Tooltip
          content="p95 latency is the time within which 95% of requests completed over the selected window, measured at the load balancer."
          placement="right"
        >
          <span tabIndex={0} className="inline-flex w-fit items-center gap-r6 text-body-1 text-fg-secondary">
            p95 latency <Info className="size-icon" aria-hidden />
          </span>
        </Tooltip>
      </Row>

      <Row label="Inside a clipping, compact frame: the tip is compact and not clipped">
        <ClipFrame label="overflow: hidden · compact" data-density="compact">
          <Tooltip content="Escapes the frame through the top layer" placement="top">
            <Button variant="secondary">Compact trigger</Button>
          </Tooltip>
        </ClipFrame>
      </Row>

      <Row label="RTL">
        <div dir="rtl" className="flex items-center gap-r4">
          <Tooltip content="نسخ الرابط" placement="right" arrow>
            <Button variant="secondary">نسخ</Button>
          </Tooltip>
        </div>
      </Row>

      <Row label="Disabled tooltip (the trigger stays)">
        <Tooltip content="Never shown" disabled>
          <Button variant="secondary">No tip</Button>
        </Tooltip>
      </Row>
    </Stack>
  );
}
