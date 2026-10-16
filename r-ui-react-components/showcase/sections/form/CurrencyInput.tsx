import { useState } from "react";

import { CurrencyInput, Field, Form, FormActions, useForm } from "../../../src/components/form";
import { formatNumber } from "../../../src/util/format";
import { LocaleProvider } from "../../../src/util/locale";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "CurrencyInput",
  group: "form",
  order: 27,
  description:
    "Money typed in the locale's own separators (“1.234,5” in German) and shown to the currency's precision once the field is left (“1.234,50”; ¥ has none). The sign sits where the locale writes it. It reads typed text with NumberInput's parser and commits like it (blur or Enter; unreadable text reverts), without steppers. min/max clamp, negatives are opt-in (a minus or accounting brackets), and minorUnits makes the value whole cents.",
};

/** A plan's prices and budget, edited in the locale the provider sets. */
function PlanForm({ locale, currency, testId }: { locale: string; currency: string; testId: string }) {
  const [saved, setSaved] = useState("—");
  const form = useForm<{ price: number | null; budget: number | null }>({
    defaultValues: { price: 49, budget: 12500 },
    onSubmit: (values) => setSaved(JSON.stringify(values)),
  });
  return (
    <LocaleProvider locale={locale}>
      <Form form={form} className="grid content-start gap-r3" data-sc={testId}>
        <Field name="price" required>
          <Field.Label>Monthly price</Field.Label>
          <CurrencyInput currency={currency} min={1} max={9999} />
          <Field.Description>Per seat. 1 to 9,999.</Field.Description>
        </Field>
        <Field name="budget">
          <Field.Label>Annual budget</Field.Label>
          <CurrencyInput currency={currency} />
        </Field>
        <FormActions>
          <FormActions.Submit>Save plan</FormActions.Submit>
        </FormActions>
        <output className="text-body-2 text-fg-secondary">
          Saved: <span data-sc="currency-saved">{saved}</span>
        </output>
      </Form>
    </LocaleProvider>
  );
}

/** Minor units: the value is whole cents, as a payment API wants it. */
function Refund() {
  const [cents, setCents] = useState<number | null>(-1250);
  return (
    <Field data-sc="currency-refund">
      <Field.Label>Adjustment</Field.Label>
      <CurrencyInput currency="USD" locale="en-US" minorUnits allowNegative value={cents} onValueChange={setCents} />
      <Field.Description>
        Negative for a refund; “(12.50)” works too. Value in cents: <span data-sc="currency-cents">{formatNumber(cents, { locale: "en-US" })}</span>
      </Field.Description>
    </Field>
  );
}

export default function CurrencyInputSection() {
  return (
    <Stack>
      <Row label="Pricing and budget in two locales through LocaleProvider: en-US dollars (sign first) and de-DE euros (sign last, comma decimals)">
        <Grid>
          <PlanForm locale="en-US" currency="USD" testId="currency-en" />
          <PlanForm locale="de-DE" currency="EUR" testId="currency-de" />
        </Grid>
      </Row>
      <Row label="Yen (no fraction digits) · minor units with negatives · ISO code display · empty · invalid · disabled">
        <Grid>
          <Field>
            <Field.Label>Hotel, per night</Field.Label>
            <CurrencyInput currency="JPY" locale="ja-JP" defaultValue={18400} />
          </Field>
          <Refund />
          <Field>
            <Field.Label>Wire amount</Field.Label>
            <CurrencyInput currency="CHF" locale="de-CH" currencyDisplay="code" defaultValue={250000} />
          </Field>
          <Field>
            <Field.Label>Tip</Field.Label>
            <CurrencyInput currency="GBP" locale="en-GB" placeholder="Optional" />
          </Field>
          <Field invalid>
            <Field.Label>Deposit</Field.Label>
            <CurrencyInput currency="USD" locale="en-US" defaultValue={0} />
            <Field.Error>The deposit must be more than zero.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Credit limit</Field.Label>
            <CurrencyInput currency="USD" locale="en-US" defaultValue={5000} />
          </Field>
        </Grid>
      </Row>
      <Row label="A long amount · compact subtree · RTL (Arabic digits, the sign where ar-EG writes it)">
        <Grid>
          <Field>
            <Field.Label>Series B valuation</Field.Label>
            <CurrencyInput currency="USD" locale="en-US" defaultValue={1234567890123.45} />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Budget</Field.Label>
              <CurrencyInput currency="EUR" locale="fr-FR" defaultValue={1234.5} />
            </Field>
          </div>
          <LocaleProvider locale="ar-EG" dir="rtl">
            <Field>
              <Field.Label>المبلغ</Field.Label>
              <CurrencyInput currency="EGP" defaultValue={1234.5} />
            </Field>
          </LocaleProvider>
        </Grid>
      </Row>
    </Stack>
  );
}
