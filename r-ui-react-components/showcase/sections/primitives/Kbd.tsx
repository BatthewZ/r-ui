import { Divider, Kbd } from "../../../src/components/primitives";
import { Row, Stack } from "./parts/demo";

export const meta = {
  title: "Kbd & Divider",
  group: "primitives",
  order: 60,
  description:
    "Kbd sits on the text baseline in any type size. Divider is a hairline with no margin of its own; labelled, its words stay readable.",
};

export default function KbdSection() {
  return (
    <Stack>
      <Row label="Kbd: in UI text · a chord · in a heading · compact · in prose">
        <div className="grid gap-r4">
          <p className="text-body-1">
            Press <Kbd>Esc</Kbd> to close, or{" "}
            <kbd>
              <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </kbd>{" "}
            to open the command palette.
          </p>
          <h4 className="text-h4">
            Search with <Kbd>/</Kbd>
          </h4>
          <p data-density="compact" className="text-body-2">
            Compact: <Kbd>Shift</Kbd> + <Kbd>Enter</Kbd> for a new line.
          </p>
          <div className="prose">
            <p>
              In prose, <Kbd>Ctrl</Kbd> + <Kbd>C</Kbd> copies the selection.
            </p>
          </div>
        </div>
      </Row>

      <Row label="Divider: horizontal · labelled · vertical in a toolbar">
        <div className="grid gap-r3">
          <Divider />
          <Divider>or continue with</Divider>
          <div className="flex h-control items-center gap-r4 text-body-2 text-fg-secondary">
            <span>Bold</span>
            <Divider orientation="vertical" />
            <span>Italic</span>
            <Divider orientation="vertical" />
            <span>Link</span>
          </div>
          <div dir="rtl">
            <Divider>أو</Divider>
          </div>
        </div>
      </Row>
    </Stack>
  );
}
