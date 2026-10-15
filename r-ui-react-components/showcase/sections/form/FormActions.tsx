import { FormActions } from "../../../src/components/form";
import { Button } from "../../../src/components/primitives";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "FormActions",
  group: "form",
  order: 160,
  description:
    "The submit / cancel row. Actions sit at the end with the primary last; in a narrow CONTAINER they stack full-width with the primary on top. Submit is busy while its Form submits. Sticky keeps the row at the bottom of its scroller over a long form.",
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
      <Row label="Sticky: scroll the box; the row stays on its bottom edge">
        <div
          className="max-h-[calc(var(--CONTROL-H)*6)] overflow-y-auto rounded-md border bg-surface-0 px-r3 pt-r3"
          data-sc="form-actions-sticky"
          data-print="flow"
          tabIndex={0}
          aria-label="Long settings form"
        >
          <div className="grid gap-r3 pb-r3 text-body-1 text-fg-secondary">
            {["Notification channels", "Escalation policy", "Quiet hours", "Retention", "Audit log", "Integrations"].map(
              (title) => (
                <section key={title} className="grid gap-r5">
                  <h4 className="text-h6 text-fg-primary">{title}</h4>
                  <p>Settings for {title.toLowerCase()} would sit here, long enough to scroll under the actions.</p>
                </section>
              ),
            )}
          </div>
          <FormActions sticky className="-mx-r3 px-r3">
            <Button variant="secondary">Discard</Button>
            <FormActions.Submit>Save settings</FormActions.Submit>
          </FormActions>
        </div>
      </Row>
    </Stack>
  );
}
