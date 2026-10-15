// Every class here is legal: tokens, 0, px, full, auto, fractions, keywords,
// var() arbitrary values and this package's own domain utilities.
const size = 3;
export function Good() {
  return (
    <div className="p-0 m-px w-full h-auto w-1/2 min-h-dvh border-px p-r3 h-control gap-r4 -mt-0">
      <span className="h-(--CONTROL-H) w-[var(--ROW-H)] bg-series-1 text-trend-good h-chart text-kpi">
        a
      </span>
      <span className="bg-surface-0/50 rounded-full z-10 opacity-50 translate-x-full">b</span>
      <span style={{ transform: `translate(${size}px, 0)`, borderWidth: "1px" }}>c</span>
      <a href="#overview">d</a>
    </div>
  );
}
