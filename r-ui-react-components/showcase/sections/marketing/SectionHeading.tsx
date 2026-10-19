import { SectionHeading } from "../../../src";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "SectionHeading",
  group: "marketing",
  order: 13,
  description:
    "The heading group that opens each section after the hero: a UI-scale eyebrow, a display heading (balanced, never widening its box) and a prose lead capped at the measure. The eyebrow follows density; the heading and lead are display and prose scale, so a compact subtree leaves them alone.",
};

export default function SectionHeadingSection() {
  return (
    <Stack>
      <Row label="Start-aligned · eyebrow, h2 and lead · names its section through titleId">
        <section aria-labelledby="sc-heading-start" data-sc="section-heading-start">
          <SectionHeading
            titleId="sc-heading-start"
            eyebrow="Product"
            title="From merged to explained, before the release meeting ends."
            lead="Kiln sits between your repository and your customers. It does the first ninety percent of the writing, so the last ten gets your full attention."
          />
        </section>
      </Row>
      <Row label="Centred · title only · h3">
        <SectionHeading align="center" headingLevel={3} title="What teams ask before they switch." />
      </Row>
      <Row label="Long content: an unbroken word breaks inside the column">
        <div className="max-w-column-md">
          <SectionHeading
            eyebrow="Supercalifragilisticexpialidociousreleasenotes"
            title="Changelogsthatnobodyreadsbecausetheyneverendandneverbreak anywhere"
            lead="Averylonglinewithoutanyspacesatallthatmustwrapratherthanwidenitsbox."
          />
        </div>
      </Row>
      <Row label="Compact subtree (the eyebrow re-derives; display and prose do not) · RTL">
        <div className="grid gap-r2 @3xl:grid-cols-2">
          <div data-density="compact">
            <SectionHeading eyebrow="Customers" title="Teams that stopped writing changelogs by hand." />
          </div>
          <div dir="rtl" lang="ar">
            <SectionHeading eyebrow="المنتج" title="من الدمج إلى الشرح، قبل أن ينتهي اجتماع الإصدار." lead="يكتب التسعين بالمئة الأولى عنك." />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
