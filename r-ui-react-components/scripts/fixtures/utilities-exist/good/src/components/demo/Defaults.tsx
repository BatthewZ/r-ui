// A string default reached through a comparison is a value, never a class: `shape`
// defaults to "text" and `position` to "start", both of which Tailwind would parse as
// utility roots. Only the branches of `&&` and `? :` can reach the class list.
const cn = (...parts: unknown[]) => parts.join(" ");
export function Defaults({ shape = "text", position = "start" }: { shape?: "text" | "circle"; position?: "start" | "end" }) {
  const isText = shape === "text";
  const isEnd = position === "end";
  return (
    <span className={cn("p-r3", isText && "rounded-md", isEnd ? "ms-auto" : "me-auto", !isText && "size-control")}>
      <span className={shape !== "circle" ? "h-control" : "size-icon"}>x</span>
    </span>
  );
}
