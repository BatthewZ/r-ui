// Every class here generates CSS (or is a marker / a class the CSS defines).
const TONES = { quiet: "bg-surface-1 text-fg-secondary", label: "Quiet tone" };
const ENTER_CLASS = "fade-in";
const cn = (...parts: unknown[]) => parts.join(" ");
export function Good({ tone, flag }: { tone: "quiet"; flag: boolean }) {
  const variant = tone === "quiet" ? "rounded-md" : "rounded-lg";
  return (
    <div className={cn("group font-semibold p-r3", flag && "text-body-2", TONES[tone], variant)}>
      <span className="text-h3 hover:bg-surface-2 focus-visible:focus-ring h-control @container">a</span>
      <span className={`${ENTER_CLASS} bg-series-1 text-fg-muted`}>b</span>
      <span className="prose not-prose r-floating-top-layer shadow-lg ease-standard">c</span>
    </div>
  );
}
