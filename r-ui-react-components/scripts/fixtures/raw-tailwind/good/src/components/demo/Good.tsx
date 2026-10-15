// Every class here is legal: tokens, 0, px, full, auto, fractions, keywords,
// var() arbitrary values, this package's own domain utilities, the unit lengths
// (1em, 1lh, 1ch, 100dvh, 100cqi), and a 1px that draws no line.
const size = 3;
export function Good() {
  return (
    <div className="p-0 m-px w-full h-auto w-1/2 min-h-dvh border-px p-r3 h-control gap-r4 -mt-0">
      <span className="h-(--CONTROL-H) w-[var(--ROW-H)] bg-series-1 text-trend-good h-chart text-kpi">
        a
      </span>
      <span className="bg-surface-0/50 rounded-full z-raised z-0 md:z-sticky opacity-50 translate-x-full">b</span>
      <span style={{ transform: `translate(${size}px, 0)`, borderWidth: "var(--BORDER-WIDTH)", width: "1px" }}>c</span>
      <span className="size-[1em] h-[1lh] w-[calc(var(--DIGITS)*1ch)] min-h-[100dvh] text-[calc(100cqi*0.38)] shadow-[inset_0_0_0_var(--BORDER-WIDTH)_var(--C-BORDER)]">e</span>
      <a href="#overview">d</a>
    </div>
  );
}
