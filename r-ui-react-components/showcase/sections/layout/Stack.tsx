import { Grid, Inline, type Space, Stack } from "../../../src/components/layout";
import { Row } from "./parts/demo";

export const meta = {
  title: "Stack and Inline",
  group: "layout",
  order: 10,
  components: ["Inline"],
  description:
    "Stack is a column, Inline a wrapping row. Gaps take scale names only (r1 largest … r6 smallest), so they follow density: flip compact and every gap tightens.",
};

const STEPS: Space[] = ["r1", "r2", "r3", "r4", "r5", "r6"];

function Box({ children }: { children: React.ReactNode }) {
  return <div className="rounded-sm border bg-surface-1 px-r4 py-r5 text-body-2">{children}</div>;
}

export default function StackSection() {
  return (
    <Stack gap="r1">
      <Row label="Stack · every gap step">
        <Grid columns={{ base: 3, "@3xl": 6 }} gap="r1">
          {STEPS.map((gap) => (
            <Stack key={gap} gap={gap} data-testid={`stack-${gap}`}>
              <Box>{gap}</Box>
              <Box>{gap}</Box>
              <Box>{gap}</Box>
            </Stack>
          ))}
        </Grid>
      </Row>
      <Row label="Stack · align center, as a list">
        <Stack as="ul" gap="r4" align="center">
          {["Short", "A somewhat longer item", "Mid"].map((t) => (
            <li key={t}>
              <Box>{t}</Box>
            </li>
          ))}
        </Stack>
      </Row>
      <Row label="Inline · wraps; separate row gap">
        <Inline gap="r4" rowGap="r5">
          {["checkout", "payments-api", "ledger", "search", "notifications-worker", "auth", "media-transcoder", "edge-cache"].map(
            (t) => (
              <Box key={t}>{t}</Box>
            ),
          )}
        </Inline>
      </Row>
      <Row label="Inline · justify between, baseline">
        <Inline justify="between" align="baseline">
          <span className="text-h3">Payments</span>
          <span className="text-body-2 text-fg-secondary">Updated 2 min ago</span>
        </Inline>
      </Row>
      <Row label="Inline · right-to-left">
        <Inline dir="rtl">
          <Box>אחד</Box>
          <Box>שניים</Box>
          <Box>שלושה</Box>
        </Inline>
      </Row>
    </Stack>
  );
}
