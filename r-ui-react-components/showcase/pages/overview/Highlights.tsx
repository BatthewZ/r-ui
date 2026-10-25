import { Blocks, ListChecks, MonitorSmartphone, Palette, ShieldCheck, Type } from "lucide-react";

import { FeatureGrid } from "../../../src/components/marketing";

/** Why the library exists and what it is built on, one short item each. */
export function Highlights() {
  return (
    <FeatureGrid headingLevel={2} aria-label="What you get">
      <FeatureGrid.Item icon={<Palette aria-hidden />} title="Reskin with one CSS file">
        Colour, type, shape, depth, motion and what each density means are theme tokens. A new look touches no
        component.
      </FeatureGrid.Item>
      <FeatureGrid.Item icon={<Type aria-hidden />} title="Two scales, picked by role">
        UI text follows density and stays flat: a wider screen gets more columns, not bigger buttons. Prose is fluid
        with its container at a readable line length. A button in an article stays a button.
      </FeatureGrid.Item>
      <FeatureGrid.Item icon={<MonitorSmartphone aria-hidden />} title="Responsive by context">
        Size follows density, the pointer and the space a component has; screen width only moves layout. Your app
        sets <code className="font-mono">data-density</code> on any element, whenever it decides.
      </FeatureGrid.Item>
      <FeatureGrid.Item icon={<ListChecks aria-hidden />} title="Forms, data and more">
        <code className="font-mono">useForm</code> with any Standard Schema; a failed submit focuses the first
        invalid field. Plus tables, charts, dates, a command palette and kanban.
      </FeatureGrid.Item>
      <FeatureGrid.Item icon={<Blocks aria-hidden />} title="Ready-made, not from scratch">
        Date pickers, data tables and menus with keyboard, touch, right-to-left and contrast already solved, and
        tested on every change.
      </FeatureGrid.Item>
      <FeatureGrid.Item icon={<ShieldCheck aria-hidden />} title="Checked everywhere">
        Phone and desktop, both densities, touch, light and dark, forced colours and print, checked in a real browser.
        Every theme passes a contrast check.
      </FeatureGrid.Item>
    </FeatureGrid>
  );
}
