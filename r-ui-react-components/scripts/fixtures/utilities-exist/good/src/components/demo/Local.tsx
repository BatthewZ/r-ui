// A local `classes` used as a class list here is not the labels table of the
// same name in Kinds.tsx: names are matched by binding, not by spelling.
const cn = (...parts: unknown[]) => parts.join(" ");
export function Local({ on }: { on: boolean }) {
  const classes = cn("p-r3", on && "text-fg-muted");
  return <span className={classes}>x</span>;
}
