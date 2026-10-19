import { Eye, GitMerge, PenLine, Send, ShieldCheck, Users } from "lucide-react";

import { FeatureGrid } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "FeatureGrid",
  group: "marketing",
  order: 110,
  description:
    "Icon, title and text per feature in a list on the layout Grid: one column, two from an @xl grid, three from @4xl (the GRID's width, not the screen's). A linked item is one link named by its title, stretched over the item and ringed around it. Plain or card; any heading level.",
};

const FEATURES = [
  { icon: <GitMerge />, title: "Drafts from merges", body: "Every merged pull request becomes a line in the next release note, in plain words." },
  { icon: <Users />, title: "Sorted by audience", body: "Admins, developers and end users each get the changes that touch them, and only those." },
  { icon: <PenLine />, title: "Edit in place", body: "Rewrite a line where it sits; the source link and the reviewers stay attached." },
  { icon: <ShieldCheck />, title: "A review queue", body: "Nothing ships unread. A second pair of eyes signs off before anything is published." },
  { icon: <Send />, title: "Publish everywhere", body: "Changelog page, in-app panel, email digest and RSS, from one click." },
  { icon: <Eye />, title: "See who read it", body: "Opens and clicks per audience, so you know which changes landed." },
];

export default function FeatureGridSection() {
  return (
    <Stack>
      <Row label="Six features, plain (default) · titles h4 under the section's h3 · the last two linked">
        <FeatureGrid headingLevel={4} data-sc="features-plain">
          {FEATURES.map(({ icon, title, body }, i) => (
            <FeatureGrid.Item key={title} icon={icon} title={title} href={i >= 4 ? "#/overview/marketing-featuregrid" : undefined}>
              {body}
            </FeatureGrid.Item>
          ))}
        </FeatureGrid>
      </Row>
      <Row label="Cards, every item linked · hover firms the edge, a press anywhere follows the title's link">
        <FeatureGrid variant="card" headingLevel={4} data-sc="features-card">
          {FEATURES.slice(0, 3).map(({ icon, title, body }) => (
            <FeatureGrid.Item key={title} icon={icon} title={title} href="#/overview/marketing-featuregrid">
              {body}
            </FeatureGrid.Item>
          ))}
        </FeatureGrid>
      </Row>
      <Row label="Compact density (the tile and gaps follow it; the display title does not) · long words break · no icon">
        <div data-density="compact">
          <FeatureGrid variant="card" headingLevel={4} minColumn="sm">
            <FeatureGrid.Item icon={<GitMerge />} title="Automatische-Versionshinweise-aus-zusammengeführten-Änderungen">
              Jede zusammengeführte Änderung wird zu einer Zeile im nächsten Versionshinweis.
            </FeatureGrid.Item>
            <FeatureGrid.Item title="No icon">An item without one renders no tile.</FeatureGrid.Item>
            <FeatureGrid.Item icon={<Eye />} title="Title only" />
          </FeatureGrid>
        </div>
      </Row>
      <Row label="RTL">
        <div dir="rtl">
          <FeatureGrid headingLevel={4} columns={{ base: 1, "@xl": 3 }}>
            <FeatureGrid.Item icon={<GitMerge />} title="مسودات من الدمج" href="#/overview/marketing-featuregrid">
              يصبح كل طلب دمج سطرًا في ملاحظة الإصدار التالية.
            </FeatureGrid.Item>
            <FeatureGrid.Item icon={<Users />} title="حسب الجمهور">
              يحصل كل جمهور على التغييرات التي تخصه فقط.
            </FeatureGrid.Item>
            <FeatureGrid.Item icon={<Send />} title="انشر في كل مكان">
              صفحة التغييرات والبريد وموجز RSS بنقرة واحدة.
            </FeatureGrid.Item>
          </FeatureGrid>
        </div>
      </Row>
    </Stack>
  );
}
