import { Inline, Stack } from "../../../src/components/layout";
import { PreferencesMenu } from "../../../src/components/preferences";
import { PREFERENCES, THEMES } from "../../shell/view";
import { Row } from "./parts/demo";

export const meta = {
  title: "PreferencesMenu and ThemeScript",
  group: "preferences",
  order: 20,
  components: ["ThemeScript"],
  description:
    "Theme, density and input in one compact menu for a header; choices apply at once and the menu stays open to compare. ThemeScript restores the saved choice before first paint; the showcase's own <head> carries it (reload to see no flash).",
};

export default function PreferencesMenuSection() {
  return (
    <Stack gap="r1">
      <Row label="Every axis · just density and input · translated, at the start of a toolbar">
        <Inline gap="r3">
          <PreferencesMenu themes={THEMES} storageKey={PREFERENCES.storageKey} />
          <PreferencesMenu storageKey={PREFERENCES.storageKey} labels={{ trigger: "Layout" }} />
          <PreferencesMenu
            themes={THEMES}
            storageKey={PREFERENCES.storageKey}
            placement="bottom-start"
            hide={["input"]}
            labels={{ trigger: "Ansicht", theme: "Thema", density: "Dichte", densities: { comfortable: "Komfortabel", compact: "Kompakt" } }}
          />
        </Inline>
      </Row>
      <Row label="themeScript(): what this client-only page's <head> inlines (see vite.config.ts); an SSR app renders <ThemeScript> with the same props">
        <pre className="max-h-[calc(var(--ROW-H)*6)] overflow-auto rounded-md bg-surface-1 p-r4 font-mono text-body-3 whitespace-pre-wrap [overflow-wrap:anywhere]">
          {`<script>{themeScript({ themes: ${JSON.stringify(PREFERENCES.themes)}, storageKey: "${PREFERENCES.storageKey}" })}</script>`}
        </pre>
      </Row>
    </Stack>
  );
}
