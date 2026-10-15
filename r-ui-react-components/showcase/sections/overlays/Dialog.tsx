import { useState } from "react";

import { Button } from "../../../src/components/primitives";
import { Field, Input } from "../../../src/components/form";
import { Dialog, DropdownMenu, Tooltip } from "../../../src/components/overlays";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Dialog",
  group: "overlays",
  order: 40,
  description:
    "Native <dialog> with showModal: the browser traps focus, inerts the page and draws the scrim; the page behind stops scrolling. alertdialog drops the corner close and light dismiss.",
};

const LONG = Array.from({ length: 14 }, (_, i) => `Check ${i + 1}: latency probe from region ${["eu-west", "us-east", "ap-south"][i % 3]} returned within budget.`);

export default function DialogSection() {
  const [deleted, setDeleted] = useState(0);
  return (
    <Stack>
      <Row label="Form dialog · long scrolling body · menu and tooltip inside the modal">
        <div className="flex flex-wrap items-center gap-r4">
          <Dialog>
            <Dialog.Trigger>Rename dashboard</Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Rename dashboard</Dialog.Title>
                <Dialog.Description>Everyone with access sees the new name.</Dialog.Description>
              </Dialog.Header>
              <Dialog.Body>
                <Field>
                  <Field.Label>Name</Field.Label>
                  <Input defaultValue="Checkout latency" />
                </Field>
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.Close variant="ghost">Cancel</Dialog.Close>
                <Dialog.Close variant="primary">Save</Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>

          <Dialog>
            <Dialog.Trigger>Run report</Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Health checks for the last 24 hours across every region and probe</Dialog.Title>
                <Dialog.Description>The body scrolls; the header and the actions stay put.</Dialog.Description>
              </Dialog.Header>
              <Dialog.Body>
                <ul className="flex flex-col gap-r5 text-body-1">
                  {LONG.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Dialog.Body>
              <Dialog.Footer>
                <DropdownMenu placement="top-start">
                  <DropdownMenu.Trigger>Export as…</DropdownMenu.Trigger>
                  <DropdownMenu.Content>
                    <DropdownMenu.Item>CSV</DropdownMenu.Item>
                    <DropdownMenu.Item>JSON</DropdownMenu.Item>
                    <DropdownMenu.Item>PDF</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
                <Tooltip content="Closes without saving">
                  <Dialog.Close variant="primary">Done</Dialog.Close>
                </Tooltip>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </div>
      </Row>

      <Row label={`Confirmation (alertdialog) · deleted so far: ${deleted}`}>
        <div className="flex">
        <Dialog>
          <Dialog.Trigger variant="danger">Delete 3 dashboards</Dialog.Trigger>
          <Dialog.Content role="alertdialog">
            <Dialog.Header>
              <Dialog.Title>Delete 3 dashboards?</Dialog.Title>
              <Dialog.Description>Their panels and alerts go too. This cannot be undone.</Dialog.Description>
            </Dialog.Header>
            <Dialog.Footer>
              <Dialog.Close variant="ghost" autoFocus>
                Cancel
              </Dialog.Close>
              <Dialog.Close variant="danger" onClick={() => setDeleted((n) => n + 3)}>
                Delete
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog>
        </div>
      </Row>

      <Row label="Written inside a compact subtree: the dialog is compact">
        <div data-density="compact">
          <Dialog>
            <Dialog.Trigger>Compact dialog</Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Compact dialog</Dialog.Title>
                <Dialog.Description>Spacing, type and controls follow the subtree.</Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Dialog.Close variant="primary">OK</Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </div>
      </Row>

      <Row label="RTL">
        <div dir="rtl">
          <Dialog>
            <Dialog.Trigger>إعادة التسمية</Dialog.Trigger>
            <Dialog.Content closeLabel="إغلاق">
              <Dialog.Header>
                <Dialog.Title>إعادة تسمية لوحة المعلومات</Dialog.Title>
                <Dialog.Description>زر الإغلاق في الزاوية اليسرى.</Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Dialog.Close variant="ghost">إلغاء</Dialog.Close>
                <Dialog.Close variant="primary">حفظ</Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog>
        </div>
      </Row>
    </Stack>
  );
}
