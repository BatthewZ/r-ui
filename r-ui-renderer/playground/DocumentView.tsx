import { useState } from "react";

import { type Density, ViewRenderer, type ViewRendererInput } from "../src";
import { icons } from "../src/icons";
import { FIXTURE_IMAGE_PATH, usePlaygroundAdapters } from "./adapters";
import { useReplay } from "./replay";
import { createRequestTracker, usePageMarkers, useSettled } from "./settle";

const MARKDOWN_IMAGES = [FIXTURE_IMAGE_PATH];

interface DocumentViewProps {
  readonly input: ViewRendererInput;
  /** The document has fully arrived. */
  readonly complete: boolean;
  readonly density?: Density;
}

/**
 * One document hosted as the playground hosts every view: its adapters, the
 * shipped icons, and `<html data-renderer-ready>` once it has settled.
 */
export function DocumentView({ input, complete, density }: DocumentViewProps) {
  const [tracker] = useState(createRequestTracker);
  const adapters = usePlaygroundAdapters(tracker);
  usePageMarkers(useSettled(complete, tracker));
  return (
    <ViewRenderer {...input} adapters={adapters} icons={icons} density={density} markdownImageAllowlist={MARKDOWN_IMAGES} />
  );
}

interface StreamedViewProps {
  readonly text: string;
  /** Characters per frame; `null` shows `text` at once, complete. */
  readonly charsPerFrame: number | null;
  readonly density?: Density;
}

/** `text` through the stream parser, replayed at `charsPerFrame` (remount to replay again). */
export function StreamedView({ text, charsPerFrame, density }: StreamedViewProps) {
  const replay = useReplay(text, charsPerFrame);
  return <DocumentView input={{ text: replay.text, complete: replay.complete }} complete={replay.complete} density={density} />;
}
