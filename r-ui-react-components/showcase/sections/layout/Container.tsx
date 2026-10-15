import { Container, Section, Stack } from "../../../src/components/layout";
import { Button } from "../../../src/components/primitives";
import { Row } from "./parts/demo";

export const meta = {
  title: "Container and Section",
  group: "layout",
  order: 30,
  description:
    "Container centres content at the page or reading width with the fluid gutter. Section spaces marketing blocks with the fluid section rhythm; both are density-independent, so compact leaves them alone.",
};

export default function ContainerSection() {
  return (
    <Stack gap="r1">
      <Row label="Container · page · measure · full (tint: the parent; dashed: the content edge, inside the gutter)">
        <Stack gap="r3">
          {(["page", "measure", "full"] as const).map((width) => (
            <div key={width} className="bg-surface-2">
              <Container width={width} className="bg-surface-0" data-testid={`container-${width}`}>
                <div className="border-x border-dashed border-border-strong py-r4 text-body-2 text-fg-secondary">
                  width=&quot;{width}&quot;
                </div>
              </Container>
            </div>
          ))}
        </Stack>
      </Row>
      <Row label="Section · plain, band, then section-3">
        <div className="overflow-hidden rounded-md border">
          <Section aria-label="Hero">
            <Container width="measure">
              <Stack gap="r3">
                <h2 className="text-display-2">Ship on a Friday.</h2>
                <p className="text-prose-1 text-fg-secondary">
                  Deploys you can watch, roll back and explain. The section rhythm and gutter are fluid; the
                  button is UI and keeps the control height.
                </p>
                <div>
                  <Button variant="primary">Start a trial</Button>
                </div>
              </Stack>
            </Container>
          </Section>
          <Section variant="band" padding="section-2" aria-label="Logos">
            <Container>
              <p className="text-center text-body-2 text-fg-secondary">Trusted by teams who page at 3am.</p>
            </Container>
          </Section>
          <Section padding="section-3" aria-label="Footer note">
            <Container>
              <p className="text-body-3 text-fg-muted">section-3: between a heading group and its content.</p>
            </Container>
          </Section>
        </div>
      </Row>
    </Stack>
  );
}
