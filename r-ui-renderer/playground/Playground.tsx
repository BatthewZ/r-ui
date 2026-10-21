import { Button, Field, Link, Select, Textarea } from "@batthewz/r-ui-react-components";
import { Play } from "lucide-react";
import { useDeferredValue, useMemo, useRef, useState } from "react";

import type { Issue } from "../src";
import { validateViewSpec } from "../src/spec/validate";
import { COVERAGE_NAMES, corpusDocument, PRODUCT_NAMES } from "./corpus";
import { StreamedView } from "./DocumentView";
import { IssuePanel } from "./IssuePanel";
import { locatePointer, offsetOf, type Span } from "./locate";
import { ViewPanel } from "./ViewPanel";

/** Characters per frame the replay control offers; 0 pushes everything at once. */
const REPLAY_RATES = [1, 4, 16, 64, 256, 0] as const;
const DEFAULT_RATE = 16;

function textOf(name: string): string {
  const entry = corpusDocument(name);
  return entry.ok ? entry.text : "";
}

/** Where `issue` points in `text`: its line and column when it has them, else its path. */
function spanOf(text: string, issue: Issue): Span | undefined {
  if (issue.line !== undefined) {
    const offset = offsetOf(text, issue.line, issue.column ?? 1);
    return { start: offset, end: offset };
  }
  return locatePointer(text, issue.path);
}

/** `/`: the editor, its issues, a live preview, the corpus and a streaming replay. */
export function Playground() {
  const [name, setName] = useState<string>(PRODUCT_NAMES[0] ?? COVERAGE_NAMES[0] ?? "");
  const [text, setText] = useState(() => textOf(name));
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [replaying, setReplaying] = useState(false);
  // A new run is a fresh view: its state, forms and requests start over.
  const [run, setRun] = useState(0);
  const editor = useRef<HTMLTextAreaElement>(null);

  const deferred = useDeferredValue(text);
  const validation = useMemo(() => validateViewSpec(deferred, { origin: location.origin }), [deferred]);

  const choose = (next: string) => {
    setName(next);
    setText(textOf(next));
    setReplaying(false);
    setRun((current) => current + 1);
  };
  const replay = () => {
    setReplaying(true);
    setRun((current) => current + 1);
  };
  const jump = (issue: Issue) => {
    const element = editor.current;
    const span = spanOf(element?.value ?? text, issue);
    if (element === null || span === undefined) return;
    element.focus();
    element.setSelectionRange(span.start, span.end);
  };

  return (
    <div className="pg-app">
      <header className="pg-bar">
        <h1 className="pg-brand">ViewSpec playground</h1>
        <Field className="pg-control">
          <Field.Label>Document</Field.Label>
          <Select value={name} onValueChange={choose}>
            <optgroup label="Product">
              {PRODUCT_NAMES.map((example) => (
                <option key={example} value={example}>
                  {example}
                </option>
              ))}
            </optgroup>
            <optgroup label="Coverage">
              {COVERAGE_NAMES.map((example) => (
                <option key={example} value={example}>
                  {example}
                </option>
              ))}
            </optgroup>
          </Select>
        </Field>
        <Field className="pg-control">
          <Field.Label>Replay speed</Field.Label>
          <Select value={String(rate)} onValueChange={(value) => setRate(Number(value))}>
            {REPLAY_RATES.map((option) => (
              <option key={option} value={String(option)}>
                {option === 0 ? "All at once" : `${option} per frame`}
              </option>
            ))}
          </Select>
        </Field>
        <Button variant="secondary" iconStart={<Play aria-hidden className="size-icon" />} onClick={replay}>
          Replay stream
        </Button>
        <Link href={`?view=${encodeURIComponent(name)}`} className="pg-bar-link">
          Full page
        </Link>
        <ViewPanel />
      </header>
      <div className="pg-panes">
        <section className="pg-source" aria-label="Document source">
          <Textarea
            ref={editor}
            aria-label="Document JSON"
            className="pg-editor"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={text}
            onChange={(event) => {
              setText(event.currentTarget.value);
              setReplaying(false);
            }}
          />
          <IssuePanel issues={validation.issues} onJump={jump} />
        </section>
        <section className="pg-preview" aria-label="Preview">
          <StreamedView key={run} text={replaying ? text : deferred} charsPerFrame={replaying ? rate : null} />
        </section>
      </div>
    </div>
  );
}
