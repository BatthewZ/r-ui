import { Button } from "../../../src/components/primitives";
import { Drawer, DropdownMenu } from "../../../src/components/overlays";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Drawer",
  group: "overlays",
  order: 50,
  description:
    "The Dialog's parts on an edge: the inline end (flips in RTL) or the bottom. Bottom is a prop the caller picks from its own space, never a viewport switch.",
};

const EVENTS = [
  "02:14 Alert fired: checkout p95 > 800 ms",
  "02:15 Paged on-call (Mira K.)",
  "02:19 Acknowledged",
  "02:31 Rolled back release 2026.10.14-3",
  "02:44 Latency back under budget",
];

function Details({ side }: { side: "end" | "bottom" }) {
  return (
    <Drawer>
      <Drawer.Trigger>{side === "end" ? "Incident details" : "Bottom sheet"}</Drawer.Trigger>
      <Drawer.Content side={side}>
        <Drawer.Header>
          <Drawer.Title>Incident 4821</Drawer.Title>
          <Drawer.Description>Checkout latency, resolved in 30 minutes.</Drawer.Description>
        </Drawer.Header>
        <Drawer.Body>
          <ol className="flex flex-col gap-r4 text-body-1">
            {EVENTS.map((e) => (
              <li key={e} className="border-b border-border pb-r4 last:border-b-0">
                {e}
              </li>
            ))}
          </ol>
        </Drawer.Body>
        <Drawer.Footer>
          <DropdownMenu placement="top-end">
            <DropdownMenu.Trigger>More</DropdownMenu.Trigger>
            <DropdownMenu.Content>
              <DropdownMenu.Item>Copy timeline</DropdownMenu.Item>
              <DropdownMenu.Item variant="danger">Reopen incident</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
          <Drawer.Close variant="primary">Close</Drawer.Close>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

export default function DrawerSection() {
  return (
    <Stack>
      <Row label="Inline end · bottom sheet (menu inside works: it is a descendant of the modal)">
        <div className="flex flex-wrap items-center gap-r4">
          <Details side="end" />
          <Details side="bottom" />
        </div>
      </Row>
      <Row label="RTL: the end edge is the left">
        <div dir="rtl">
          <Drawer>
            <Drawer.Trigger>التفاصيل</Drawer.Trigger>
            <Drawer.Content labels={{ close: "إغلاق" }}>
              <Drawer.Title>الحادث 4821</Drawer.Title>
              <Drawer.Body>
                <p className="text-body-1">ينزلق من الحافة اليسرى.</p>
              </Drawer.Body>
              <Drawer.Footer>
                <Button variant="secondary">موافق</Button>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer>
        </div>
      </Row>
    </Stack>
  );
}
