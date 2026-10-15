import { useState } from "react";

import { ColorPicker, Field, Form, FormActions, useForm, useFormValue } from "../../../src/components/form";
import { BRAND_PALETTE, START } from "./parts/brand-palette.examples";
import { Grid, Row, Stack } from "./parts/demo";

export const meta = {
  title: "ColorPicker",
  group: "form",
  order: 135,
  description:
    "A colour field: the trigger shows the colour and its value as text; the popup (in place, top layer) holds an OKLCH lightness × chroma area with sRGB's edge hatched, a hue slider, optional opacity, typed hex or oklch(), named swatches as a radio group, the eyedropper where the browser has one, and a WCAG contrast readout against a theme surface. Bound through Field like any control.",
};

const SURFACE = { against: "var(--C-SURFACE-0)", label: "the surface" };

/** What the chosen brand colour would look like as link ink on the surface. */
function BrandPreview() {
  const brand = useFormValue<string>("brand");
  return (
    <p className="text-body-2 text-fg-secondary" data-sc="color-brand-preview">
      Preview:{" "}
      <span className="font-medium underline" style={{ color: brand || undefined }}>
        View the incident timeline
      </span>
    </p>
  );
}

function BrandSettings() {
  const [saved, setSaved] = useState("—");
  const form = useForm<{ brand: string }>({
    defaultValues: { brand: START.brand },
    onSubmit: (values) => setSaved(values.brand),
  });
  return (
    <Form form={form} className="grid content-start gap-r3" data-sc="color-brand">
      <Field name="brand">
        <Field.Label>Brand colour</Field.Label>
        <ColorPicker swatches={BRAND_PALETTE} contrast={SURFACE} />
        <Field.Description>Links and the primary action use it. Aim for AA on the surface.</Field.Description>
      </Field>
      <BrandPreview />
      <FormActions>
        <FormActions.Submit>Save brand</FormActions.Submit>
      </FormActions>
      <output className="text-body-2 text-fg-secondary" data-sc="color-brand-saved">
        saved = {saved}
      </output>
    </Form>
  );
}

export default function ColorPickerSection() {
  return (
    <Stack>
      <Row label="Brand colour setting: swatches, contrast against the theme surface, bound to a Form">
        <Grid>
          <BrandSettings />
        </Grid>
      </Row>

      <Row label="OKLCH value with opacity · a value outside sRGB (open it: the note says what is shown)">
        <Grid>
          <Field>
            <Field.Label>Overlay tint</Field.Label>
            <ColorPicker format="oklch" alpha defaultValue={START.overlay} contrast={SURFACE} data-sc="color-oklch" />
            <Field.Description>Written as oklch(L C H / A).</Field.Description>
          </Field>
          <Field>
            <Field.Label>Highlight</Field.Label>
            <ColorPicker format="oklch" defaultValue={START.vivid} />
          </Field>
        </Grid>
      </Row>

      <Row label="No colour yet · invalid · disabled · read-only">
        <Grid>
          <Field>
            <Field.Label>Team colour</Field.Label>
            <ColorPicker swatches={BRAND_PALETTE} />
            <Field.Description>Optional. Shown beside the team name.</Field.Description>
          </Field>
          <Field>
            <Field.Label>Alert colour</Field.Label>
            <ColorPicker defaultValue={START.invalid} />
            <Field.Error>Choose a colour that is not used for errors.</Field.Error>
          </Field>
          <Field disabled>
            <Field.Label>Locked by your organisation</Field.Label>
            <ColorPicker defaultValue={START.brand} />
          </Field>
          <Field readOnly>
            <Field.Label>Chart colour (read-only)</Field.Label>
            <ColorPicker defaultValue={START.chart} />
          </Field>
        </Grid>
      </Row>

      <Row label="Inside a compact card that clips (overflow: hidden)">
        <div
          data-density="compact"
          data-sc="color-clip"
          className="flex max-w-column-md flex-col gap-r3 overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-1 p-r3"
        >
          <Field>
            <Field.Label>Label colour</Field.Label>
            <ColorPicker swatches={BRAND_PALETTE} contrast={SURFACE} defaultValue={START.brand} />
          </Field>
        </div>
      </Row>

      <Row label="Right to left: the area and tracks run from the inline start">
        <div dir="rtl" className="max-w-column-md">
          <Field>
            <Field.Label>Accent</Field.Label>
            <ColorPicker swatches={BRAND_PALETTE.slice(0, 4)} defaultValue={START.brand} />
          </Field>
        </div>
      </Row>
    </Stack>
  );
}
