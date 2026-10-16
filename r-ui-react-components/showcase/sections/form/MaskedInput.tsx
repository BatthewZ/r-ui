import { useState } from "react";

import { Field, Form, FormActions, MaskedInput, type MaskTokens, useForm } from "../../../src/components/form";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "MaskedInput",
  group: "form",
  order: 26,
  description:
    "A field that follows a pattern: 9 a digit, A a letter, * either, anything else a literal, and custom tokens. Literals appear as the value reaches them; typing, Backspace, Delete, paste and a replaced selection anywhere keep the caret where the edit happened, and refused characters are dropped. The value is raw (onValueChange(raw, formatted)); an all-digit mask asks for the number pad and stays left to right in RTL.",
};

/** An expiry is MM/YY with a real month that has not passed (the demo's "today" is October 2026). */
function expiryError(raw: unknown): string | undefined {
  const text = String(raw ?? "");
  if (text.length < 4) return "Enter the month and year, as on the card.";
  const month = Number(text.slice(0, 2));
  const year = 2000 + Number(text.slice(2));
  if (month < 1 || month > 12) return "The month is 01 to 12.";
  if (year < 2026 || (year === 2026 && month < 10)) return "This card has expired.";
  return undefined;
}

/** A checkout's card details: phone and expiry bound through Field name, raw values posted. */
function Checkout() {
  const [posted, setPosted] = useState("—");
  const form = useForm({
    defaultValues: { phone: "", expiry: "" },
    validateOn: "blur",
    onSubmit: (values) => setPosted(JSON.stringify(values)),
  });
  return (
    <Form form={form} className="grid max-w-column-lg content-start gap-r3" data-sc="masked-checkout">
      <Field name="phone" required validate={(value) => (String(value ?? "").length === 10 ? undefined : "Enter all 10 digits.")}>
        <Field.Label>Phone</Field.Label>
        <MaskedInput mask="(999) 999-9999" type="tel" autoComplete="tel-national" />
        <Field.Description>For delivery updates only.</Field.Description>
        <Field.Error />
      </Field>
      <Field name="expiry" required validate={expiryError}>
        <Field.Label>Expiry date</Field.Label>
        <MaskedInput mask="99/99" placeholder="MM/YY" autoComplete="cc-exp" className="w-column-sm max-w-full" />
        <Field.Error />
      </Field>
      <FormActions>
        <FormActions.Submit>Save card</FormActions.Submit>
      </FormActions>
      <output className="text-body-2 text-fg-secondary">
        Posted: <span data-sc="masked-posted">{posted}</span>
      </output>
    </Form>
  );
}

/** A value readout: what the form would hold beside what the field shows. */
function Plate() {
  const [value, setValue] = useState({ raw: "", formatted: "" });
  return (
    <Field data-sc="masked-plate">
      <Field.Label>Licence plate</Field.Label>
      <MaskedInput mask="AAA-9999" tokens={UPPER_LETTER} onValueChange={(raw, formatted) => setValue({ raw, formatted })} />
      <Field.Description>
        Raw <span data-sc="masked-raw">{value.raw || "—"}</span> · shown {value.formatted || "—"}
      </Field.Description>
    </Field>
  );
}

const UPPER_LETTER: MaskTokens = { A: { test: (char) => /^\p{L}$/u.test(char), transform: (char) => char.toLocaleUpperCase() } };
const HEX: MaskTokens = { h: { test: (char) => /^[0-9a-f]$/i.test(char), transform: (char) => char.toUpperCase() } };

export default function MaskedInputSection() {
  return (
    <Stack>
      <Row label="Checkout: phone (tel keypad) and card expiry (MM/YY placeholder, month and date checked) bound through Field name; the raw values post">
        <Checkout />
      </Row>
      <Row label="Letters and digits upper-cased (raw vs shown) · a custom token (hex colour) · a long IBAN mask · prefilled">
        <Grid>
          <Plate />
          <Field>
            <Field.Label>Brand colour</Field.Label>
            <MaskedInput mask="#hhhhhh" tokens={HEX} defaultValue="0b5fff" />
          </Field>
          <Field>
            <Field.Label>IBAN</Field.Label>
            <MaskedInput mask="AA99 9999 9999 9999 9999 99" tokens={UPPER_LETTER} defaultValue="DE89370400440532013000" />
          </Field>
        </Grid>
      </Row>
      <Row label="Invalid · disabled · read-only · compact subtree · RTL page (the number stays left to right)">
        <Grid>
          <Field invalid>
            <Field.Label>Phone</Field.Label>
            <MaskedInput mask="(999) 999-9999" defaultValue="555123" />
            <Field.Error>Enter all 10 digits.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Phone</Field.Label>
            <MaskedInput mask="(999) 999-9999" defaultValue="5551234567" />
          </Field>
          <Field readOnly>
            <Field.Label>Account number</Field.Label>
            <MaskedInput mask="9999 9999 99" defaultValue="1234567890" />
          </Field>
          <div data-density="compact">
            <Field>
              <Field.Label>Expiry date</Field.Label>
              <MaskedInput mask="99/99" placeholder="MM/YY" defaultValue="0928" />
            </Field>
          </div>
          <div dir="rtl">
            <Field>
              <Field.Label>رقم الهاتف</Field.Label>
              <MaskedInput mask="999 999 9999" type="tel" defaultValue="0501234567" />
            </Field>
          </div>
        </Grid>
      </Row>
    </Stack>
  );
}
