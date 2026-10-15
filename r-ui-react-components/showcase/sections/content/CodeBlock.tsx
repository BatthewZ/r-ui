import { CodeBlock } from "../../../src/components/content";
import { Row, Stack } from "../primitives/parts/demo";
import { LONG_LINE, OVER_BUDGET, SNIPPETS } from "./parts/samples";

export const meta = {
  title: "CodeBlock",
  group: "content",
  order: 20,
  description:
    "Syntax colour from lowlight, each language's grammar fetched on first use (plain text until then, and for good if the load fails), mapped to --C-CODE-* roles that hold 4.5:1 in every theme. Long lines scroll inside the block or wrap; the page never widens.",
};

export default function CodeBlockSection() {
  return (
    <Stack>
      <Row label="Filename · line numbers · highlighted lines (TypeScript)">
        <CodeBlock data-sc-scrolls code={SNIPPETS.ts} language="ts" filename="src/server/rate-limit.ts" lineNumbers highlightLines={[4, 5]} />
      </Row>

      <Row label="Every role: JSON · Python · SQL · diff · shell">
        <div className="grid min-w-0 gap-r3 @3xl:grid-cols-2">
          <CodeBlock data-sc-scrolls code={SNIPPETS.json} language="json" filename="package.json" />
          <CodeBlock data-sc-scrolls code={SNIPPETS.python} language="python" />
          <CodeBlock data-sc-scrolls code={SNIPPETS.sql} language="sql" />
          <CodeBlock data-sc-scrolls code={SNIPPETS.diff} language="diff" filename="rate-limit.patch" />
          <CodeBlock data-sc-scrolls code={SNIPPETS.shell} language="shell" />
          <CodeBlock data-sc-scrolls code={SNIPPETS.html} language="html" filename="embed.html" />
        </div>
      </Row>

      <Row label="Long line: scrolls inside the block (focusable) · wrapped from the start">
        <CodeBlock data-sc-scrolls code={LONG_LINE} language="ts" lineNumbers />
        <CodeBlock data-sc-scrolls code={LONG_LINE} language="ts" defaultWrap lineNumbers />
      </Row>

      <Row label="Unknown language (plain, never guessed) · past the highlight budget (plain) · empty · no header">
        <CodeBlock data-sc-scrolls code={"++++++++[>++++[>++>+++<<-]>+<<-]>>."} language="brainfuck" />
        <CodeBlock data-sc-scrolls code={OVER_BUDGET} language="ts" filename="vendor.min.js" />
        <CodeBlock data-sc-scrolls code="" language="ts" filename="empty.ts" />
        <CodeBlock data-sc-scrolls code="echo no chrome at all" copyable={false} wrapToggle={false} />
      </Row>

      <Row label="Compact · right-to-left page (the code stays left-to-right)">
        <div className="grid min-w-0 gap-r3 @3xl:grid-cols-2">
          <div data-density="compact" className="min-w-0">
            <CodeBlock data-sc-scrolls code={SNIPPETS.shell} language="shell" filename="compact.sh" lineNumbers highlightLines={[2]} />
          </div>
          <div dir="rtl" className="min-w-0">
            <CodeBlock data-sc-scrolls code={SNIPPETS.json} language="json" filename="إعدادات.json" lineNumbers />
          </div>
        </div>
      </Row>
    </Stack>
  );
}
