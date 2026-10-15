import { Prose, Stack } from "../../../src/components/layout";
import { Button } from "../../../src/components/primitives";
import { Row } from "./parts/demo";

export const meta = {
  title: "Prose",
  group: "layout",
  order: 40,
  description:
    "A long-form region: its text takes the fluid prose scale and reading leading. UI inside it stays UI: the button below is --CONTROL-H tall with UI text (measured in the browser check), and data-not-prose opts a subtree out.",
};

export default function ProseSection() {
  return (
    <Stack gap="r1">
      <Row label="Article">
        <Prose data-testid="prose">
          <h2>Rolling back without fear</h2>
          <p>
            A rollback is a deploy like any other: it gets a change record, a canary and an owner. What makes it
            safe is not speed but the fact that the previous build is still warm and still verified.
          </p>
          <ul>
            <li>Keep the last two builds warm.</li>
            <li>Gate on error rate, not on a timer.</li>
          </ul>
          <p>
            <Button variant="secondary" data-testid="prose-button">
              Roll back payments-api
            </Button>
          </p>
          <blockquote>Nothing is more permanent than a temporary fix.</blockquote>
          <h3>What to measure</h3>
          <p>
            Time to detect, time to decide and time to recover. The middle one is the one people forget, and it is
            usually the longest. Read <a href="#prose">the runbook</a> before you need it.
          </p>
          <div data-not-prose className="rounded-md border p-r3 text-body-2 text-fg-secondary">
            data-not-prose: this note keeps the UI scale.
          </div>
        </Prose>
      </Row>
      <Row label="Uncapped (measure off)">
        <Prose measure={false}>
          <p>
            Without the measure cap the region runs the full width of its container, which is only right for
            short text or a layout that sets its own column.
          </p>
        </Prose>
      </Row>
    </Stack>
  );
}
