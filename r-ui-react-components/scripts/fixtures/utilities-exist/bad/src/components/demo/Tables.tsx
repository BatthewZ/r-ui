// Class-named lookup tables that ARE class lists: still judged as classes.
const cn = (...parts: unknown[]) => parts.join(" ");
const ROW_CLASSES = { quiet: "no-such-row text-fg-muted" };
export const TONE_CLASSES = ["no-such-tone"];
const UNUSED_CLASSES = ["font-black"];
export const SIZE_CLASSES = ["no-such-size"];
export function Tables({ tone }: { tone: "quiet" }) {
  return <span className={cn(ROW_CLASSES[tone])}>{UNUSED_CLASSES.length}</span>;
}
