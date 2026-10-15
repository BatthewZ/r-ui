// Deliberately bad: every class below compiles to nothing under the CSS package.
// font-bold in a comment must NOT be reported (comments are not class lists).
const TONES = { loud: "bg-gray-100 text-fg-primary" };
const cn = (...parts: unknown[]) => parts.join(" ");
export function Bad({ tone, flag }: { tone: "loud"; flag: boolean }) {
  return (
    <div className="font-bold p-r3">
      <span className={cn("text-sm", flag && "leading-tight", TONES[tone])}>a</span>
      <span className="rounded hover:tracking-tight">b</span>
      <span className={`bg-${tone} text-fg-muted`}>c</span>
      <span className="no-such-class">d</span>
    </div>
  );
}
