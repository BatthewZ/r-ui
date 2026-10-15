import { Card } from "../../../src";
import { Markdown } from "../../../src/components/content";
import { Row, Stack } from "../primitives/parts/demo";
import { HOSTILE, RELEASE_NOTES } from "./parts/samples";

export const meta = {
  title: "Markdown",
  group: "content",
  order: 30,
  description:
    "A closed GFM subset parsed to a tree and rendered as components, in a prose region; fences become CodeBlocks and tables the library Table, both keeping UI sizing. Untrusted by default: raw HTML is text, links pass safeUrl, images need an allowlist.",
};

export default function MarkdownSection() {
  return (
    <Stack>
      <Row label="Release notes: headings offset by 1 · lists · tasks · quote · code · table · rule · refused image">
        {/* Its code and table scroll sideways by design on a phone. */}
        <Card data-sc-scrolls>
          <Card.Body>
            <Markdown headingOffset={1} measure>
              {RELEASE_NOTES}
            </Markdown>
          </Card.Body>
        </Card>
      </Row>

      <Row label="Hostile input: script tags, javascript:/data: links, a tracking pixel, an unbroken word, 40-deep nesting, a 24 × 40 table, a 400-character code line">
        <div data-testid="markdown-hostile" className="min-w-0" data-sc-scrolls>
          <Markdown>{HOSTILE}</Markdown>
        </div>
      </Row>

      <Row label="Compact · right-to-left">
        <div className="grid min-w-0 gap-r3 @2xl:grid-cols-2">
          <Card data-density="compact" data-sc-scrolls>
            <Card.Body>
              <Markdown headingOffset={2}>{"### Compact\n\nProse keeps its own scale; the table and the code stay UI.\n\n| Key | Value |\n| --- | --- |\n| region | ap-southeast-2 |\n\n```sh\nexport REGION=ap-southeast-2\n```"}</Markdown>
            </Card.Body>
          </Card>
          <div dir="rtl" className="min-w-0">
            <Markdown>{"## ملاحظات الإصدار\n\n- [x] تم **الترحيل**\n- [ ] إزالة الرأس القديم\n\nاقرأ [الدليل](https://example.com) قبل الترقية."}</Markdown>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
