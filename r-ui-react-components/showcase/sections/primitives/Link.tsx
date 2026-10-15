import { Card, Link } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Link",
  group: "primitives",
  order: 80,
  description:
    "Accent text-safe ink, decorated by the theme's --LINK-DECORATION lever and always underlined on hover. External links carry a glyph; a new tab is announced; a refused URL renders as text.",
};

export default function LinkSection() {
  return (
    <Stack>
      <Row label="In UI text · inherit ink · external · new tab · refused href">
        <div className="grid gap-r4 text-body-1">
          <p>
            Read the <Link href="#/overview/primitives-card">Card docs</Link> before composing a dashboard.
          </p>
          <p className="text-body-2 text-fg-muted">
            © 2026 Example Inc. · <Link href="#/overview" variant="inherit">Terms</Link> ·{" "}
            <Link href="#/overview" variant="inherit">Privacy</Link>
          </p>
          <p>
            Status hosted at <Link href="https://status.example.com" external>status.example.com</Link>, or open the{" "}
            <Link href="https://example.com/changelog" target="_blank">
              changelog
            </Link>{" "}
            in a new tab.
          </p>
          <p>
            Refused: <Link href="javascript:alert(1)">this would have been a script link</Link>.
          </p>
        </div>
      </Row>

      <Row label="In prose (inherits the prose size) · in a card · compact · long URL wraps">
        <div className="grid gap-r3 @2xl:grid-cols-2">
          <div className="prose min-w-0">
            <p>
              Prose links share the theme lever: see the <Link href="#/overview">overview</Link> for every component, or the{" "}
              <Link href="https://example.com/a/very/long/path/that/keeps/going/and/going" external>
                https://example.com/a/very/long/path/that/keeps/going/and/going
              </Link>
              .
            </p>
          </div>
          <Card data-density="compact">
            <Card.Header>
              <Card.Title>Compact card</Card.Title>
              <Card.Description>
                <Link href="#/overview">View details</Link>
              </Card.Description>
            </Card.Header>
          </Card>
        </div>
      </Row>
    </Stack>
  );
}
