// Deliberately bad: every line below must be reported by verify:no-raw-tailwind.
// p-4 in a comment must NOT be reported (comments are not class lists).
const hoisted = "inline-flex px-3 py-1.5";
export function Bad() {
  return (
    <div className="p-4 gap-2 h-8 w-9 min-w-45 -mt-4 md:hover:mt-4">
      <span className="text-sm text-xs">a</span>
      <span className="bg-blue-500 text-white ring-black/50">b</span>
      <span className="rounded shadow rounded-t">c</span>
      <span className="p-[12px] bg-[#fff] w-[3rem] text-[oklch(0.5_0.1_200)]">d</span>
      <span className={hoisted} style={{ width: "12px", color: "#ff0000" }}>e</span>
      <span className="sticky z-10">f</span>
      <span className="mt-[-12px] z-[5]" style={{ marginTop: "-8px" }}>g</span>
      <span className="border-2 border-t-4 divide-x-2 ring-2 outline-offset-2">h</span>
      <span className="mt-[0.25em] w-[8ch] max-w-[calc(100vw-var(--R-SIZE-2)*2)] h-[50dvh] text-[38cqi] p-[0_12px]">i</span>
      <span className="shadow-[inset_0_0_0_1px_var(--C-BORDER)] outline-[1px] aria-selected:ring-[1px]">j</span>
      <span style={{ boxShadow: "inset 0 0 0 1px var(--C-BORDER)", outlineWidth: "1px", borderWidth: "1px", marginInline: "-1.25em" }}>k</span>
    </div>
  );
}
