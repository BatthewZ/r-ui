import { Feather, Moon, Sun, Waves } from "lucide-react";

import { Field } from "../../../src/components/form";
import { Grid, Stack } from "../../../src/components/layout";
import { DensitySwitcher, InputSwitcher, ThemeSwitcher } from "../../../src/components/preferences";
import { PREFERENCES, THEMES } from "../../shell/view";
import { Row } from "./parts/demo";

export const meta = {
  title: "ThemeSwitcher, DensitySwitcher, InputSwitcher",
  group: "preferences",
  order: 10,
  description:
    "Live: each one sets its attribute on <html> for the whole page and saves it, so the View panel, these and a reload (ThemeScript) all agree. Themes are the app's own list; the first is the default. Segmented for a handful (all visible), or a native select for any count.",
};

/* Segments are all visible, so they suit a handful of themes; the app lists more, so the
   segmented demo takes the default and the CSS package's examples, and the select takes all. */
const SEGMENTED_ICONS = {
  default: <Sun aria-hidden />,
  nightfall: <Moon aria-hidden />,
  harbour: <Waves aria-hidden />,
  atelier: <Feather aria-hidden />,
};
const isSegmented = (value: string): value is keyof typeof SEGMENTED_ICONS => value in SEGMENTED_ICONS;
const SEGMENTED = THEMES.flatMap((t) => (isSegmented(t.value) ? [{ ...t, icon: SEGMENTED_ICONS[t.value] }] : []));
const SEGMENTED_PLAIN = SEGMENTED.map(({ value, label }) => ({ value, label }));

export default function SwitchersSection() {
  const { storageKey } = PREFERENCES;
  return (
    <Stack gap="r1">
      <Row label="Segmented (a handful of themes), with a visible Field label">
        {/* Even a handful of themes needs the width, so they get a row of their own. */}
        <Grid columns={{ base: 1, "@3xl": 2 }} gap="r2">
          <Field className="@3xl:col-span-2">
            <Field.Label>Theme</Field.Label>
            <ThemeSwitcher themes={SEGMENTED} storageKey={storageKey} />
          </Field>
          <Field>
            <Field.Label>Density</Field.Label>
            <DensitySwitcher storageKey={storageKey} />
          </Field>
          <Field>
            <Field.Label>Input</Field.Label>
            <InputSwitcher storageKey={storageKey} />
          </Field>
        </Grid>
      </Row>
      <Row label="Select variant (a long theme list, a tight toolbar) · translated words">
        <Grid columns={{ base: 1, "@3xl": 3 }} gap="r2">
          <ThemeSwitcher themes={THEMES} storageKey={storageKey} variant="select" labels={{ theme: "Colour theme" }} />
          <DensitySwitcher
            storageKey={storageKey}
            variant="select"
            labels={{ density: "Dichte", densities: { comfortable: "Komfortabel", compact: "Kompakt" } }}
          />
          <InputSwitcher
            storageKey={storageKey}
            variant="select"
            labels={{ input: "Eingabe", inputs: { auto: "Automatisch", fine: "Maus und Stift", coarse: "Berührung" } }}
          />
        </Grid>
      </Row>
      <Row label="In a compact region · disabled">
        <div data-density="compact" className="flex flex-wrap items-center gap-r3">
          <DensitySwitcher storageKey={storageKey} aria-label="Density (compact region)" />
          <ThemeSwitcher themes={SEGMENTED_PLAIN} storageKey={storageKey} aria-label="Theme (disabled)" disabled />
        </div>
      </Row>
    </Stack>
  );
}
