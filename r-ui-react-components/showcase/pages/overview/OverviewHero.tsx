import { SlidersHorizontal } from "lucide-react";
import { Fragment, useId, useState } from "react";

import { ProgressBar } from "../../../src/components/feedback";
import { Field, Input, SegmentedControl, Switch } from "../../../src/components/form";
import { Inline, Stack } from "../../../src/components/layout";
import { Hero } from "../../../src/components/marketing";
import { startViewTransition } from "../../../src/components/motion";
import { Tooltip, useToast } from "../../../src/components/overlays";
import { Button, Card, StatusLabel } from "../../../src/components/primitives";
import { ToggleGroup } from "../../../src/components/toolbar";
import type { Density } from "../../../src/util/preferences";
import { useTheme } from "../../../src/hooks/use-preferences";
import { href } from "../../shell/router";
import { PREFERENCES, THEMES } from "../../shell/view";
import { ThemeSwatch, themePalettes } from "../../shell/ThemeSwatch";

const ROLLOUT_START = 62;

/** The release card the hero restyles: real components, with state of their own. */
function Specimen({ density }: { density: Density }) {
  const { toast } = useToast();
  const [traffic, setTraffic] = useState(ROLLOUT_START);
  const status =
    traffic === 100
      ? ({ tone: "success", label: "Live" } as const)
      : traffic === 0
        ? ({ tone: "warning", label: "Rolled back" } as const)
        : ({ tone: "info", label: "Rolling out" } as const);

  return (
    <Card data-density={density} data-overview-specimen="">
      <Card.Header>
        <Card.Title as="h2">checkout-api 2.14</Card.Title>
        <Card.Description>Production, EU and US regions</Card.Description>
        <Card.Actions>
          <StatusLabel tone={status.tone}>{status.label}</StatusLabel>
        </Card.Actions>
      </Card.Header>
      <Card.Body>
        <Stack gap="r3">
          <ProgressBar label="Traffic on 2.14" value={traffic} tone={status.tone === "warning" ? "warning" : undefined} />
          <Field>
            <Field.Label>Release note</Field.Label>
            <Input defaultValue="Faster card payments in the EU" />
          </Field>
          <Switch defaultChecked>Notify the payments team</Switch>
        </Stack>
      </Card.Body>
      <Card.Footer>
        <Inline gap="r4" justify="end">
          <Button
            variant="secondary"
            disabled={traffic === 0}
            onClick={() => {
              setTraffic(0);
              toast({ title: "Rolled back to 2.13", tone: "warning" });
            }}
          >
            Roll back
          </Button>
          <Button
            disabled={traffic === 100}
            onClick={() => {
              setTraffic(100);
              toast({ title: "checkout-api 2.14 is live", tone: "success" });
            }}
          >
            Promote to 100%
          </Button>
        </Inline>
      </Card.Footer>
    </Card>
  );
}

/** The current theme by name over every theme as a swatch, light themes then dark. Choosing one restyles the whole page. */
function ThemePicker() {
  const { theme, setTheme } = useTheme(PREFERENCES);
  const palettes = themePalettes();
  const schemes = [false, true].map((dark) => THEMES.filter((t) => (palettes.get(t.value)?.dark ?? false) === dark));
  const label = useId();

  return (
    <div className="sc-theme-picker">
      <p className="sc-restyle-label">
        <span id={label}>Theme</span> <span className="sc-theme-name">{THEMES.find((t) => t.value === theme)?.label}</span>
      </p>
      <ToggleGroup
        type="single"
        aria-labelledby={label}
        value={theme}
        onValueChange={(next) => {
          const pick = THEMES.find((t) => t.value === next);
          if (pick) startViewTransition(() => setTheme(pick.value));
        }}
      >
        {schemes.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && group.length > 0 && <span className="sc-theme-divider" aria-hidden />}
            {group.map((t) => (
              <Tooltip key={t.value} content={t.label} delay={150}>
                <ToggleGroup.Item value={t.value} label={t.label} icon={<ThemeSwatch theme={t.value} />} className="rounded-full" />
              </Tooltip>
            ))}
          </Fragment>
        ))}
      </ToggleGroup>
    </div>
  );
}

/**
 * Where the same settings live on every page. The button opens the real View panel,
 * so a reader learns where it is by seeing it.
 */
function ViewHint() {
  return (
    <p className="sc-view-hint">
      <Button
        variant="secondary"
        iconStart={<SlidersHorizontal aria-hidden className="size-icon" />}
        aria-label="Open the View menu"
        onClick={() => document.querySelector<HTMLElement>("[data-showcase-view-trigger]")?.click()}
      >
        View
      </Button>
      <span>at the top right of every page sets its theme, density and input.</span>
    </p>
  );
}

/**
 * The specimen and what restyles it: the page's theme (the whole page follows,
 * cross-faded) and the card's own density (only the card follows).
 */
function LiveSpecimen() {
  const [density, setDensity] = useState<Density>("comfortable");
  const densityLabel = useId();

  return (
    <Stack gap="r2">
      <Specimen density={density} />
      <div className="sc-restyle">
        <ThemePicker />
        <div className="sc-density">
          <span id={densityLabel} className="sc-restyle-label">
            Card density
          </span>
            <SegmentedControl aria-labelledby={densityLabel} value={density} onValueChange={(next) => setDensity(next as Density)}>
            <SegmentedControl.Item value="comfortable">Comfortable</SegmentedControl.Item>
            <SegmentedControl.Item value="compact">Compact</SegmentedControl.Item>
          </SegmentedControl>
        </div>
      </div>
      <ViewHint />
    </Stack>
  );
}

/** The Overview's opening: what the library is, shown by restyling real components in place. */
export function OverviewHero() {
  return (
    // App-page rhythm, not a landing page's: the smallest section step, and no gutter of its own
    // (the page already has one), so the hero lines up with the content under it.
    <Hero
      className="py-section-3"
      classNames={{ container: "px-0" }}
      layout="split"
      title="Components that take any look"
      lead="React 19 components that read one set of tokens. Restyle the card with a theme or a density: the components stay the same and no code changes."
      actions={
        <>
          <Button href={href("overview", "primitives")}>Start with primitives</Button>
          <Button href={href("dashboard")} variant="secondary">
            See a dashboard
          </Button>
        </>
      }
      media={<LiveSpecimen />}
    />
  );
}
