// Dead classes in the branches of `&&` and `? :` are still reported; the
// conditions in front of them never are.
const cn = (...parts: unknown[]) => parts.join(" ");
export function Branches({ size = "wide" }: { size?: "wide" | "narrow" }) {
  const isWide = size === "wide";
  return <span className={cn(isWide && "shadow-2xl", size !== "wide" ? "text-xs" : "p-r3")}>x</span>;
}
