import { ReadingProgress } from "../../../src/components/motion";
import { Row, Stack } from "../overlays/parts/demo";

export const meta = {
  title: "ReadingProgress",
  group: "motion",
  order: 60,
  description:
    "A thin accent bar along the top of the scrollport, showing how far the reader is through the region it wraps: 0 when the article's top meets the top, full when its bottom meets the bottom. Drawn by a view timeline (one passive listener where that is missing). Decorative and aria-hidden, takes no space or pointer, and is not printed. Each demo scrolls in its own frame here; on a page, the bar sticks to the top of the window.",
};

const PARAGRAPHS = [
  "Release 4.2 moves every chart onto the new axis engine. Labels now measure themselves before they are placed, so a long series name wraps rather than running into the plot, and the tooltip reads the same table the screen reader does.",
  "Tables gained column pinning and resizing by keyboard. A pinned column keeps its edge rule only while the table is scrolled, and a resized column remembers its width per user, not per device.",
  "The density switch now reaches the date pickers' popups, which render in place in the top layer instead of being portalled to the body. A compact card's picker is compact.",
  "Printing a dashboard now prints every row a windowed table has mounted, in flow, with a note that it holds more, and closed disclosure panels print open.",
  "Every example theme was re-measured against the contrast floors after the surface ramp moved, and the code colours were retuned for the dark scheme.",
  "Finally, the motion tokens collapse under reduced motion at the token level, so nothing built on them needs a query of its own.",
];

function Article({ title, paragraphs, label }: { title: string; paragraphs: string[]; label: string }) {
  return (
    <div
      data-sc="reading-scroller"
      data-sc-scrolls=""
      data-print="flow"
      role="region"
      tabIndex={0}
      aria-label={label}
      className="h-[calc(var(--CONTROL-H)*8)] overflow-y-auto rounded-lg border border-border bg-surface-0"
    >
      <ReadingProgress as="article" data-sc="reading-article" className="prose max-w-measure px-r2 pb-r2">
        <h3 className="pt-r2">{title}</h3>
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </ReadingProgress>
    </div>
  );
}

export default function ReadingProgressSection() {
  return (
    <Stack>
      <Row label="An article in its own scroller: scroll it and the bar fills from the inline start">
        <Article title="What changed in 4.2" paragraphs={PARAGRAPHS} label="Release notes, scrollable" />
      </Row>
      <Row label="RTL and compact: the bar fills from the right and is thinner (--R-SIZE-6)">
        <div dir="rtl" lang="ar" data-density="compact">
          <Article
            title="ما الجديد في الإصدار 4.2"
            label="ملاحظات الإصدار"
            paragraphs={Array.from({ length: 8 }, (_, i) =>
              i % 2 === 0
                ? "تنقل هذه النسخة كل الرسوم البيانية إلى محرك المحاور الجديد، فتقيس التسميات نفسها قبل وضعها، ويلتف اسم السلسلة الطويل بدلًا من أن يتداخل مع الرسم."
                : "اكتسبت الجداول تثبيت الأعمدة وتغيير عرضها بلوحة المفاتيح، ويتذكر العمود عرضه لكل مستخدم.",
            )}
          />
        </div>
      </Row>
    </Stack>
  );
}
