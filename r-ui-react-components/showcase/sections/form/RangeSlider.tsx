import { useState } from "react";

import { Field, RangeSlider, type RangeSliderValue } from "../../../src/components/form";
import { Button } from "../../../src/components/primitives";
import { formatNumber } from "../../../src/util/format";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "RangeSlider",
  group: "form",
  order: 102,
  description:
    "A range with two thumbs (APG multi-thumb slider): a group named by its Field, each thumb named Minimum / Maximum (labels), with its own keys. The thumbs push against each other and never cross; minStepsBetweenThumbs keeps a gap. Committed once per gesture; submitted as two values.",
};

const EUR = { style: "currency", currency: "EUR", maximumFractionDigits: 0 } as const;
const PRICE_MIN = 0;
const PRICE_MAX = 1000;
/** A pretend catalogue: nightly prices, so the filter has a live count. */
const STAYS = Array.from({ length: 60 }, (_, i) => Math.round(((i * 37) % 97) * 10.3 + 20));

function PriceFilter() {
  const [range, setRange] = useState<RangeSliderValue>([120, 640]);
  const [applied, setApplied] = useState<RangeSliderValue>([120, 640]);
  const any = range[0] === PRICE_MIN && range[1] === PRICE_MAX;
  const count = STAYS.filter((p) => p >= applied[0] && p <= applied[1]).length;
  return (
    <div className="grid content-start gap-r4" data-sc="range-price">
      <Field>
        <Field.Label>Price per night</Field.Label>
        <RangeSlider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={10}
          minStepsBetweenThumbs={5}
          value={range}
          onValueChange={setRange}
          onValueCommit={setApplied}
          formatOptions={EUR}
          showValue
          marks={[
            { value: 0, label: formatNumber(0, EUR) },
            { value: 500, label: formatNumber(500, EUR) },
            { value: 1000, label: `${formatNumber(1000, EUR)}+` },
          ]}
        />
        <Field.Description>
          <span data-sc="range-readout">
            {any ? "Any price" : `${formatNumber(range[0], EUR)} – ${formatNumber(range[1], EUR)}`} ·{" "}
            {count === 0 ? "no stays match" : `${count} ${count === 1 ? "stay" : "stays"}`}
          </span>
        </Field.Description>
      </Field>
      <Button
        variant="secondary"
        className="justify-self-start"
        disabled={any}
        onClick={() => {
          setRange([PRICE_MIN, PRICE_MAX]);
          setApplied([PRICE_MIN, PRICE_MAX]);
        }}
      >
        Any price
      </Button>
    </div>
  );
}

export default function RangeSliderSection() {
  return (
    <Stack>
      <Row label="Price filter: the count updates once you let go (commit); the thumbs keep five steps apart">
        <PriceFilter />
      </Row>
      <Row label="States: invalid · disabled · read-only · thumbs that may meet · translated thumb names">
        <Grid>
          <Field>
            <Field.Label>Latency window</Field.Label>
            <RangeSlider defaultValue={[100, 900]} min={0} max={1000} step={50} formatValue={(ms) => `${ms} ms`} />
            <Field.Error>The window can span at most 500 ms.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Maintenance hours</Field.Label>
            <RangeSlider defaultValue={[2, 5]} min={0} max={24} formatValue={(h) => `${h}:00`} />
          </Field>
          <Field readOnly>
            <Field.Label>Contracted range (read-only)</Field.Label>
            <RangeSlider defaultValue={[20, 80]} formatOptions={{ style: "unit", unit: "percent" }} />
          </Field>
          <Field>
            <Field.Label>Thumbs that may meet</Field.Label>
            <RangeSlider defaultValue={[50, 50]} showValue data-sc="range-meet" />
          </Field>
          <Field>
            <Field.Label>Preis</Field.Label>
            <RangeSlider
              defaultValue={[200, 450]}
              min={0}
              max={600}
              step={25}
              locale="de-DE"
              formatOptions={EUR}
              labels={{ minimum: "Mindestpreis", maximum: "Höchstpreis" }}
            />
          </Field>
        </Grid>
      </Row>
      <Row label="Compact · RTL (low thumb on the right) · vertical">
        <Grid>
          <div data-density="compact">
            <Field>
              <Field.Label>Compact</Field.Label>
              <RangeSlider defaultValue={[25, 75]} marks={[0, 25, 50, 75, 100]} showValue />
            </Field>
          </div>
          <div dir="rtl" data-sc="range-rtl">
            <Field>
              <Field.Label>نطاق السعر</Field.Label>
              <RangeSlider defaultValue={[20, 60]} locale="ar-EG" labels={{ minimum: "الحد الأدنى", maximum: "الحد الأقصى" }} showValue />
            </Field>
          </div>
          <RangeSlider
            aria-label="Comfort band"
            orientation="vertical"
            min={16}
            max={28}
            step={0.5}
            defaultValue={[19.5, 22]}
            formatValue={(c) => `${c} °C`}
            marks={[
              { value: 16, label: "16°" },
              { value: 22, label: "22°" },
              { value: 28, label: "28°" },
            ]}
          />
        </Grid>
      </Row>
    </Stack>
  );
}
