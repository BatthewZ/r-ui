import { FormActions } from "../../../src/components/form";
import { ScrollPanel } from "../../../src/components/layout";
import { Button } from "../../../src/components/primitives";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "FormActions",
  group: "form",
  order: 160,
  components: ["ScrollPanel"],
  description:
    "The submit / cancel row. Actions sit at the end with the primary last; in a narrow CONTAINER they stack full-width with the primary on top. Submit is busy while its Form submits. In a bounded box the row goes in a ScrollPanel's footer, below the scroller; sticky is for a long form in the page's own scroll.",
};

function Actions({ loading }: { loading?: boolean }) {
  return (
    <FormActions>
      <Button variant="secondary">Cancel</Button>
      <FormActions.Submit loading={loading}>Save changes</FormActions.Submit>
    </FormActions>
  );
}

export default function FormActionsSection() {
  return (
    <Stack>
      <Row label="Wide container · narrow container (stacks, primary on top) · submitting">
        <Grid>
          <div className="rounded-md border border-dashed p-r3">
            <Actions />
          </div>
          <div className="w-column-sm max-w-full rounded-md border border-dashed p-r3" data-sc="form-actions-narrow">
            <Actions />
          </div>
          <div className="rounded-md border border-dashed p-r3">
            <Actions loading />
          </div>
        </Grid>
      </Row>
      <Row label="In a bounded panel (ScrollPanel): only the body scrolls; the actions sit below the scroller, so its scrollbar stops at their edge">
        <ScrollPanel className="max-h-[calc(var(--CONTROL-H)*6)] rounded-md border bg-surface-0" data-sc="form-actions-panel">
          <ScrollPanel.Body
            tabIndex={0}
            role="region"
            aria-label="Long settings form"
            className="grid gap-r3 text-body-1 text-fg-secondary"
          >
            {["Notification channels", "Escalation policy", "Quiet hours", "Retention", "Audit log", "Integrations"].map(
              (title) => (
                <section key={title} className="grid gap-r5">
                  <h4 className="text-h6 text-fg-primary">{title}</h4>
                  <p>Settings for {title.toLowerCase()} would sit here, long enough to scroll above the actions.</p>
                </section>
              ),
            )}
          </ScrollPanel.Body>
          <ScrollPanel.Footer>
            <FormActions>
              <Button variant="secondary">Discard</Button>
              <FormActions.Submit>Save settings</FormActions.Submit>
            </FormActions>
          </ScrollPanel.Footer>
        </ScrollPanel>
      </Row>
    </Stack>
  );
}
