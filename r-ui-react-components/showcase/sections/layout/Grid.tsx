import { Grid, Stack } from "../../../src/components/layout";
import { Row } from "./parts/demo";

export const meta = {
  title: "Grid",
  group: "layout",
  order: 20,
  description:
    "Columns follow the grid's OWN width, never the viewport. Auto-fit drops a column when one would fall under its floor (the contract's --COLUMN-SM/MD/LG); explicit counts switch at container sizes.",
};

function Tile({ i }: { i: number }) {
  return (
    <div className="rounded-md border bg-surface-1 p-r3 text-body-2 text-fg-secondary">
      Tile {i + 1}
    </div>
  );
}

const tiles = (n: number) => Array.from({ length: n }, (_, i) => <Tile key={i} i={i} />);

export default function GridSection() {
  return (
    <Stack gap="r1">
      <Row label="Auto-fit · minColumn sm / md (default) / lg">
        <Stack gap="r3">
          <Grid minColumn="sm" data-testid="grid-sm">{tiles(6)}</Grid>
          <Grid data-testid="grid-md">{tiles(6)}</Grid>
          <Grid minColumn="lg" data-testid="grid-lg">{tiles(6)}</Grid>
        </Stack>
      </Row>
      <Row label="The same grid in a half-width container: fewer columns, same screen">
        <div className="w-1/2">
          <Grid data-testid="grid-half">{tiles(6)}</Grid>
        </div>
      </Row>
      <Row label="Explicit: 1 → 2 at @md → 4 at @3xl">
        <Grid columns={{ base: 1, "@md": 2, "@3xl": 4 }} data-testid="grid-explicit">
          {tiles(8)}
        </Grid>
      </Row>
      <Row label="As a list, gap r1">
        <Grid as="ul" gap="r1" aria-label="Services">
          {["checkout", "payments-api", "ledger"].map((s) => (
            <li key={s} className="rounded-md border p-r3">
              {s}
            </li>
          ))}
        </Grid>
      </Row>
    </Stack>
  );
}
