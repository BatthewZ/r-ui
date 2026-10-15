import { Field, Input } from "../../../src/components/form";
import { Dialog, Drawer, DropdownMenu, type ToastOptions, useToast } from "../../../src/components/overlays";
import { Button } from "../../../src/components/primitives";
import { Case } from "./parts";

const BURST: ToastOptions[] = [
  { title: "Dashboard saved" },
  { title: "Report exported", description: "checkout-latency.csv · 1.2 MB", tone: "success" },
  { title: "Ingestion is 4 minutes behind", description: "Charts may lag until it catches up.", tone: "warning" },
  { title: "Maintenance window at 02:00 UTC", tone: "info" },
  { title: "Export failed", description: "The warehouse rejected the query after 30 s. Nothing was charged.", tone: "error" },
  { title: "3 dashboards archived", action: { label: "Undo", onClick: () => undefined } },
  { title: "Alert rule “p95 > 800 ms” muted for 1 hour", tone: "info" },
  { title: "Deploy 2026.10.14-3 rolled back", tone: "success" },
  { title: "Quota at 92%", description: "Raise it before the nightly batch.", tone: "warning" },
  { title: "Webhook delivery failed 12 times in a row", tone: "error" },
  { title: "Copied link" },
  { title: "Invite sent to ada@example.com", tone: "success" },
];

function ToastBurst() {
  const { toast, dismissAll } = useToast();
  return (
    <div className="flex flex-wrap items-center gap-r4">
      <Button variant="secondary" onClick={() => BURST.forEach((t) => toast(t))}>
        Raise {BURST.length} toasts at once
      </Button>
      <Button variant="ghost" onClick={dismissAll}>
        Dismiss all
      </Button>
    </div>
  );
}

function ExportMenu({ label }: { label: string }) {
  return (
    <DropdownMenu placement="top-start">
      <DropdownMenu.Trigger>{label}</DropdownMenu.Trigger>
      <DropdownMenu.Content aria-label={label}>
        <DropdownMenu.Item>CSV</DropdownMenu.Item>
        <DropdownMenu.Item>JSON</DropdownMenu.Item>
        <DropdownMenu.Item>Parquet</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

/** A dialog whose footer opens a menu: the menu is a descendant of the modal, so it is not inert. */
function RenameDialog({ trigger }: { trigger: string }) {
  return (
    <Dialog>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content data-testid="stress-dialog">
        <Dialog.Header>
          <Dialog.Title>Rename incident 4821</Dialog.Title>
          <Dialog.Description>Opened over whatever was on top. Escape closes only the topmost layer.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body>
          <Field>
            <Field.Label>Name</Field.Label>
            <Input defaultValue="Checkout latency" />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <ExportMenu label="Export as…" />
          <Dialog.Close variant="primary">Done</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}

export function LayersPanel() {
  return (
    <div className="flex flex-col gap-r2">
      <Case label="Many toasts at once (the stack caps itself; errors stay)">
        <ToastBurst />
      </Case>
      <Case label="A dialog over a drawer, a menu inside the dialog">
        <div className="flex flex-wrap items-center gap-r4">
          <Drawer>
            <Drawer.Trigger>Open the incident drawer</Drawer.Trigger>
            <Drawer.Content data-testid="stress-drawer">
              <Drawer.Header>
                <Drawer.Title>Incident 4821</Drawer.Title>
                <Drawer.Description>Checkout latency, resolved in 30 minutes.</Drawer.Description>
              </Drawer.Header>
              <Drawer.Body>
                <p className="text-body-1 text-fg-secondary">
                  The dialog below opens on top of this drawer, and its menu on top of the dialog.
                </p>
              </Drawer.Body>
              <Drawer.Footer>
                <RenameDialog trigger="Rename…" />
                <Drawer.Close variant="primary">Close</Drawer.Close>
              </Drawer.Footer>
            </Drawer.Content>
          </Drawer>
          <RenameDialog trigger="Dialog with a menu" />
        </div>
      </Case>
    </div>
  );
}
