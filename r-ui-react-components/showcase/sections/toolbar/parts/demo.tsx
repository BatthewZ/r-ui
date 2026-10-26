import {
  Bold,
  Image,
  Italic,
  Link,
  Redo2,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  Underline,
  Undo2,
} from "lucide-react";
import { type ReactNode, useState } from "react";

import { Select } from "../../../../src/components/form";
import { DropdownMenu } from "../../../../src/components/overlays";
import { IconButton } from "../../../../src/components/primitives";
import { ToggleGroup, Toolbar, type ToolbarLabels } from "../../../../src/components/toolbar";
import { DemoLabel } from "../../../shell/DemoLabel";

/** A labelled row inside a toolbar demo. In a subfolder, which the section registry does not glob. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-r5">
      <DemoLabel>{label}</DemoLabel>
      {children}
    </div>
  );
}

export function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-r2">{children}</div>;
}

/** Tints every hit area inside, to see the touch spacing at coarse input. */
export const SHOW_HIT_CLASSES = "[&_.hit-area]:before:bg-focus/25";

/** The words of the editor toolbar, so a translated copy can pass its own. */
export interface EditorWords {
  name: string;
  history: string;
  undo: string;
  redo: string;
  font: string;
  style: string;
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  align: string;
  start: string;
  center: string;
  end: string;
  justify: string;
  link: string;
  image: string;
  fonts: [string, string][];
}

export const EDITOR_WORDS: EditorWords = {
  name: "Formatting",
  history: "History",
  undo: "Undo",
  redo: "Redo",
  font: "Font",
  style: "Text style",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  strike: "Strikethrough",
  align: "Alignment",
  start: "Align start",
  center: "Align centre",
  end: "Align end",
  justify: "Justify",
  link: "Insert link",
  image: "Insert image",
  fonts: [
    ["ui", "Interface"],
    ["serif", "Serif"],
    ["mono", "Monospace"],
  ],
};

/**
 * A text editor's toolbar: history, a font Select (no menu form: it stays in
 * the bar), multiple style toggles, single alignment, insert actions. Each
 * piece reports to `onAction`, so the demo can show what ran.
 */
export function EditorToolbar({
  words = EDITOR_WORDS,
  labels,
  className,
  onAction = () => {},
  ...props
}: {
  words?: EditorWords;
  labels?: Partial<ToolbarLabels>;
  className?: string;
  onAction?: (what: string) => void;
  "data-sc"?: string;
}) {
  const [style, setStyle] = useState<string[]>(["bold"]);
  const [align, setAlign] = useState("start");
  const action = (name: string) => (
    <DropdownMenu.Item onSelect={() => onAction(name)}>{name}</DropdownMenu.Item>
  );
  return (
    <Toolbar aria-label={words.name} labels={labels} className={className} {...props}>
      <Toolbar.Group aria-label={words.history}>
        <Toolbar.Item menu={action(words.undo)}>
          <IconButton label={words.undo} icon={<Undo2 />} onClick={() => onAction(words.undo)} />
        </Toolbar.Item>
        <Toolbar.Item menu={action(words.redo)}>
          <IconButton label={words.redo} icon={<Redo2 />} onClick={() => onAction(words.redo)} />
        </Toolbar.Item>
      </Toolbar.Group>
      <Toolbar.Separator />
      <Select aria-label={words.font} defaultValue="ui">
        {words.fonts.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </Select>
      <Toolbar.Separator />
      <ToggleGroup
        type="multiple"
        aria-label={words.style}
        value={style}
        onValueChange={(next) => {
          setStyle(next);
          onAction(`${words.style}: ${next.join(", ") || "—"}`);
        }}
      >
        <ToggleGroup.Item value="bold" icon={<Bold />} label={words.bold} />
        <ToggleGroup.Item value="italic" icon={<Italic />} label={words.italic} />
        <ToggleGroup.Item value="underline" icon={<Underline />} label={words.underline} />
        <ToggleGroup.Item value="strike" icon={<Strikethrough />} label={words.strike} />
      </ToggleGroup>
      <Toolbar.Separator />
      <ToggleGroup
        type="single"
        aria-label={words.align}
        value={align}
        onValueChange={(next) => {
          setAlign(next);
          onAction(`${words.align}: ${next}`);
        }}
      >
        <ToggleGroup.Item value="start" icon={<TextAlignStart />} label={words.start} />
        <ToggleGroup.Item value="center" icon={<TextAlignCenter />} label={words.center} />
        <ToggleGroup.Item value="end" icon={<TextAlignEnd />} label={words.end} />
        <ToggleGroup.Item value="justify" icon={<TextAlignJustify />} label={words.justify} />
      </ToggleGroup>
      <Toolbar.Separator />
      <Toolbar.Item menu={action(words.link)}>
        <IconButton label={words.link} icon={<Link />} onClick={() => onAction(words.link)} />
      </Toolbar.Item>
      <Toolbar.Item menu={action(words.image)}>
        <IconButton label={words.image} icon={<Image />} onClick={() => onAction(words.image)} />
      </Toolbar.Item>
    </Toolbar>
  );
}

/** The frame an editor toolbar sits in: a hairline box, its padding the row gap. */
export const BAR_FRAME_CLASSES = "rounded-md border bg-surface-0 p-r6";
