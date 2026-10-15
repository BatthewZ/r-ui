import { Card } from "../../../src/components/primitives";
import { Combobox, Field, MultiSelect, TagInput } from "../../../src/components/form";
import { Row, Stack } from "./parts/demo";
import { LABEL_SUGGESTIONS, REGIONS, SERVICES, validateLabel } from "./parts/selection-data";

export const meta = {
  title: "Selection filter bar",
  group: "form",
  order: 140,
  description:
    "The three selection inputs as a dashboard filter bar in a compact card that clips its overflow: the lists are compact (they inherit the card's density) and escape the clip in the top layer.",
};

export default function SelectionFilterBarSection() {
  return (
    <Stack>
      <Row label="Compact card, overflow hidden">
        <Card data-density="compact" data-testid="selection-filter-card" className="overflow-hidden">
          <Card.Header>
            <Card.Title>Incidents</Card.Title>
            <Card.Description>Filter by service, region and label.</Card.Description>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--COLUMN-SM)),1fr))] gap-r3">
              <Field>
                <Field.Label>Service</Field.Label>
                <Combobox options={SERVICES} placeholder="Any service" />
              </Field>
              <Field>
                <Field.Label>Regions</Field.Label>
                <MultiSelect options={REGIONS} defaultValue={["eu-west-1"]} selectAll placeholder="Any region" />
              </Field>
              <Field>
                <Field.Label>Labels</Field.Label>
                <TagInput suggestions={LABEL_SUGGESTIONS} validate={validateLabel} defaultValue={["p1"]} />
              </Field>
            </div>
          </Card.Body>
        </Card>
      </Row>
    </Stack>
  );
}
